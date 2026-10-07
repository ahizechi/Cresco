const test = require("node:test"),
  assert = require("node:assert/strict");
const { validateManifest } = require("../tools/verify-public-release.cjs");
const version = "1.2.3";
const fixture = () => ({
  version,
  pub_date: "2026-10-07T12:00:00Z",
  platforms: {
    "windows-x86_64": {
      url: "https://github.com/ahizechi/Cresco/releases/download/v1.2.3/Cresco_1.2.3_x64-setup.exe",
      signature: "synthetic",
    },
  },
});
test("public update metadata pins exact stable version and installer identity", () => {
  assert.equal(validateManifest(fixture(), version).signature, "synthetic");
});
test("public verification rejects old, malformed and cross-channel metadata", () => {
  for (const change of [
    (m) => {
      m.version = "1.2.2";
    },
    (m) => {
      m.pub_date = "invalid";
    },
    (m) => {
      m.platforms = {};
    },
    (m) => {
      m.platforms["windows-x86_64"].signature = "";
    },
    (m) => {
      m.platforms["windows-x86_64"].url = "https://example.com/setup.exe";
    },
    (m) => {
      m.platforms["windows-x86_64"].url =
        "https://github.com/ahizechi/Cresco/releases/download/v1.2.2/Cresco_1.2.2_x64-setup.exe";
    },
  ]) {
    const value = fixture();
    change(value);
    assert.throws(() => validateManifest(value, version));
  }
  assert.throws(() => validateManifest(null, version));
});
