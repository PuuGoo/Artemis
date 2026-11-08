"""Offline native-default branch oracle. No target process or game server.

Fixture stubs inject attribute values, actor flags, dispatch and external events.
Passing tests do not validate those callees or active online replacement code.
"""
import argparse
import importlib.util
import itertools
import json
from pathlib import Path
import random
import sys

parser = argparse.ArgumentParser()
parser.add_argument('--artifact-dir', required=True)
parser.add_argument('--analysis-tools', required=True)
parser.add_argument('--output', required=True)
parser.add_argument('--vectors-output')
args = parser.parse_args()
sys.path.insert(0, args.analysis_tools)
spec = importlib.util.spec_from_file_location('native_arm64_oracle', Path(__file__).with_name('native-arm64-oracle.py'))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
Image, Machine, signed = module.Image, module.Machine, module.signed
Q = 65536
image = Image(Path(args.artifact_dir) / 'libil2cpp.so')
image.region(0x64090c4, 0x640a064)
image.region(0x42a2654, 0x42a2698)
image.region(0x647250c, 0x64726f0)
image.region(0x6565f68, 0x65664ac)
for start, end in [(0x64711bc, 0x647130c), (0x6472164, 0x64723f0), (0x6472750, 0x64728d0), (0x63ce6b8, 0x63ce7a8), (0x6530b08, 0x6530bf0), (0x6530ca0, 0x6530e7c)]:
    image.region(start, end)
GET_ATTR = 0xf0000010
COMP, DATA, ENTITY, ATTR, CLASS, HERO, HIER, OUTPUT, OTHER = [0x1000000 + i * 0x10000 for i in range(9)]
coverage = set()
counts = {'get_decrease': 0, 'rng': 0, 'shield': 0, 'crit': 0, 'shield_state': 0, 'replacement_dispatch_fixture': 0}
vectors = {'decrease': [], 'rng': [], 'crit': [], 'shield': []}

def base():
    m = Machine(image)
    for p in (COMP, DATA, ENTITY, ATTR, CLASS, HERO, HIER, OUTPUT, OTHER): m.alloc(p)
    m.globals()
    return m

# Independent high-level model. Truncate after EACH percent modifier.
def decrease_model(attrs, race, attacker, element, extra_type, hero, moving, sword, invincible, inv_hurt):
    flat, coefficient = attrs[0x25], attrs[0x26]
    def apply(value):
        nonlocal coefficient
        # Native uses low64 MUL then signed ASR, not unlimited-precision mulFP.
        coefficient = signed(coefficient * value) >> 16
    if hero:
        if not moving:
            apply(attrs[0x24])
            flat += attrs[0x23]
        if attacker == 3:
            flat += attrs[0x27]
            apply(attrs[0x28])
        elif attacker == 1:
            apply(attrs[0x61])
        race_attr = 0x73 if race & 2 else 0x75 if race & 8 else 0x74 if race & 4 else 0x72 if race & ((1 << 4) | (1 << 18) | (1 << 7) | (1 << 15) | (1 << 16)) else None
        if race_attr is not None: apply(attrs[race_attr])
        apply(attrs[0x76 if race & (1 << 5) else 0x77])
        if sword: apply(Q - sword)
    if inv_hurt >= 1 and invincible: apply(inv_hurt)
    element_attr = {2: 0xab, 3: 0xad, 4: 0xbd, 5: 0xac}.get(element)
    if element_attr is not None: apply(attrs[element_attr])
    if element in (2, 3, 4, 5, 8): apply(attrs[0x98])
    extra_attr = {1: 0xb2, 2: 0xaf, 3: 0xae, 4: 0xb1, 5: 0xb0, 6: 0xf6, 7: 0xb2}.get(extra_type)
    if extra_attr is not None: apply(attrs[extra_attr])
    vulnerability = {1: 0xf5, 2: 0x108, 3: 0x107, 5: 0x103, 7: 0xf5}.get(extra_type)
    if vulnerability is not None: apply(Q + attrs[vulnerability])
    return signed(flat), coefficient

attr_ids = [0x25, 0x26, 0x23, 0x24, 0x27, 0x28, 0x61, 0x73, 0x75, 0x74, 0x72, 0x76, 0x77, 0xab, 0xad, 0xbd, 0xac, 0x98, 0xb2, 0xaf, 0xae, 0xb1, 0xb0, 0xf6, 0xf5, 0x108, 0x107, 0x103]
additive = {0x25, 0x23, 0x27, 0xf5, 0x108, 0x107, 0x103}

def check_decrease(attrs, race=0, attacker=0, element=0, extra_type=0, hero=True, moving=False, sword=0, invincible=False, inv_hurt=0):
    m = base()
    m.write(COMP + 0x38, DATA); m.write(COMP + 0x30, ENTITY)
    m.write(DATA + 0xb0, ATTR); m.write(DATA + 0x130, 16 if hero else 0, 1)
    m.write(DATA + 0x120, 32 if moving else 0, 1)
    m.write(DATA + 0x128, (1 << 31) if sword else 0, 4)
    m.write(ATTR, CLASS); m.write(CLASS + 0x1c8, GET_ATTR)
    # The type check is fixture-injected; native inheritance construction is not tested.
    middle = m.read(0x97f6ab8)
    m.write(middle, HERO); m.write(HERO + 0x130, 1, 1)
    m.write(ENTITY, HERO if hero else OTHER)
    m.write((HERO if hero else OTHER) + 0x130, 1, 1)
    m.write((HERO if hero else OTHER) + 0xc8, HIER)
    m.write(HIER, HERO if hero else OTHER)
    m.hooks.update({
        GET_ATTR: lambda v: v.put('x0', attrs[v.get('w1')]),
        0x67f4554: lambda v: v.put('x0', attrs[0x25]),
        0x67f45c4: lambda v: v.put('x0', attrs[0x26]),
        0x646ca24: lambda v: v.put('x0', int(invincible)),
        0x6528fa4: lambda v: v.put('x0', sword),
        0x3ac54a8: lambda v: None,
    })
    for i, value in enumerate((COMP, race, attacker, element, extra_type, inv_hurt, OUTPUT, OUTPUT + 8)):
        m.put('x' + str(i), value)
    m.run(0x64090c4)
    actual = (signed(m.read(OUTPUT)), signed(m.read(OUTPUT + 8)))
    expected = decrease_model(attrs, race, attacker, element, extra_type, hero, moving, sword, invincible, inv_hurt)
    assert actual == expected, (actual, expected, race, attacker, element, extra_type, hero, moving, sword, attrs)
    coverage.update(m.visited)
    counts['get_decrease'] += 1
    vectors['decrease'].append({'attrs': [attrs[i] for i in attr_ids], 'context': [race, attacker, element, extra_type, hero, moving, sword, invincible, inv_hurt], 'expected': list(actual)})

rng = random.Random(813287)
def attrs_fixture():
    return {i: rng.choice([0, 1, Q // 5, Q // 2, Q, Q + 12345]) if i not in additive else rng.choice([0, 1, 32767, 2 * Q]) for i in attr_ids}

# Systematic dispatch values, single-bit races and overlap precedence, plus combined fixtures.
for element, extra in itertools.product(range(10), range(9)):
    check_decrease(attrs_fixture(), race=0x580be, attacker=3, element=element, extra_type=extra, sword=12345, invincible=True, inv_hurt=32769)
for bit, attacker, moving, hero in itertools.product(range(20), [0, 1, 3], [False, True], [False, True]):
    check_decrease(attrs_fixture(), race=1 << bit, attacker=attacker, hero=hero, moving=moving)
for _ in range(120):
    check_decrease(attrs_fixture(), race=rng.randrange(1 << 20), attacker=rng.randrange(5), element=rng.randrange(10), extra_type=rng.randrange(10), hero=bool(rng.getrandbits(1)), moving=bool(rng.getrandbits(1)), sword=rng.choice([0, 32768]), invincible=bool(rng.getrandbits(1)), inv_hurt=rng.choice([0, 1, 32768, Q]))

# Verify actual RNG instructions against independently written 48-bit recurrence.
inverse = pow(25214903917, -1, 1 << 48)
boundary_seeds = [((value << 32) - 11) * inverse % (1 << 48) for value in [0, 1, 65534, 65535]]
for seed, low, high in itertools.product([0, 1, 0x123456789abc, (1 << 48) - 1, *boundary_seeds], [0, -10, 50], [0, 1, Q, -50]):
    m = base(); m.write(DATA + 0x10, seed)
    for i, value in enumerate((DATA, low, high)): m.put('x' + str(i), value)
    actual = signed(m.run(0x42a2654))
    next_seed = (seed * 25214903917 + 11) % (1 << 48)
    expected = min(low, high) + ((next_seed // (1 << 32)) * abs(high - low) // Q)
    assert actual == expected and m.read(DATA + 0x10) == next_seed
    counts['rng'] += 1
    vectors['rng'].append([seed, low, high, actual, m.read(DATA + 0x10)])

# CheckShield branch/event order. Effects themselves are explicit recording stubs.
shield_events = []
for shield, damage, has_component, buff in itertools.product([0, 1, 10, 100], [0, 1, 10, 99, 100, 101], [False, True], [0, 7]):
    m = base(); log = []
    m.write(ENTITY, CLASS); m.write(ENTITY + 0xa8, DATA if has_component else 0)
    m.write(ENTITY + 0x20, COMP); m.write(DATA + 0x78, buff, 4)
    for offset, marker, event in [(0x4d8, 0xf0000100, 'get'), (0x568, 0xf0000110, 'consume'), (0x558, 0xf0000120, 'on_break'), (0x578, 0xf0000130, 'clear')]:
        m.write(CLASS + offset, marker)
        def hook(v, event=event):
            if event == 'get': v.put('x0', shield)
            elif event == 'consume': log.append((event, v.get('x1')))
            else: log.append((event,))
        m.hooks[marker] = hook
    for address, event in [(0x63cea8c, 'break_effect'), (0x6472278, 'clear_flags'), (0x6472164, 'shield_change'), (0x660cefc, 'add_buff')]:
        def effect(v, event=event):
            log.append((event, v.get('w4')) if event == 'add_buff' else (event,))
        m.hooks[address] = effect
    m.hooks[0x3ac54a8] = lambda v: None
    m.put('x0', ENTITY); m.put('x1', damage)
    actual = m.run(0x647250c)
    expected_log = []
    if shield:
        if shield > damage: expected_log = [('consume', damage)]
        else:
            if has_component: expected_log.append(('break_effect',))
            expected_log += [('clear_flags',), ('on_break',), ('shield_change',), ('clear',)]
            if has_component and buff >= 1: expected_log.append(('add_buff', buff))
    assert actual == min(shield, damage) and log == expected_log, (shield, damage, actual, log, expected_log)
    counts['shield'] += 1
    if shield == 10 and damage == 10 and has_component and buff == 7: shield_events = log

# Interpret nested normal/hero shield methods, including actual mutations and flag writes.
for hero, normal, extra, damage in itertools.product([False, True], [0, 1, 10], [0, 1, 10], [0, 1, 10, 15, 100]):
    if not hero and extra: continue
    m = base()
    m.write(ENTITY, CLASS); m.write(ENTITY + 0xa8, OUTPUT); m.write(ENTITY + 0x30, DATA)
    m.write(ENTITY + 0x20, COMP)
    m.write(OUTPUT + 0x28, normal); m.write(OUTPUT + 0x30, 100)
    m.write(ENTITY + 0x458, extra); m.write(ENTITY + 0x450, 100 if hero else 0)
    flags = (1 << 35) | (1 << 37) | 4
    m.write(DATA + 0x128, flags)
    for offset, target in [(0x4d8, 0x6530b08 if hero else 0x64711bc), (0x4e8, 0x6530b7c if hero else 0x6471264), (0x568, 0x6530ca0 if hero else 0x6472750), (0x578, 0x6530e0c if hero else 0x6472858), (0x558, 0xf0000120)]:
        m.write(CLASS + offset, target)
    events = []
    m.hooks.update({0xf0000120: lambda v: events.append('on_break'), 0x63cea8c: lambda v: events.append('break_effect'), 0x3ac54a8: lambda v: None})
    m.put('x0', ENTITY); m.put('x1', damage)
    actual = m.run(0x647250c)
    total = normal + extra
    expected_normal, expected_extra = normal, extra
    if total:
        if total > damage:
            expected_extra = max(0, extra - damage)
            expected_normal = max(0, normal - max(0, damage - extra))
        else:
            expected_normal = expected_extra = 0
    assert actual == min(total, damage)
    assert (m.read(OUTPUT + 0x28), m.read(ENTITY + 0x458)) == (expected_normal, expected_extra), (hero, normal, extra, damage)
    assert m.read(DATA + 0x128) == (4 if total and total <= damage else flags)
    assert bool(m.read(DATA + 0x120) & (1 << 30)) == bool(total)
    assert events == (['break_effect', 'on_break'] if total and total <= damage else [])
    counts['shield_state'] += 1
    vectors['shield'].append([hero, normal, extra, damage, actual, m.read(OUTPUT + 0x28), m.read(ENTITY + 0x458)])

crit_coverage = set()
for hero, owner, sec_kill, rate, super_rate in itertools.product([False, True], [0, 0x10, 0x58090, 2], [False, True], [0, Q // 2, Q], [0, 8192]):
    attrs = {0xa9: 1024, 0xb3: 2048, 0x6c: Q, 0xaa: 4096}
    player_rate, player_value, base_value, super_value = 3000, 12000, 2 * Q, Q
    threshold = rate + (player_rate if hero else 0) - (attrs[0xa9] if hero and owner & 0x58090 else 0) - attrs[0xb3]
    rolls = sorted({0, Q - 1, *[v for v in [threshold - 1, threshold, threshold + 1, threshold + super_rate - 1, threshold + super_rate] if 0 <= v < Q]})
    for roll in rolls:
        m = base()
        m.write(COMP + 0x20, OTHER); m.write(OTHER + 0x60, HIER)
        m.write(COMP + 0x28, OUTPUT); m.write(COMP + 0x48, ENTITY)
        m.write(COMP + 0x62, int(sec_kill), 1)
        m.write(ENTITY + 0x30, DATA); m.write(DATA + 0x130, 16 if hero else 0, 1)
        m.write(DATA + 0xb0, ATTR); m.write(ATTR, CLASS); m.write(CLASS + 0x1c8, GET_ATTR)
        for offset, value in [(0x30, rate), (0x38, base_value), (0x40, super_rate), (0x48, super_value), (0x150, player_rate), (0x158, player_value)]:
            m.write(OUTPUT + offset, value)
        m.write(OUTPUT + 0x18c, owner, 4)
        roll_calls = []
        def roll_hook(v):
            assert v.get('x1') == 0 and v.get('x2') == Q
            roll_calls.append(roll)
            v.put('x0', roll)
        m.hooks.update({GET_ATTR: lambda v: v.put('x0', attrs[v.get('w1')]), 0x42a2654: roll_hook, 0x3ac54a8: lambda v: None})
        m.put('x0', COMP)
        m.run(0x6565f68)
        is_crit = not sec_kill and roll < threshold + super_rate
        multiplier = Q
        if is_crit:
            multiplier = base_value - attrs[0x6c]
            if hero:
                multiplier += player_value
                if owner & 0x58090: multiplier -= attrs[0xaa]
            if roll > threshold: multiplier += super_value
            multiplier = max(multiplier, 66191)
        assert m.read(COMP + 0x60, 1) == int(is_crit) and signed(m.read(COMP + 0x58)) == multiplier
        assert len(roll_calls) == (0 if sec_kill else 1)
        crit_coverage.update(m.visited)
        counts['crit'] += 1
        vectors['crit'].append({'source': [rate, base_value, super_rate, super_value, player_rate, player_value, owner], 'attrs': [attrs[i] for i in [0xa9, 0xb3, 0x6c, 0xaa]], 'hero': hero, 'secKill': sec_kill, 'roll': roll, 'expected': [m.read(COMP + 0x60, 1), signed(m.read(COMP + 0x58))]})

# Demonstrate the replacement gate with explicit artificial callbacks.
# This proves forwarding semantics, NOT that any online callback is installed.
for entry, slot in [(0x64090c4, 0x982d278), (0x6565f68, 0x983b118)]:
    m = base()
    info = m.read(m.read(slot))
    m.write(info + 0x53, 32, 1)
    m.write(info + 0x60, 0xf0000200)
    forwarded = []
    def replacement(v):
        forwarded.append(tuple(v.get('x' + str(i)) for i in range(8)))
        v.put('x0', 123456)
    m.hooks[0xf0000200] = replacement
    for i in range(8): m.put('x' + str(i), COMP + i)
    result = m.run(entry)
    assert result == 123456 and len(forwarded) == 1
    assert forwarded[0][0] == COMP
    if entry == 0x64090c4: assert forwarded[0] == tuple(COMP + i for i in range(8))
    assert not any(pc in m.visited for pc in [0x6409218, 0x6565fc4])
    counts['replacement_dispatch_fixture'] += 1

report = {
    'binary_sha256': image.digest,
    'counts': counts,
    'get_decrease_native_pcs_visited': len(coverage),
    'crit_native_pcs_visited': len(crit_coverage),
    'get_decrease_addresses': [hex(pc) for pc in sorted(coverage)],
    'shield_equal_damage_event_order': shield_events,
    'rng': {'multiplier': 25214903917, 'increment': 11, 'state_bits': 48, 'crit_roll_interval': '[0, 65536)', 'engineered_boundary_rolls': [0, 1, 65534, 65535], 'equal_bounds_still_advance_state': True},
    'limitations': ['Static instruction interpreter, not native runtime execution.', 'Attributes, object layout, metadata flags and external callees are fixture inputs.', 'Crit uses injected boundary rolls; the actual RNG body is checked separately.', 'Default non-null object paths only; exceptions and hotfix paths are excluded.', 'Shield state cases interpret normal/hero consumption, clear, main-weapon flags and change flags. OnShieldBreak, visual effects and AddBuff internals remain recording stubs.', 'No online capture or active override evidence.'],
}
image.close()
Path(args.output).write_text(json.dumps(report, indent=2), encoding='utf8')
if args.vectors_output:
    names = ['HurtDecrease','HurtDecreasePercent','StandHurtDecrease','StandHurtDecreasePercent','BodyHurtDecrease','BodyHurtDecreasePercent','BulletHurtDecreasePercent','HurtReduceForMonsterPercent','HurtReduceForBossPercent','HurtReduceForElitePercent','HurtReduceForPlayerPercent','HurtReduceForFlyPercent','HurtReduceForGroundPercent','FireHurtDecreasePercent','PoisonHurtDecreasePercent','IceHurtDecreasePercent','ThunderHurtDecreasePercent','ElementHurtDecreasePercent','RotateBallHurtDecreasePercent','SwardHurtDecreasePercent','StarHurtDecreasePercent','MainWeaponHurtDecreasePercent','SpriteHurtDecreasePercent','PlantHurtDecreasePercent','BallVulnerabilityPercent','FlySwardVulnerabilityPercent','StarFallVulnerabilityPercent','SpriteVulnerabilityPercent']
    vectors.update(binary_sha256=image.digest, scope='Synthetic fixtures interpreted from static native instructions; not online observations.', attribute_names=names)
    destination = Path(args.vectors_output)
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_text(json.dumps(vectors, separators=(',', ':')), encoding='utf8')
print(json.dumps({'counts': counts, 'get_decrease_native_pcs_visited': len(coverage)}))
