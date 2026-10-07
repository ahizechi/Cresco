# Cresco

Your habits. Your money. A local Windows app with a React interface and a Tauri native shell.

## Download

Get the Windows x64 installer from [Releases](https://github.com/ahizechi/Cresco/releases). Updates are checked after startup and every four hours. Settings also offers a manual check. An available update shows a notice; **Install update and restart** finishes pending saves, preserves encrypted recovery copies, verifies the download signature and starts the installer. Offline update checks never prevent local tracking.

## Features

- Daily and weekday habits, measured targets, notes, skips, pauses, archive, history and streaks.
- Ongoing timers and day streaks with pause, stop, restart and retained history.
- Accounts, integer-money transactions, transfers, statement reconciliation and reviewed CSV imports.
- Local merchant rules, budgets, savings goals and scheduled bills/income.
- Portable JSON backups, unreadable-file recovery, light/dark themes, keyboard navigation and reduced motion.

GBP overview figures only include GBP accounts. Other account currencies remain attached to their records; values are never converted with an invented exchange rate. Bank connections and cloud/phone sync are not included.

## Privacy and storage

Records start empty. Windows storage is encrypted for the current Windows account using DPAPI, under the app?s own roaming data folder, **app.cresco.desktop**. Existing files are preserved on failed reads. Writes reject stale revisions and retain previous encrypted copies. Settings backups are unencrypted JSON and should be stored privately. Update recovery copies are encrypted and kept under the same app data folder. No financial or habit records are sent to GitHub; the updater only checks release metadata and downloads installers. No analytics or account login.

The browser preview has separate, unencrypted **cresco-** browser storage and cannot read installed desktop records. Automated tests use disposable browser contexts and synthetic fixtures.

## Development

Install Node 22.12+ and Rust stable (MSVC), Visual Studio C++ Build Tools, and WebView2 on Windows.

```powershell
npm.cmd ci
npm.cmd run dev
npm.cmd run typecheck
npm.cmd run test:privacy
npm.cmd run test:ui
npm.cmd run build
npm.cmd run test:csp
npm.cmd run app:test
npm.cmd run app:check
```

Development binds to 127.0.0.1:1462. Tests use a separate owned port and never reuse another server. An optional ignored tools/windows-toolchain.local.json can point at an installed toolchain. Builds do not install or launch the app.

## Releases

See [the release guide](docs/RELEASES.md). Builds are signed with a dedicated updater key; its private half stays out of source control. The signature protects update integrity. It is separate from a Windows Authenticode certificate, which is not configured for this release; Windows may show an unknown-publisher prompt.

## Licence

MIT licensed; see [LICENSE](LICENSE). Geist fonts and other dependencies retain their licences listed in THIRD-PARTY-NOTICES.txt.
