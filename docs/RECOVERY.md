# Recovery and data locations

- Program: `%LOCALAPPDATA%\Programs\HaiderMoney` (legacy directory retained for compatibility).
- Ledger and SQLite history: `%LOCALAPPDATA%\HaiderMoney\Data`.
- Before-update copy: `%LOCALAPPDATA%\HaiderMoney\Before latest update`.
- Former database after recovery: `%LOCALAPPDATA%\HaiderMoney\Data.recovery-original` or a separately named recovery folder.
- Exported JSON: the folder you chose; automatic files are under its Backups subfolder.

Keep verified JSON on another device or independent storage. For recovery, open Backup & recovery, select Recover from JSON backup, inspect counts/balances and confirm. On startup failure, use the recovery option in the startup dialog. Never overwrite a failing database before preserving a copy.

Uninstall retains all these data locations and external exports. Reinstall uses the existing ledger. To start a separate empty ledger, preserve verified backups and arrange a separate Windows profile; do not delete records merely to follow an example.

Already-migrated older ledgers keep their own account/person identities and audit. The public app does not contain or reapply an individual's name-merging, bank-allocation or historical-checkpoint rules.
