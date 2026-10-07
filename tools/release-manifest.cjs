const fs = require("node:fs"),
  path = require("node:path"),
  crypto = require("node:crypto");
function create(directory) {
  const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
  const config = JSON.parse(
    fs.readFileSync("src-tauri/tauri.conf.json", "utf8"),
  );
  const cargo = fs
    .readFileSync("src-tauri/Cargo.toml", "utf8")
    .match(/^version = "([^"]+)"/m)?.[1];
  if (
    !/^\d+\.\d+\.\d+$/.test(pkg.version) ||
    config.version !== pkg.version ||
    cargo !== pkg.version
  )
    throw Error("Package, native and installer versions must match.");
  const exes = fs.readdirSync(directory).filter((s) => s.endsWith(".exe"));
  if (exes.length !== 1) throw Error("Expected exactly one Windows installer.");
  const file = exes[0];
  if (
    !file.startsWith("Cresco_" + pkg.version + "_") ||
    !file.endsWith("_x64-setup.exe")
  )
    throw Error("Unexpected installer identity.");
  const bytes = fs.readFileSync(path.join(directory, file));
  if (bytes[0] !== 77 || bytes[1] !== 90 || bytes.length < 100000)
    throw Error("Invalid Windows installer.");
  const signature = fs
    .readFileSync(path.join(directory, file + ".sig"), "utf8")
    .trim();
  const decoded = Buffer.from(signature, "base64").toString();
  if (
    !decoded.includes("trusted comment:") ||
    !decoded.includes("untrusted comment:")
  )
    throw Error("Missing Minisign signature.");
  require("./verify-signature.cjs").verify(
    bytes,
    signature,
    config.plugins.updater.pubkey,
  );
  const url =
    "https://github.com/ahizechi/Cresco/releases/download/v" +
    pkg.version +
    "/" +
    encodeURIComponent(file);
  const manifest = {
    version: pkg.version,
    notes:
      fs
        .readFileSync("CHANGELOG.md", "utf8")
        .split("## " + pkg.version)[1]
        ?.split("\n## ")[0]
        ?.trim() || "Cresco update.",
    pub_date: new Date().toISOString(),
    platforms: { "windows-x86_64": { signature, url } },
  };
  fs.writeFileSync(
    path.join(directory, "latest.json"),
    JSON.stringify(manifest, null, 2) + "\n",
  );
  const checksum = crypto.createHash("sha256").update(bytes).digest("hex");
  fs.writeFileSync(
    path.join(directory, "SHA256SUMS.txt"),
    checksum + "  " + file + "\n",
  );
  return manifest;
}
if (require.main === module) {
  const directory = process.argv[2] || "src-tauri/target/release/bundle/nsis";
  create(directory);
  console.log("Validated installer, signature metadata and updater manifest.");
}
module.exports = { create };
