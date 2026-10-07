const fs = require("node:fs"),
  crypto = require("node:crypto");
const { verify } = require("./verify-signature.cjs");
function validateManifest(manifest, version) {
  const url =
    "https://github.com/ahizechi/Cresco/releases/download/v" +
    version +
    "/Cresco_" +
    version +
    "_x64-setup.exe";
  const platform = manifest?.platforms?.["windows-x86_64"];
  if (
    manifest?.version !== version ||
    !Number.isFinite(Date.parse(manifest?.pub_date)) ||
    platform?.url !== url ||
    typeof platform?.signature !== "string" ||
    !platform.signature.trim()
  )
    throw Error(
      "Public update manifest is incomplete or points to the wrong release.",
    );
  return platform;
}
async function verifyPublicRelease() {
  const version = JSON.parse(fs.readFileSync("package.json", "utf8")).version;
  const config = JSON.parse(
    fs.readFileSync("src-tauri/tauri.conf.json", "utf8"),
  );
  const get = async (url, limit) => {
    const response = await fetch(url, { signal: AbortSignal.timeout(120000) });
    if (!response.ok) throw Error("Release asset HTTP " + response.status);
    const length = Number(response.headers.get("content-length") || 0);
    if (length > limit) throw Error("Release asset exceeds its size limit.");
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length > limit)
      throw Error("Release asset exceeds its size limit.");
    return bytes;
  };
  const manifest = JSON.parse(
    (await get(config.plugins.updater.endpoints[0], 65536)).toString(),
  );
  const platform = validateManifest(manifest, version);
  const [bytes, signature, sums] = await Promise.all([
    get(platform.url, 512 * 1024 * 1024),
    get(platform.url + ".sig", 8192),
    get(new URL("SHA256SUMS.txt", platform.url).href, 8192),
  ]);
  if (bytes.length < 100000 || bytes[0] !== 77 || bytes[1] !== 90)
    throw Error("Public installer is not a Windows executable.");
  if (signature.toString().trim() !== platform.signature.trim())
    throw Error("Public signature and manifest differ.");
  verify(bytes, platform.signature, config.plugins.updater.pubkey);
  const hash = crypto.createHash("sha256").update(bytes).digest("hex");
  const expected = hash + "  Cresco_" + version + "_x64-setup.exe";
  if (sums.toString().trim() !== expected)
    throw Error("Public installer checksum differs.");
  return { version, bytes: bytes.length, sha256: hash, signature: "verified" };
}
if (require.main === module)
  verifyPublicRelease()
    .then((result) => console.log(JSON.stringify(result)))
    .catch((error) => {
      console.error(error.message);
      process.exitCode = 1;
    });
module.exports = { validateManifest, verifyPublicRelease };
