# Installation and removal

The single-file installer extracts a verified runtime payload to a temporary directory. The existing app installer checks hashes, stages ledger verification, requests a normal close, and replaces program files only after verification. Cancellation/failure returns a nonzero result to the wrapper.

After success, the wrapper registers BalanceBook under Windows Installed apps. Its small setup/uninstall support directory is `%LOCALAPPDATA%\Programs\BalanceBookSetup`. It is separate from the program and data.

Uninstall refuses to proceed while BalanceBook holds its instance mutex. Close it normally and rerun uninstall. Confirmed uninstall removes program files and BalanceBook shortcuts, but keeps ledger/history, backups and preferences. Reinstall reopens retained records.

A fresh install means a Windows identity without an existing BalanceBook data folder. Installing after removal with retained data is a reinstall, not a fresh ledger. The release validation report distinguishes these cases.
