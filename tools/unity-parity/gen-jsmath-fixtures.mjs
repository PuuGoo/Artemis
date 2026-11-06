#!/usr/bin/env node
// Sinh giá trị kỳ vọng cho test JsMath TRỰC TIẾP từ Node.js.
// Không chép tay: nếu JS đổi hành vi (hoặc tôi nhớ sai), script này lộ ra.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, "fixtures", "jsmath.json");
fs.mkdirSync(path.dirname(OUT), { recursive: true });

const roundInputs = [
  0, 0.4, 0.5, 0.6, 1.5, 2.5, 3.5, -0.4, -0.5, -1.5, -2.5,
  0.49999999999999994, 1.4999999999999998, 123.456, -123.456, 1e-9, 1 / 3,
];
const toFixedInputs = [
  [1.005, 2], [1.234, 2], [1.235, 2], [2.0, 2], [0.1 + 0.2, 2], [1.9, 2],
  [2.675, 2], [1.9 * 1.02, 2], [0.10 + 0.10, 2], [1.2345, 3], [-1.235, 2],
  [0.0005, 2], [1e-7, 2], [3.14159, 4],
];

const data = {
  round: roundInputs.map((x) => ({ input: x, expected: Math.round(x) })),
  toFixed: toFixedInputs.map(([v, d]) => ({ value: v, digits: d, expected: Number(v.toFixed(d)) })),
  hypot: [
    { args: [3, 4], expected: Math.hypot(3, 4) },
    { args: [0, 0], expected: Math.hypot(0, 0) },
    { args: [-3, -4], expected: Math.hypot(-3, -4) },
    { args: [3, 4, 12], expected: Math.hypot(3, 4, 12) },
  ],
  or: [
    { value: 0, fallback: 1, expected: Number(0) || 1 },
    { value: 0.5, fallback: 1, expected: Number(0.5) || 1 },
    { value: NaN, fallback: 1, expected: Number(NaN) || 1 },
    { value: 2.5, fallback: 1, expected: Number(2.5) || 1 },
  ],
};

fs.writeFileSync(OUT, JSON.stringify(data, null, 1) + "\n", "utf8");
console.log("Đã ghi " + path.relative(process.cwd(), OUT));
console.log("  round cases:    " + data.round.length);
console.log("  toFixed cases:  " + data.toFixed.length);
console.log("Đáng chú ý:");
for (const r of data.round) {
  if (r.input === 2.5 || r.input === -1.5 || r.input === 0.49999999999999994) {
    console.log("  Math.round(" + r.input + ") = " + r.expected);
  }
}
for (const f of data.toFixed) {
  if (f.value === 1.005 || f.value === 2.675) {
    console.log("  (" + f.value + ").toFixed(" + f.digits + ") = " + f.expected);
  }
}
