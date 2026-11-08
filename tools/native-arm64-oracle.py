"""Bounded static ARM64 interpreter for offline damage investigation.

Never loads or executes the target library. Unsupported operations/reads fail closed.
External calls must have explicit fixture hooks. Not a general CPU emulator.
"""
from pathlib import Path
import hashlib
import struct
import capstone
from capstone.arm64 import ARM64_OP_REG, ARM64_OP_IMM, ARM64_OP_MEM, ARM64_SFT_LSL, ARM64_SFT_LSR, ARM64_SFT_ASR
from elftools.elf.elffile import ELFFile

MASK = (1 << 64) - 1
STOP = 0xffff0000

def signed(value, bits=64):
    value &= (1 << bits) - 1
    return value - (1 << bits) if value >> (bits - 1) else value

class Image:
    def __init__(self, path):
        self.stream = open(Path(path), 'rb')
        self.digest = hashlib.file_digest(self.stream, 'sha256').hexdigest()
        assert self.digest == 'bed445a394a7b7e7f58a5f61399ccf1875a03087c574e76e726d4aa23ca7f7d3'
        self.stream.seek(0)
        self.segments = [(s['p_vaddr'], s['p_offset'], s['p_filesz']) for s in ELFFile(self.stream).iter_segments() if s['p_type'] == 'PT_LOAD']
        self.decoder = capstone.Cs(capstone.CS_ARCH_ARM64, capstone.CS_MODE_ARM)
        self.decoder.detail = True
        self.code = {}
    def read(self, address, size):
        for va, offset, length in self.segments:
            if va <= address and address + size <= va + length:
                self.stream.seek(offset + address - va)
                return self.stream.read(size)
        raise ValueError(('unmapped image', hex(address), size))
    def region(self, start, end):
        for ins in self.decoder.disasm(self.read(start, end - start), start):
            self.code[ins.address] = ins
    def close(self):
        self.stream.close()

class Machine:
    def __init__(self, image):
        self.image = image
        self.registers = {'x' + str(i): 0 for i in range(31)}
        self.registers.update(sp=0x800000, x30=STOP)
        self.memory = {}
        self.ranges = [(0x7f0000, 0x810000)]
        self.hooks = {}
        self.visited = set()
        self.calls = []
        self.flags = (False, False, False, False)
    def alloc(self, address, size=0x1000):
        self.ranges.append((address, address + size))
        return address
    def get(self, name):
        name = {'fp': 'x29', 'lr': 'x30'}.get(name, name)
        if name in ('xzr', 'wzr'): return 0
        if name == 'wsp': return self.registers['sp'] & 0xffffffff
        if name.startswith('w'): return self.registers['x' + name[1:]] & 0xffffffff
        return self.registers[name] & MASK
    def put(self, name, value):
        name = {'fp': 'x29', 'lr': 'x30'}.get(name, name)
        if name in ('xzr', 'wzr'): return
        if name == 'wsp': name = 'sp'; value &= 0xffffffff
        if name.startswith('w'): name = 'x' + name[1:]; value &= 0xffffffff
        self.registers[name] = value & MASK
    def write(self, address, value, size=8):
        for j in range(size): self.memory[address + j] = (value >> (8 * j)) & 255
    def read(self, address, size=8):
        if all(address + j in self.memory for j in range(size)):
            return sum(self.memory[address + j] << (8 * j) for j in range(size))
        if any(lo <= address and address + size <= hi for lo, hi in self.ranges):
            return sum(self.memory.get(address + j, 0) << (8 * j) for j in range(size))
        # All initialization-cache bytes are warm in the selected default-body fixture.
        if 0x9fc0000 <= address < 0x9fd0000 and size == 1: return 1
        if 0x1900000 <= address < 0x2200000:
            return int.from_bytes(self.image.read(address, size), 'little')
        raise ValueError(('unmodeled read', hex(address), size))
    def globals(self):
        # Runtime metadata pointers are fixture objects, NOT observed live objects.
        for ins in self.image.code.values():
            if ins.mnemonic != 'adrp': continue
            dest = ins.reg_name(ins.operands[0].reg)
            page = ins.operands[1].imm
            for k in range(1, 17):
                nxt = self.image.code.get(ins.address + 4 * k)
                if not nxt: break
                if nxt.mnemonic == 'ldr' and len(nxt.operands) == 2:
                    operand = nxt.operands[1]
                    if operand.type == ARM64_OP_MEM and nxt.reg_name(operand.mem.base) == dest:
                        slot = page + operand.mem.disp
                        if 0x97d0000 <= slot < 0x9840000 and slot not in self.memory:
                            middle = 0x2000000 + (slot - 0x9700000) * 4
                            info = middle + 0x1000000
                            self.alloc(info, 0x100)
                            self.write(slot, middle)
                            self.write(middle, info)
                if ins.operands[0].reg in nxt.regs_access()[1]: break
    def run(self, entry, limit=5000):
        pc = entry
        for _ in range(limit):
            if pc == STOP: return self.get('x0')
            if pc in self.hooks:
                self.hooks[pc](self)
                pc = self.get('x30')
                continue
            ins = self.image.code[pc]
            self.visited.add(pc)
            ops = ins.operands
            def reg(op): return ins.reg_name(op.reg)
            def val(op):
                value = self.get(reg(op)) if op.type == ARM64_OP_REG else op.imm
                if op.shift.value:
                    k = op.shift.value
                    if op.shift.type == ARM64_SFT_LSL: value <<= k
                    elif op.shift.type == ARM64_SFT_LSR: value >>= k
                    elif op.shift.type == ARM64_SFT_ASR: value = signed(value) >> k
                    else: raise ValueError('unsupported shift')
                return value
            def address(op):
                result = self.get(ins.reg_name(op.mem.base)) + op.mem.disp
                if op.mem.index:
                    index = self.get(ins.reg_name(op.mem.index))
                    result += index << op.shift.value
                return result & MASK
            def cond(name):
                n, z, c, v = self.flags
                return {'eq': z, 'ne': not z, 'gt': not z and n == v, 'ge': n == v,
                        'lt': n != v, 'le': z or n != v, 'hi': c and not z,
                        'lo': not c, 'hs': c, 'ls': not c or z}[name]
            name, nxt = ins.mnemonic, pc + 4
            if name in ('mov', 'movk', 'adr', 'adrp'):
                v = val(ops[1])
                if name == 'movk': v = (self.get(reg(ops[0])) & ~(0xffff << ops[1].shift.value)) | v
                self.put(reg(ops[0]), v)
            elif name == 'neg':
                self.put(reg(ops[0]), -val(ops[1]))
            elif name in ('add', 'sub', 'subs', 'mul', 'and', 'bic', 'orr', 'eor', 'lsl', 'lsr', 'asr'):
                a, b = val(ops[1]), val(ops[2])
                if name == 'add': v = a + b
                elif name in ('sub', 'subs'): v = a - b
                elif name == 'mul': v = a * b
                elif name == 'and': v = a & b
                elif name == 'bic': v = a & ~b
                elif name == 'orr': v = a | b
                elif name == 'eor': v = a ^ b
                elif name == 'lsl': v = a << b
                elif name == 'lsr': v = a >> b
                else: v = signed(a, 32 if reg(ops[1]).startswith('w') else 64) >> b
                self.put(reg(ops[0]), v)
                if name == 'subs':
                    bits = 32 if reg(ops[0]).startswith('w') else 64
                    mask = (1 << bits) - 1
                    a, b, result = a & mask, b & mask, v & mask
                    self.flags = (bool(result >> (bits - 1)), result == 0, a >= b, bool(((a ^ b) & (a ^ result)) >> (bits - 1)))
            elif name == 'ubfx':
                self.put(reg(ops[0]), (val(ops[1]) >> val(ops[2])) & ((1 << val(ops[3])) - 1))
            elif name == 'cmp':
                bits = 32 if reg(ops[0]).startswith('w') else 64
                mask = (1 << bits) - 1
                a, b = val(ops[0]) & mask, val(ops[1]) & mask
                result = (a - b) & mask
                self.flags = (bool(result >> (bits - 1)), result == 0, a >= b, bool(((a ^ b) & (a ^ result)) >> (bits - 1)))
            elif name == 'csel':
                # Capstone condition codes follow ARM: EQ=1, NE=2, ... GT=13.
                conditions = {1: 'eq', 2: 'ne', 11: 'ge', 12: 'lt', 13: 'gt', 14: 'le'}
                self.put(reg(ops[0]), val(ops[1]) if cond(conditions[ins.cc]) else val(ops[2]))
            elif name in ('ldr', 'ldrb', 'ldur', 'ldp', 'str', 'strb', 'stp'):
                pair = name in ('ldp', 'stp')
                memop = ops[2] if pair else ops[1]
                addr = address(memop)
                size = 1 if name.endswith('b') else 4 if reg(ops[0]).startswith('w') else 8
                if name.startswith('ld'):
                    self.put(reg(ops[0]), self.read(addr, size))
                    if pair: self.put(reg(ops[1]), self.read(addr + size, size))
                else:
                    self.write(addr, val(ops[0]), size)
                    if pair: self.write(addr + size, val(ops[1]), size)
                if ins.writeback:
                    base = ins.reg_name(memop.mem.base)
                    self.put(base, self.get(base) + ops[-1].imm if ops[-1].type == ARM64_OP_IMM else addr)
            elif name in ('bl', 'blr'):
                target = val(ops[0])
                assert target in self.hooks or target in self.image.code, ('unmodeled call', hex(pc), hex(target))
                self.put('x30', nxt)
                self.calls.append((pc, target))
                if target in self.hooks: self.hooks[target](self)
                else: nxt = target
            elif name == 'b': nxt = val(ops[0])
            elif name.startswith('b.'):
                if cond(name[2:]): nxt = val(ops[0])
            elif name in ('cbz', 'cbnz'):
                if (val(ops[0]) == 0) == (name == 'cbz'): nxt = val(ops[1])
            elif name in ('tbz', 'tbnz'):
                if (bool((val(ops[0]) >> val(ops[1])) & 1)) == (name == 'tbnz'): nxt = val(ops[2])
            elif name in ('br', 'ret'): nxt = val(ops[0]) if ops else self.get('x30')
            else: raise ValueError(('unsupported instruction', hex(pc), name, ins.op_str))
            pc = nxt
        raise ValueError('step limit')
