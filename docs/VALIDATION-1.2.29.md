# BalanceBook 1.2.29 validation

19 November 2026. Transfer category correction.

## Bug

Open a transfer from Accounts or change an expense form to Transfer. The hidden category could retain Food from the expense defaults. The saved transfer showed Food despite having zero spending effect. New transfers now discard that category at entry preparation and server save; the transaction table shows no expense category for transfers.

## Historical correction

On normal app startup, a revision-checked API operation repairs existing modern transfers and known legacy transfer types, including deleted entries. It changes category metadata only, preserves original imported values, and appends ordinary audit records and a saved revision. Prior revisions and audit remain intact. Actual expenses are not reclassified. Imported backups containing the old metadata are handled on the next app startup. Ordinary saves also remove stale transfer categories.

Setup probe launches skip this repair so installer verification compares the original ledger before any migration. An initial candidate was correctly refused by the installer because its probe ran the repair; no installed files or live data changed. The corrected final installer passed.

## Results

- Pass: new/stale-draft transfers, active/deleted/legacy repairs, immutable imported originals, audit and repeat safety.
- Pass: desktop API test restores a synthetic old-category backup, repairs with a new revision, checks exact prior snapshot, unchanged balances/spending, idempotent retry and stale-revision rejection.
- Pass: TypeScript, Escape DOM regression, guide parity, PWA, persistence/auth and 31 accounting checks.
- Pass: desktop/UI/C# and single-file installer builds.
- Pass: desktop/account/report/recovery regression checks against 1.2.28, including corrupt-database negative tests.
- Pass: final single-file installer exit 0; ledger bytes unchanged during installation, before repair.
- Pass: installed server repaired one affected test-ledger transfer, revision 11 to 12, with 12 entries retained. Account balances, monthly reports, effects, amounts, dates, links, tombstones and the exact revision-11 snapshot were preserved. A private full JSON backup was saved before repair.
- Not repeated: native Windows clicking through transfer creation, interactive setup/draft prompts, second-profile recovery and OneDrive cloud upload.

Old audit snapshots, saved versions and previously exported files are retained rather than rewritten. Automatic reports regenerate from corrected current entries. Manual exports must be made again to produce corrected files. Installer remains unsigned.
