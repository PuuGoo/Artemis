"""Kiểm oracle số học từ instruction ARM64 chọn lọc; không chạy APK/server.

Cần Capstone và pyelftools trong --analysis-tools; chỉ đọc binary tại --artifact-dir.
Không coi callee giả lập là quan sát runtime của game gốc.
"""
import argparse
import hashlib
import itertools
import json
from pathlib import Path
import sys

parser = argparse.ArgumentParser()
parser.add_argument('--artifact-dir', required=True)
parser.add_argument('--analysis-tools', required=True)
parser.add_argument('--output', required=True)
args = parser.parse_args()
sys.path.insert(0, args.analysis_tools)
import capstone
from elftools.elf.elffile import ELFFile

MASK = (1 << 64) - 1
Q = 65536

def signed(x):
    x &= MASK
    return x - (1 << 64) if x >> 63 else x

with open(Path(args.artifact_dir) / 'libil2cpp.so', 'rb') as stream:
    digest = hashlib.file_digest(stream, 'sha256').hexdigest()
    assert digest == 'bed445a394a7b7e7f58a5f61399ccf1875a03087c574e76e726d4aa23ca7f7d3'
    stream.seek(0)
    elf = ELFFile(stream)
    segments = list(elf.iter_segments())
    def readva(address, size):
        for segment in segments:
            if segment['p_type'] == 'PT_LOAD' and segment['p_vaddr'] <= address < segment['p_vaddr'] + segment['p_filesz']:
                stream.seek(segment['p_offset'] + address - segment['p_vaddr'])
                return stream.read(size)
        raise ValueError(hex(address))
    decoder = capstone.Cs(capstone.CS_ARCH_ARM64, capstone.CS_MODE_ARM)
    code = {i.address: (i.mnemonic, i.op_str) for i in decoder.disasm(readva(0x6562e44, 0x70), 0x6562e44)}

# Oracle: diễn giải instruction đúng vùng làm tròn/giảm flat/hệ số cuối,
# BL mulFP được mô phỏng bằng phép tách hi/lo quan sát trong callee.
def oracle(raw, factor, flat, percent, extra, both, limit):
    regs = {f'x{i}': 0 for i in range(31)}
    regs.update(x27=raw, x28=factor, x26=flat, x25=percent, x24=extra, x22=int(both), x23=int(limit))
    comparison = 0
    pc = 0x6562e44
    output = None
    steps = 0
    def value(token):
        token = token.strip()
        if token.startswith('#'):
            return int(token[1:], 0)
        if token in ('xzr', 'wzr'):
            return 0
        if token.startswith('w'):
            return regs['x' + token[1:]] & 0xffffffff
        return regs[token] & MASK
    def put(token, val):
        regs['x' + token[1:]] = val & (0xffffffff if token.startswith('w') else MASK)
    while pc < 0x6562eb4:
        steps += 1
        assert steps < 100
        mnemonic, operands = code[pc]
        parts = [p.strip() for p in operands.split(',')]
        next_pc = pc + 4
        if mnemonic == 'mov':
            put(parts[0], value(parts[1]))
        elif mnemonic == 'bl':
            assert int(parts[0][1:], 0) == 0x42b7ae0
            a, b = signed(value('x0')), signed(value('x1'))
            result = (a >> 16) * b + (b >> 16) * (a & 65535) + (((a & 65535) * (b & 65535)) >> 16)
            put('x0', result)
        elif mnemonic in ('sub', 'lsl', 'add'):
            a, b = value(parts[1]), value(parts[2])
            if len(parts) == 4:
                mode, amount = parts[3].split()
                assert mode in ('asr', 'lsl')
                shift = int(amount[1:], 0)
                b = signed(b) >> shift if mode == 'asr' else b << shift
            put(parts[0], a - b if mnemonic == 'sub' else a << b if mnemonic == 'lsl' else a + b)
        elif mnemonic == 'ubfx':
            put(parts[0], (value(parts[1]) >> value(parts[2])) & ((1 << value(parts[3])) - 1))
        elif mnemonic == 'cmp':
            comparison = signed(value(parts[0])) - signed(value(parts[1]))
        elif mnemonic == 'csinc':
            assert parts[3] == 'gt'
            put(parts[0], value(parts[1]) if comparison > 0 else value(parts[2]) + 1)
        elif mnemonic in ('b.lt', 'b.le'):
            take = comparison < 0 if mnemonic == 'b.lt' else comparison <= 0
            if take:
                next_pc = value(parts[0])
        elif mnemonic == 'tbz':
            if not (value(parts[0]) >> value(parts[1])) & 1:
                next_pc = value(parts[2])
        elif mnemonic == 'str':
            assert '[x19, #0x68]' in operands
            output = signed(value(parts[0]))
        else:
            raise AssertionError((hex(pc), mnemonic, operands))
        pc = next_pc
    return output

# Công thức độc lập dùng phép nhân số nguyên lớn, cùng miền không tràn.
def model(raw, factor, flat, percent, extra, both, limit):
    def multiply(a, b):
        return (a * b) // Q
    def rounded(a):
        return (a + Q // 2) // Q
    damage = max(1, rounded(multiply(multiply(raw, factor) - flat, percent)))
    if extra >= 1 and both:
        damage = rounded(multiply(damage * Q, Q + extra))
    return min(damage, 1) if limit else damage

count = 0
examples = []
for damage, factor, flat, percent, extra, both, limit in itertools.product(
        [0, 1, 17, 100, 10000], [13107, 65536, 327680],
        [0, 32768, 10 * Q, 200 * Q], [0, 32768, 65536], [0, 16384], [False, True], [False, True]):
    values = (damage * Q, factor, flat, percent, extra, both, limit)
    actual, expected = oracle(*values), model(*values)
    assert actual == expected, (values, actual, expected)
    count += 1
    if len(examples) < 5:
        examples.append({'inputs': values, 'damage': actual})
report = {
    'scope': 'Selected ARM64 instruction interpreter against independent integer model; no APK execution, no live runtime, caller/buff/shield callees not included.',
    'binary_sha256': digest,
    'range': ['0x6562e44', '0x6562eb4'],
    'cases': count, 'passed': count, 'examples': examples,
    'limitations': ['No signed64 overflow cases.', 'Clamp factor is an input, not exercised by this oracle.', 'Crit roll and shield logic are not exercised here.'],
}
Path(args.output).write_text(json.dumps(report, indent=2), encoding='utf8')
print(json.dumps({'cases': count, 'passed': count, 'scope': report['scope']}))
