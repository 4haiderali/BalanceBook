# BalanceBook 1.2.26 validation

Release review on a Windows x64 test PC, 13 November 2026. No new feature work was included beyond release safety and generic fresh-ledger defaults. The installer and app are unsigned.

| Check | Result | Evidence and limits |
| --- | --- | --- |
| Original-code MIT license and dependency notices | Pass | LICENSE is included in source and runtime payload; existing third-party notices remain. |
| Public-source privacy cleanup | Pass | Removed personal alias maps, workbook-specific migration rules, historical checkpoint amounts and private person references. Existing stored records retain their identities. Source and bundled server/UI were scanned for removed identifiers; screenshots use synthetic data. This is a targeted audit, not a guarantee against every possible disclosure. |
| Empty ledger | Pass | Installed runtime with a new isolated data directory returned revision 1, Cash 0, no entries, no people and no audit events. This was a service-level check, not a second Windows profile. |
| TypeScript and automated checks | Pass | Typecheck; PWA, persistence, hosting and 31 accounting checks; desktop, account/category, report and mixed-ledger recovery suites passed locally. |
| Earlier-version recovery compatibility | Pass | Mixed synthetic ledger created using the available 1.2.22 runtime was recovered with the new runtime; snapshots, revision handling, correction/deletion audit and group links were checked. Invalid/corrupt/large backup cases were covered. |
| Single-file installation/update | Pass | Exact final local EXE ran on Windows in unattended mode with the app closed, exit 0. Installed ProductVersion 1.2.26. Existing SQLite SHA-256 was identical before/after. User separately completed interactive setup and replied done; title/progress text were not independently inspected in that final run. |
| Ledger after update | Pass | Revision 10; 11 entries, 9 active, 2 deleted; 20 audit events. The original earlier baseline was revision 8 with 9 entries; two deliberate test entries had since been added. Final update/uninstall/reinstall comparisons use the revision-10 database, not the older baseline. |
| Windows uninstall | Pass | Actual registered uninstaller exited 0, removed application folder and Desktop/Start menu shortcuts, retained byte-identical ledger. |
| Windows reinstall | Pass | Final EXE exited 0, restored version 1.2.26 and both shortcuts; ledger remained byte-identical. |
| Exact GitHub-downloaded installer | Pass | Downloaded the final EXE from the private GitHub draft, SHA-256 matched local output (3b90561cdcf716d381ba07d5e4816f5aa589e1ce086fc0759279c6554ee88ef0). Actual Windows install exited 0, ProductVersion 1.2.26, ledger byte-identical. |
| Fresh install and restore in a second Windows identity/VM | Blocked | No separate Windows profile/VM acceptance run was completed. Isolated service-level defaults and recovery were tested instead. |
| Open-app No/Yes and retained unsaved draft, final wrapper | Blocked | Native Windows UI helper reached its action limit. Earlier tests exercised the older setup; they do not certify every final-wrapper interaction. Unattended setup explicitly refuses an open app. |
| Final WebView2 daily-entry keyboard/dialog interactions | Blocked | Escape was verified in the preceding 1.2.25 native app. Full final-version Enter, stacked Escape, people picker, scrolling and transfer/Undo matrix was not repeated after the UI limit. |
| Report generation and missing historical workbook | Pass | Automated report suite covers monthly/yearly/summary/JSON output, missing-file regeneration, retry, rollover and retention. Synthetic React screenshots illustrate backup health. |
| OneDrive confirmed upload | Blocked | Creating a local file or using a OneDrive-named path does not establish cloud upload; no remote upload confirmation was obtained. |

## Data comparison

The closed test database SHA-256 remained `55FFD883053F0DABE124A0DD8AD0D3E92AB8EE2291AD39605C5B6B2CDE9A30D0` through final update, uninstall and reinstall. Opening a disposable copy through the installed runtime yielded snapshot SHA-256 `234afe1ece25205d99293452ff83423f2de808ffb2bfc4efde4a32cbd60825ff`. Byte identity protects all stored balances, revisions and history; it is stronger than comparing displayed totals alone.

## Windows prompts

The package is unsigned. Earlier launches showed Windows Open File security warnings; the user handled them. The final unattended installer checks do not demonstrate what SmartScreen will show on a different PC or downloaded file. The interactive wrapper has its own setup pages and removal confirmation. No signing, trusted publisher identity or SmartScreen reputation is claimed.

## Screenshots

`docs/images` contains the actual React UI rendered using isolated synthetic data in a browser preview. It is not evidence of native WebView2 acceptance or OneDrive upload. No real ledger, export path or backup is included.

