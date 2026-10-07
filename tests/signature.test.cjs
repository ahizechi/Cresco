const test = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("node:fs");
const { verify } = require("../tools/verify-signature.cjs");
const bytes = fs.readFileSync("tests/fixtures/updater-payload.txt");
const signature = fs
  .readFileSync("tests/fixtures/updater-payload.txt.sig", "utf8")
  .trim();
const publicKey = JSON.parse(
  fs.readFileSync("src-tauri/tauri.conf.json", "utf8"),
).plugins.updater.pubkey;
test("configured updater key authenticates the signed fixture", () =>
  assert.equal(verify(bytes, signature, publicKey), true));
test("tampered download, signature and trusted comment are rejected", () => {
  assert.throws(() =>
    verify(
      Buffer.concat([bytes, Buffer.from("tampered")]),
      signature,
      publicKey,
    ),
  );
  const lines = Buffer.from(signature, "base64")
    .toString()
    .trim()
    .split(/\r?\n/);
  const altered = Buffer.from(lines[1], "base64");
  altered[15] ^= 1;
  const changed = [...lines];
  changed[1] = altered.toString("base64");
  assert.throws(() =>
    verify(
      bytes,
      Buffer.from(changed.join("\n")).toString("base64"),
      publicKey,
    ),
  );
  lines[2] += " tampered";
  assert.throws(() =>
    verify(bytes, Buffer.from(lines.join("\n")).toString("base64"), publicKey),
  );
});
