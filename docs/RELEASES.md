# Cresco releases

The updater is a Tauri 2 signed installer workflow, using a dedicated signing key and a fixed HTTPS GitHub Releases endpoint. It never uses another application?s update channel or signing key.

## Local release

1. Update package.json, src-tauri/Cargo.toml and src-tauri/tauri.conf.json to the same new semver version. Add CHANGELOG.md notes. Never change the app identifier or public signing key for routine updates.
2. Run typecheck, privacy tests, browser journeys, production CSP checks and native tests/Clippy.
3. Run npm.cmd run release:build. The helper reads the dedicated password-protected key from the current user?s .cresco folder (or CI environment secrets). It clears signing environment variables afterwards. It builds without installing or launching anything, then validates the installer identity, version and signature metadata.
4. The output folder src-tauri/target/release/bundle/nsis contains the installer, its .sig, latest.json and SHA256SUMS.txt. Upload all four to a **draft** release tagged vVERSION in ahizechi/Cresco. Verify each asset and publish only after checks pass. Publishing latest.json before its installer exists would break updates. Never edit, Authenticode-sign or otherwise modify an installer after producing its updater signature; any changed bytes require a fresh updater signature.

## GitHub Actions

CI validates pull requests and pushes to main. Push a new stable vVERSION tag after updating the three version files and changelog. A normal source push does not publish an update. The tag starts the release workflow, using the configured repository secrets TAURI_SIGNING_PRIVATE_KEY and TAURI_SIGNING_PRIVATE_KEY_PASSWORD. It runs all checks on Windows, builds a signed installer and uploads all four assets to a draft. It downloads them again, compares every SHA256 and verifies the installer signature before automatically publishing the stable release. Failed checks leave the previous published update available. An older delayed build cannot replace a newer stable release. Actions are pinned to reviewed commit IDs. Dependencies use committed npm and Cargo lockfiles.

Users only install Cresco_VERSION_x64-setup.exe. The installer contains the frontend, native application and required application resources, and handles WebView2 setup if missing (internet required for that prerequisite). Users need no Node, Rust, source checkout, separate updater or companion app. Future updates use the same application identity and signing key and replace the installed application while retaining its records. Detection is automatic; installation waits for the user's Install update and restart action.

The first public release supplies latest.json. Before that, update checks report an unavailable check rather than pretending that the app is up to date. Ordinary offline failures never block data access. Prerelease drafts are not served to the stable updater. Do not downgrade by replacing latest.json with an older version; publish a higher-version corrective release.

## Key custody and recovery

Keep offline backups of the original private key and its password. Losing them prevents updates trusted by installed copies. Never reuse keys from another app, commit private keys/passwords, print them in logs, or put them in release assets. GitHub receives them only through encrypted Actions secrets. The public verification key is compiled into the app.

## Runtime safety

An update is never installed merely because a check succeeds. The user chooses install/restart. Accepted writes are drained first; new edits are paused. Native code then validates stores and copies their encrypted files into a uniquely named update-backups folder, and blocks native writes before starting the signed installer. If preparation, download or verification fails, editing resumes and the current data stays intact. Updates do not delete, move, reset or import application data. Atomic writes, previous copies and revision rejection continue across app versions.

Recovery copies are bound to the same Windows account. Portable JSON exports are the supported transfer path between PCs/accounts. Changing stored schemas requires compatible readers and explicit migrations with recovery evidence. Tests do not establish an installed Windows upgrade/restart journey; release smoke testing must verify that separately.

Backup restores participate in the same pending-save gate as ordinary edits. Preparation failures and download/signature failures resume editing only after native cancellation succeeds. A failed native cancellation keeps editing locked and asks the user to reopen Cresco. The release workflow can retry an incomplete draft, but never overwrites a published release. After publishing, it also verifies the public latest.json, installer, separate signature and checksum through unauthenticated downloads. Run npm.cmd run release:verify to repeat that public check locally.
