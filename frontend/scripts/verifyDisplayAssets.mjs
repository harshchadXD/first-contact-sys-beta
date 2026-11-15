import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";

const bytes = await readFile(
  new URL("../public/models/lro-satellite.glb", import.meta.url),
);
assert.equal(bytes.toString("ascii", 0, 4), "glTF");
const length = bytes.readUInt32LE(12);
const gltf = JSON.parse(bytes.toString("utf8", 20, 20 + length));
const binary = bytes.subarray(28 + length);
await MeshoptDecoder.ready;
let decoded = 0;
for (const view of gltf.bufferViews) {
  const ext = view.extensions?.EXT_meshopt_compression;
  if (!ext) continue;
  assert.equal(ext.buffer, 0);
  const output = new Uint8Array(ext.count * ext.byteStride);
  const source = binary.subarray(
    ext.byteOffset ?? 0,
    (ext.byteOffset ?? 0) + ext.byteLength,
  );
  MeshoptDecoder.decodeGltfBuffer(
    output,
    ext.count,
    ext.byteStride,
    source,
    ext.mode,
    ext.filter,
  );
  decoded++;
}
assert.ok(decoded > 0, "Expected compressed LRO buffers");
for (const name of ["earth-blue-marble.jpg", "moon-bump-1k.jpg"]) {
  const image = await readFile(
    new URL("../public/textures/" + name, import.meta.url),
  );
  assert.equal(image.readUInt16BE(0), 0xffd8, name + " must be JPEG");
}
console.log(
  `Display assets PASS: ${decoded} LRO buffers decoded and JPEG signatures verified.`,
);
