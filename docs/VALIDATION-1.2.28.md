# BalanceBook 1.2.28 validation

17 November 2026. Escape handling across stacked dialogs.

- Pass: TypeScript and existing PWA, persistence, authentication and 31 accounting checks.
- Pass: DOM regression tests close the child and then the parent; respect CSS stacking; skip hidden overlays; consume repeated, busy, disabled or unclosable top-dialog Escape without closing a lower dialog; reuse the normal draft close callback.
- Pass: close registration coverage for every app modal overlay, including category details, group receipts, deletion, shortcuts, refund/recovery and month links.
- Pass: desktop server, Vite UI, C# launcher/installer and Inno single-file setup builds.
- Pass: desktop persistence, concurrent save/origin checks, account/category operations, automatic reports and mixed-ledger recovery against 1.2.27.
- Pass: compatible Next.js/eslint-config-next 16.4.6 patch; npm reported zero known vulnerabilities after installation.
- Pass: exact built single-file installer exited 0 on the test PC; installed product version is 1.2.28; closed ledger SHA-256 was unchanged.
- Partial native check: actual WebView2 title showed BalanceBook 1.2.28, category page and category details opened. Child-dialog click was outside window bounds. The user then pressed physical Escape, stopping Computer Use. Native child-then-parent behavior was therefore not verified; the automated DOM check passed.

Installer remains unsigned. No transactions were saved by this check. Full interactive installer/draft acceptance, second-profile recovery and confirmed OneDrive upload were not repeated.
