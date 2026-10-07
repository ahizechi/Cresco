const crypto = require("node:crypto");
function verify(bytes, signatureBase64, publicKeyBase64) {
  const pubLines = Buffer.from(publicKeyBase64, "base64")
    .toString("utf8")
    .trim()
    .split(/\r?\n/);
  const pub = Buffer.from(pubLines[1] || "", "base64");
  const sigLines = Buffer.from(signatureBase64, "base64")
    .toString("utf8")
    .trim()
    .split(/\r?\n/);
  const sig = Buffer.from(sigLines[1] || "", "base64");
  if (
    pub.length !== 42 ||
    sig.length !== 74 ||
    sigLines.length !== 4 ||
    !sigLines[2].startsWith("trusted comment: ")
  )
    throw Error("Malformed update signing material.");
  if (!pub.subarray(2, 10).equals(sig.subarray(2, 10)))
    throw Error("Signature belongs to another signing key.");
  if (
    !["Ed", "ED"].includes(pub.subarray(0, 2).toString()) ||
    sig.subarray(0, 2).toString() !== "ED"
  )
    throw Error("Only prehashed Minisign signatures are accepted.");
  const key = crypto.createPublicKey({
    key: Buffer.concat([
      Buffer.from("302a300506032b6570032100", "hex"),
      pub.subarray(10),
    ]),
    format: "der",
    type: "spki",
  });
  const digest = crypto.createHash("blake2b512").update(bytes).digest();
  if (!crypto.verify(null, digest, key, sig.subarray(10)))
    throw Error("Installer signature verification failed.");
  const comment = Buffer.from(sigLines[2].slice("trusted comment: ".length));
  const global = Buffer.from(sigLines[3], "base64");
  if (
    global.length !== 64 ||
    !crypto.verify(
      null,
      Buffer.concat([sig.subarray(10), comment]),
      key,
      global,
    )
  )
    throw Error("Signature comment verification failed.");
  return true;
}
module.exports = { verify };
