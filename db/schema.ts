import { sqliteTable, text, integer, primaryKey } from 'drizzle-orm/sqlite-core';
export const ledgerVersions = sqliteTable('ledger_versions', {
  owner: text('owner').notNull(), revision: integer('revision').notNull(),
  data: text('data').notNull(), createdAt: text('created_at').notNull(), reason: text('reason').notNull(),
}, t => [primaryKey({ columns: [t.owner, t.revision] })]);

export const ledgerBlocks = sqliteTable('ledger_blocks', {
  owner: text('owner').notNull(), hash: text('hash').notNull(), data: text('data').notNull(),
}, t => [primaryKey({ columns: [t.owner, t.hash] })]);

export const authSessions = sqliteTable('auth_sessions', {
  tokenHash:text('token_hash').primaryKey(), owner:text('owner').notNull(),email:text('email').notNull(),name:text('name').notNull(),expiresAt:integer('expires_at').notNull(),
});
export const migrationImports = sqliteTable('migration_imports', {
  owner:text('owner').primaryKey(),backupHash:text('backup_hash').notNull(),createdAt:text('created_at').notNull(),revision:integer('revision').notNull(),
});
