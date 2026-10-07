# Changelog

## 0.1.4

- Give the project page a clearer introduction to habits, money tracking, privacy and getting started.
- Include the latest interface stylesheet cleanup.
- Keep the verified Windows installer and update process from 0.1.3.

## 0.1.3

- Include backup restores in update save draining and block restores during installation.
- Resume editing safely after failed saves, preparation or downloads; require reopening if native cancellation fails.
- Keep update operations locked after the installer starts and preserve flushed encrypted recovery copies.
- Protect routine edits from refresh races and reject duplicate or unsafe routine values.
- Preserve all routine history at the storage limit instead of dropping the oldest run on restart.
- Bundle Cresco's MIT licence with the installed application and disable downgrade installation in new installers.
- Verify uploaded and public release assets before and after automatic stable publication; support retrying incomplete drafts.
- Add updater failure/retry tests and native recovery-copy tests.

## 0.1.1

- First public installer release.
- Pin portable source line endings so fresh Windows checkouts pass the same checks as local builds.

## 0.1.0

- Initial Windows release with daily habits, measured check-ins, history, ongoing timers and streaks.
- Local accounts, statement CSV review/import, merchant rules, transactions, budgets, goals, scheduled bills and reconciliation.
- Encrypted local records, portable backups, recovery from unreadable files, light/dark themes and reduced motion.
- Signed GitHub updates with progress, save draining and encrypted recovery copies.
