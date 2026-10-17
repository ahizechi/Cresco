const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const root = path.resolve(__dirname, "..");
const digest = (bytes) =>
  crypto.createHash("sha256").update(bytes).digest("hex");

function iconFrames(bytes) {
  assert.equal(bytes.readUInt32LE(0), 0x10000, "Invalid ICO header");
  const count = bytes.readUInt16LE(4);
  assert.ok(count > 0 && count <= 256, "Invalid ICO frame count");
  assert.ok(bytes.length >= 6 + count * 16, "Truncated ICO directory");
  const frames = [];
  for (let index = 0; index < count; index++) {
    const entry = 6 + index * 16;
    const width = bytes[entry] || 256;
    const height = bytes[entry + 1] || 256;
    const length = bytes.readUInt32LE(entry + 8);
    const start = bytes.readUInt32LE(entry + 12);
    assert.ok(
      start >= 6 + count * 16 && length > 0 && start + length <= bytes.length,
      "Invalid ICO image bounds",
    );
    const image = bytes.subarray(start, start + length);
    if (image.subarray(0, 8).equals(Buffer.from("89504e470d0a1a0a", "hex"))) {
      assert.equal(image.readUInt32BE(16), width);
      assert.equal(image.readUInt32BE(20), height);
    } else {
      assert.ok(image.readUInt32LE(0) >= 40, "Unsupported ICO bitmap header");
      assert.equal(image.readInt32LE(4), width);
      assert.equal(image.readInt32LE(8), height * 2);
    }
    frames.push({ width, height, length, hash: digest(image) });
  }
  assert.equal(
    new Set(frames.map((frame) => `${frame.width}x${frame.height}`)).size,
    count,
    "Duplicate ICO sizes",
  );
  return frames;
}

function verifyPeIcons(file, expected) {
  const pe = fs.readFileSync(file);
  assert.equal(pe.toString("ascii", 0, 2), "MZ", "Not a Windows executable");
  const header = pe.readUInt32LE(0x3c);
  assert.equal(pe.toString("ascii", header, header + 4), "PE\0\0");
  const optional = header + 24;
  const sections = optional + pe.readUInt16LE(header + 20);
  const magic = pe.readUInt16LE(optional);
  assert.ok(magic === 0x20b || magic === 0x10b, "Invalid PE optional header");
  const directory = optional + (magic === 0x20b ? 112 : 96);
  function fileOffset(rva) {
    for (let i = 0; i < pe.readUInt16LE(header + 6); i++) {
      const section = sections + i * 40;
      const start = pe.readUInt32LE(section + 12);
      const size = pe.readUInt32LE(section + 16);
      if (rva >= start && rva < start + size)
        return pe.readUInt32LE(section + 20) + rva - start;
    }
    throw Error("PE resource points outside file sections");
  }
  const resourceRva = pe.readUInt32LE(directory + 16);
  assert.ok(resourceRva, "No PE resources");
  const resourceLength = pe.readUInt32LE(directory + 20);
  const base = fileOffset(resourceRva);
  const resources = [];
  const visited = new Set();
  function walk(relative, ids) {
    assert.ok(
      ids.length < 3 && !visited.has(relative),
      "Invalid PE resource tree",
    );
    visited.add(relative);
    const offset = base + relative;
    const count = pe.readUInt16LE(offset + 12) + pe.readUInt16LE(offset + 14);
    assert.ok(
      count <= 4096 && relative + 16 + count * 8 <= resourceLength,
      "Invalid PE resource directory",
    );
    for (let i = 0; i < count; i++) {
      const entry = offset + 16 + i * 8;
      const id = pe.readUInt32LE(entry);
      const next = pe.readUInt32LE(entry + 4);
      if (next & 0x80000000) walk(next & 0x7fffffff, [...ids, id]);
      else {
        assert.ok(
          next + 16 <= resourceLength,
          "Invalid PE resource data entry",
        );
        const data = base + next;
        const start = fileOffset(pe.readUInt32LE(data));
        const length = pe.readUInt32LE(data + 4);
        assert.ok(start + length <= pe.length, "Truncated PE resource");
        resources.push({
          ids: [...ids, id],
          bytes: pe.subarray(start, start + length),
        });
      }
    }
  }
  walk(0, []);
  const groups = resources.filter((resource) => resource.ids[0] === 14);
  assert.ok(groups.length, "No application icon group");
  for (const group of groups) {
    assert.equal(
      group.bytes.readUInt16LE(4),
      expected.length,
      "Missing icon sizes",
    );
    const actual = [];
    for (let index = 0; index < expected.length; index++) {
      const entry = 6 + index * 14;
      const resourceId = group.bytes.readUInt16LE(entry + 12);
      const image = resources.find(
        (resource) =>
          resource.ids[0] === 3 &&
          resource.ids[1] === resourceId &&
          resource.ids[2] === group.ids[2],
      );
      assert.ok(image, "Missing embedded icon image");
      actual.push({
        width: group.bytes[entry] || 256,
        height: group.bytes[entry + 1] || 256,
        length: group.bytes.readUInt32LE(entry + 8),
        hash: digest(image.bytes),
      });
    }
    const sorted = (frames) =>
      [...frames].sort((a, b) => a.width - b.width || a.height - b.height);
    assert.deepEqual(
      sorted(actual),
      sorted(expected),
      "Embedded icon sizes or artwork differ",
    );
  }
  return {
    file,
    sizes: expected.map(({ width, height }) => `${width}x${height}`),
    groups: groups.length,
  };
}

if (require.main === module) {
  const version = JSON.parse(
    fs.readFileSync(path.join(root, "package.json"), "utf8"),
  ).version;
  const files = process.argv.slice(2);
  const expected = iconFrames(
    fs.readFileSync(path.join(root, "src-tauri/icons/icon.ico")),
  );
  const results = (
    files.length
      ? files
      : [
          path.join(root, "src-tauri/target/release/cresco-desktop.exe"),
          path.join(
            root,
            `src-tauri/target/release/bundle/nsis/Cresco_${version}_x64-setup.exe`,
          ),
        ]
  ).map((file) => verifyPeIcons(file, expected));
  console.log(JSON.stringify(results, null, 2));
}
module.exports = { iconFrames, verifyPeIcons };
