// Packs PNG files into one .ico (PNG-compressed entries, supported by every current browser).
// usage: node make-ico.mjs out.ico a.png b.png ...
import fs from "node:fs";
import assert from "node:assert";

const [out, ...inputs] = process.argv.slice(2);
const images = inputs.map(path => {
    const data = fs.readFileSync(path);
    assert.equal(data.toString("latin1", 1, 4), "PNG", `${path} is not a PNG`);
    return { data, width: data.readUInt32BE(16), height: data.readUInt32BE(20) };
});

const header = Buffer.alloc(6 + 16 * images.length);
header.writeUInt16LE(0, 0);
header.writeUInt16LE(1, 2); // type: icon
header.writeUInt16LE(images.length, 4);
let offset = header.length;
images.forEach((image, i) => {
    const entry = 6 + 16 * i;
    header.writeUInt8(image.width >= 256 ? 0 : image.width, entry);
    header.writeUInt8(image.height >= 256 ? 0 : image.height, entry + 1);
    header.writeUInt16LE(1, entry + 4); // color planes
    header.writeUInt16LE(32, entry + 6); // bits per pixel
    header.writeUInt32LE(image.data.length, entry + 8);
    header.writeUInt32LE(offset, entry + 12);
    offset += image.data.length;
});
const ico = Buffer.concat([header, ...images.map(image => image.data)]);
fs.writeFileSync(out, ico);

// Self-check: re-read the directory and confirm each entry points at its PNG.
const check = fs.readFileSync(out);
assert.equal(check.readUInt16LE(2), 1);
assert.equal(check.readUInt16LE(4), images.length);
images.forEach((image, i) => {
    const at = check.readUInt32LE(6 + 16 * i + 12);
    assert.ok(check.subarray(at, at + image.data.length).equals(image.data));
});
console.log(`${out}: ${images.map(image => `${image.width}x${image.height}`).join(", ")}, ${check.length} bytes`);
