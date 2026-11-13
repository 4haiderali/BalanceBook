// Keep room for the migration request envelope around a complete backup.
export const BACKUP_BYTES = 64 * 1024 * 1024;
export const REQUEST_BYTES = BACKUP_BYTES + 64 * 1024;
export const LEDGER_BYTES = BACKUP_BYTES - 64 * 1024;
