# BalanceBook 1.2.27 validation

13 November 2026. Help update and inclusion of previously tested dependency maintenance.

| Check | Result | Evidence |
| --- | --- | --- |
| TypeScript | Pass | tsc --noEmit |
| Existing test suite | Pass | PWA, persistence, personal hosting and 31 accounting checks |
| Help content parity | Pass | Generated repository guide matches shared content; npm test checks this |
| Help rendering | Pass | React server render includes all 11 topics and matching internal links, without external link dependencies |
| Desktop/UI builds | Pass | esbuild, Vite, C# launcher/installer and Inno single-file setup |
| Desktop regressions | Pass | Local UI serving, origin checks, concurrent saves and persistence |
| Account/category operations | Pass | Rename, archive, restore and history |
| Reports | Pass | Excel/JSON, missing historical regeneration, rollover, retention and retries |
| Recovery/upgrade data | Pass | Mixed-ledger recovery against 1.2.26 server, audit, tombstones and bad-backup/corrupt-database negative tests |
| Production dependency audit | Pass | npm audit --omit=dev: zero known vulnerabilities at check time |
| Actual Windows update | Pass | Exact built single-file setup exited 0; installed product version 1.2.27; closed ledger SHA-256 unchanged |
| Native WebView2 help interaction | Blocked | Native automation action budget exhausted earlier; not repeated for this version. React rendering and bundle inclusion checked |
| Interactive setup/draft prompts | Blocked | Not repeated for 1.2.27 |

The app was updated while closed. No test transactions were added to the retained ledger. The installer remains unsigned. A full native acceptance matrix, independent second-profile recovery and confirmed OneDrive cloud upload are not claimed by this report.
