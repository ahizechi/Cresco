const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const { iconFrames } = require("../tools/verify-icons.cjs");

test("browser and installer icons consume the same generated artwork", () => {
  const config = JSON.parse(
    fs.readFileSync("src-tauri/tauri.conf.json", "utf8"),
  );
  const source = fs.readFileSync("assets/app-icon.png");
  assert.equal(source.readUInt32BE(16), source.readUInt32BE(20));
  assert.ok(source.readUInt32BE(16) >= 1024);
  for (const [source, served] of [
    ["128x128.png", "mark.png"],
    ["32x32.png", "favicon.png"],
    ["icon.ico", "favicon.ico"],
  ])
    assert.deepEqual(
      fs.readFileSync("public/" + served),
      fs.readFileSync("src-tauri/icons/" + source),
    );
  assert.ok(config.bundle.icon.includes("icons/icon.ico"));
  assert.equal(config.bundle.windows.nsis.installerIcon, "icons/icon.ico");
  assert.equal(config.bundle.windows.nsis.uninstallerIcon, "icons/icon.ico");
  for (const file of config.bundle.icon)
    assert.ok(fs.statSync("src-tauri/" + file).size > 0);
  const ico = fs.readFileSync("src-tauri/icons/icon.ico");
  const frames = iconFrames(ico);
  assert.ok(frames.some((frame) => frame.width === 32));
  assert.ok(frames.some((frame) => frame.width >= 256));
  const invalid = Buffer.from(ico);
  invalid.writeUInt32LE(ico.length + 1, 18);
  assert.throws(() => iconFrames(invalid), /bounds/);
});
