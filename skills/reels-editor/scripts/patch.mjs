// Mede cor média de um retângulo de um PNG: node patch.mjs img x y w h
import { execSync } from "node:child_process";
const [f, x, y, w, h] = process.argv.slice(2);
const b = execSync(`ffmpeg -loglevel error -i "${f}" -vf "crop=${w}:${h}:${x}:${y},scale=1:1:flags=area,format=rgb24" -f rawvideo -`);
const [r, g, bl] = [...b];
const lin = (c) => ((c /= 255) <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const [R, G, B] = [lin(r), lin(g), lin(bl)];
const X = (0.4124 * R + 0.3576 * G + 0.1805 * B) / 0.95047, Y = 0.2126 * R + 0.7152 * G + 0.0722 * B, Z = (0.0193 * R + 0.1192 * G + 0.9505 * B) / 1.08883;
const fn = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
const L = 116 * fn(Y) - 16, a = 500 * (fn(X) - fn(Y)), bb = 200 * (fn(Y) - fn(Z));
const mx = Math.max(r, g, bl) / 255, mn = Math.min(r, g, bl) / 255, d = mx - mn;
let hue = 0; if (d) { hue = mx === r / 255 ? ((g - bl) / 255 / d) % 6 : mx === g / 255 ? (bl - r) / 255 / d + 2 : (r - g) / 255 / d + 4; hue *= 60; if (hue < 0) hue += 360; }
console.log(`RGB ${r},${g},${bl}  Lab L=${L.toFixed(0)} a=${a.toFixed(1)} b=${bb.toFixed(1)}  hue=${hue.toFixed(0)}° sat=${(mx ? d / mx : 0).toFixed(2)}`);
