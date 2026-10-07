const test = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path");
const config = JSON.parse(fs.readFileSync("src-tauri/tauri.conf.json", "utf8"));
function files(dir) {
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .flatMap((e) =>
      e.isDirectory()
        ? files(path.join(dir, e.name))
        : [path.join(dir, e.name)],
    );
}
test("independent identity, installer and signed update endpoint", () => {
  assert.equal(config.identifier, "app.cresco.desktop");
  assert.equal(config.productName, "Cresco");
  assert.equal(config.bundle.windows.nsis.installMode, "currentUser");
  assert.equal(config.bundle.windows.allowDowngrades, false);
  assert.equal(config.bundle.resources["../LICENSE"], "LICENSE.txt");
  assert.equal(config.bundle.createUpdaterArtifacts, true);
  assert.deepEqual(config.plugins.updater.endpoints, [
    "https://github.com/ahizechi/Cresco/releases/latest/download/latest.json",
  ]);
  assert.match(
    Buffer.from(config.plugins.updater.pubkey, "base64").toString(),
    /minisign public key/,
  );
});
test("source has no private product identities, paths, service ports or secrets", () => {
  const forbidden =
    /dev[.]zek|master-desktop|MASTERFIN1|[A-Z]:[\\/](01-Code|Users)|:17880|:17861|:1787[012]|tailscale|supabase|BEGIN.*PRIVATE KEY/i;
  for (const file of [
    ...files("src"),
    ...files("src-tauri/src"),
    ...files("public"),
  ]) {
    if (/\.(woff2|png|ico)$/.test(file)) continue;
    assert.ok(!forbidden.test(fs.readFileSync(file, "utf8")), file);
  }
});
test("only named tracking commands and bounded updater capabilities are exposed", () => {
  const capability = JSON.parse(
    fs.readFileSync("src-tauri/capabilities/main.json", "utf8"),
  );
  assert.deepEqual(capability.windows, ["main"]);
  assert.ok(!capability.remote);
  const allow = new Set(
    [
      "finance_load",
      "finance_save",
      "finance_recover",
      "finance_export",
      "habits_load",
      "habits_save",
      "habits_export",
      "routines_load",
      "routines_save",
      "routines_export",
      "routines_restore",
      "prepare_update",
      "cancel_update",
    ].map((s) => "allow-" + s.replaceAll("_", "-")),
  );
  const plugins = new Set([
    "updater:allow-check",
    "updater:allow-download-and-install",
    "core:resources:allow-close",
  ]);
  for (const p of capability.permissions)
    assert.ok(allow.has(p) || plugins.has(p), p);
  assert.equal(capability.permissions.length, allow.size + plugins.size);
});
test("empty stores and independent browser keys", () => {
  const seed = JSON.parse(fs.readFileSync("src/app/empty-view.json", "utf8"));
  for (const key of ["habits", "txns", "accounts", "routines"])
    assert.deepEqual(seed[key], []);
  assert.equal(seed.profile.name, "");
  for (const p of [
    "src/features/finance/storage.ts",
    "src/features/habits/storage.ts",
    "src/app/core/prefs.ts",
  ])
    assert.match(fs.readFileSync(p, "utf8"), /cresco-/);
  assert.match(
    fs.readFileSync("src-tauri/src/private_store.rs", "utf8"),
    /CRESCO0001/,
  );
});
