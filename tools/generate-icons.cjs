const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const root = path.resolve(__dirname, "..");
const result = spawnSync(
  process.execPath,
  [
    require.resolve("@tauri-apps/cli/tauri.js"),
    "icon",
    "assets/app-icon.png",
    "--output",
    "src-tauri/icons",
  ],
  { cwd: root, stdio: "inherit", windowsHide: true },
);
if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status || 1);
for (const [source, destination] of [
  ["128x128.png", "mark.png"],
  ["32x32.png", "favicon.png"],
  ["icon.ico", "favicon.ico"],
]) {
  fs.copyFileSync(
    path.join(root, "src-tauri/icons", source),
    path.join(root, "public", destination),
  );
}
console.log(
  "Generated native icons and synchronized browser branding from assets/app-icon.png.",
);
