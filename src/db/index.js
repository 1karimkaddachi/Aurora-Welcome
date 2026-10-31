import { DatabaseSync } from 'node:sqlite';
import { config } from '../config.js';
import { createLogger } from '../logger.js';

const log = createLogger('db');

const migrations = [
  {
    version: 1,
    sql: `
      CREATE TABLE guilds (
        guild_id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        icon TEXT,
        owner_id TEXT,
        member_count INTEGER NOT NULL DEFAULT 0,
        bot_present INTEGER NOT NULL DEFAULT 1,
        joined_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE welcome_configs (
        guild_id TEXT PRIMARY KEY REFERENCES guilds(guild_id) ON DELETE CASCADE,
        enabled INTEGER NOT NULL DEFAULT 1,
        main_channel_id TEXT,
        secondary_channel_id TEXT,
        rules_channel_id TEXT,
        intros_channel_id TEXT,
        announcements_channel_id TEXT,
        style TEXT NOT NULL DEFAULT 'classic',
        content_json TEXT NOT NULL,
        image_json TEXT NOT NULL,
        send_mode TEXT NOT NULL DEFAULT 'public',
        bot_mode TEXT NOT NULL DEFAULT 'enabled',
        returning_mode TEXT NOT NULL DEFAULT 'returning',
        dm_content_json TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE leave_configs (
        guild_id TEXT PRIMARY KEY REFERENCES guilds(guild_id) ON DELETE CASCADE,
        enabled INTEGER NOT NULL DEFAULT 1,
        channel_id TEXT,
        style TEXT NOT NULL DEFAULT 'classic',
        content_json TEXT NOT NULL,
        image_json TEXT NOT NULL,
        send_mode TEXT NOT NULL DEFAULT 'public',
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE guild_settings (
        guild_id TEXT PRIMARY KEY REFERENCES guilds(guild_id) ON DELETE CASCADE,
        log_channel_id TEXT,
        invite_tracking INTEGER NOT NULL DEFAULT 1,
        vanity_tracking INTEGER NOT NULL DEFAULT 1,
        abuse_threshold INTEGER NOT NULL DEFAULT 6,
        abuse_window_minutes INTEGER NOT NULL DEFAULT 30,
        welcome_delay_ms INTEGER NOT NULL DEFAULT 0,
        delete_welcome_after INTEGER NOT NULL DEFAULT 0,
        dm_failure_notice INTEGER NOT NULL DEFAULT 1,
        dry_run INTEGER NOT NULL DEFAULT 0,
        ticket_channel_id TEXT,
        roles_channel_id TEXT,
        rules_text TEXT NOT NULL DEFAULT '',
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE welcome_buttons (
        id TEXT PRIMARY KEY,
        guild_id TEXT NOT NULL REFERENCES guilds(guild_id) ON DELETE CASCADE,
        scope TEXT NOT NULL DEFAULT 'welcome',
        label TEXT NOT NULL,
        emoji TEXT,
        style INTEGER NOT NULL DEFAULT 2,
        type TEXT NOT NULL DEFAULT 'url',
        url TEXT,
        enabled INTEGER NOT NULL DEFAULT 1,
        position INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE INDEX idx_buttons_guild ON welcome_buttons(guild_id, scope, position);

      CREATE TABLE auto_roles (
        id TEXT PRIMARY KEY,
        guild_id TEXT NOT NULL REFERENCES guilds(guild_id) ON DELETE CASCADE,
        role_id TEXT NOT NULL,
        target TEXT NOT NULL DEFAULT 'human',
        enabled INTEGER NOT NULL DEFAULT 1,
        delay_seconds INTEGER NOT NULL DEFAULT 0,
        position INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE INDEX idx_autoroles_guild ON auto_roles(guild_id, position);

      CREATE TABLE self_roles (
        id TEXT PRIMARY KEY,
        guild_id TEXT NOT NULL REFERENCES guilds(guild_id) ON DELETE CASCADE,
        role_id TEXT NOT NULL,
        label TEXT NOT NULL,
        emoji TEXT,
        enabled INTEGER NOT NULL DEFAULT 1,
        position INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL
      );
      CREATE INDEX idx_selfroles_guild ON self_roles(guild_id, position);

      CREATE TABLE templates (
        id TEXT PRIMARY KEY,
        guild_id TEXT NOT NULL REFERENCES guilds(guild_id) ON DELETE CASCADE,
        type TEXT NOT NULL DEFAULT 'welcome',
        name TEXT NOT NULL,
        description TEXT,
        style TEXT NOT NULL DEFAULT 'custom',
        content_json TEXT NOT NULL,
        image_json TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE INDEX idx_templates_guild ON templates(guild_id, type);

      CREATE TABLE image_templates (
        id TEXT PRIMARY KEY,
        guild_id TEXT NOT NULL REFERENCES guilds(guild_id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        background_path TEXT,
        config_json TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );

      CREATE TABLE invites (
        guild_id TEXT NOT NULL REFERENCES guilds(guild_id) ON DELETE CASCADE,
        code TEXT NOT NULL,
        inviter_id TEXT NOT NULL,
        inviter_name TEXT,
        uses INTEGER NOT NULL DEFAULT 0,
        max_uses INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        PRIMARY KEY (guild_id, code)
      );

      CREATE TABLE invite_uses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id TEXT NOT NULL,
        code TEXT NOT NULL,
        inviter_id TEXT,
        inviter_name TEXT,
        user_id TEXT NOT NULL,
        username TEXT,
        type TEXT NOT NULL DEFAULT 'normal',
        joined_at INTEGER NOT NULL
      );
      CREATE INDEX idx_invite_uses_guild ON invite_uses(guild_id, joined_at);
      CREATE INDEX idx_invite_uses_inviter ON invite_uses(guild_id, inviter_id);
      CREATE INDEX idx_invite_uses_user ON invite_uses(guild_id, user_id);

      CREATE TABLE member_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        username TEXT NOT NULL,
        display_name TEXT,
        avatar TEXT,
        is_bot INTEGER NOT NULL DEFAULT 0,
        joined_at INTEGER NOT NULL,
        left_at INTEGER,
        inviter_id TEXT,
        inviter_name TEXT,
        invite_code TEXT,
        invite_type TEXT,
        member_number INTEGER NOT NULL
      );
      CREATE INDEX idx_member_history_guild ON member_history(guild_id, joined_at);
      CREATE INDEX idx_member_history_user ON member_history(guild_id, user_id);

      CREATE TABLE join_stats (
        guild_id TEXT NOT NULL,
        day TEXT NOT NULL,
        joins INTEGER NOT NULL DEFAULT 0,
        leaves INTEGER NOT NULL DEFAULT 0,
        humans INTEGER NOT NULL DEFAULT 0,
        bots INTEGER NOT NULL DEFAULT 0,
        total_members INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (guild_id, day)
      );

      CREATE TABLE logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id TEXT NOT NULL,
        category TEXT NOT NULL,
        action TEXT NOT NULL,
        message TEXT NOT NULL,
        user_id TEXT,
        meta_json TEXT,
        created_at INTEGER NOT NULL
      );
      CREATE INDEX idx_logs_guild ON logs(guild_id, created_at DESC);
      CREATE INDEX idx_logs_category ON logs(guild_id, category, created_at DESC);

      CREATE TABLE sessions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        username TEXT NOT NULL,
        global_name TEXT,
        avatar TEXT,
        access_token TEXT,
        refresh_token TEXT,
        token_expires_at INTEGER,
        created_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL
      );
      CREATE INDEX idx_sessions_expiry ON sessions(expires_at);

      CREATE TABLE dashboard_preferences (
        user_id TEXT PRIMARY KEY,
        prefs_json TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      );
    `,
  },
];

export const db = new DatabaseSync(config.dbPath);

db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');
db.exec('PRAGMA busy_timeout = 5000;');

function migrate() {
  db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, applied_at INTEGER NOT NULL);`);
  const applied = new Set(db.prepare('SELECT version FROM schema_migrations').all().map((row) => row.version));
  for (const migration of migrations) {
    if (applied.has(migration.version)) continue;
    db.exec('BEGIN IMMEDIATE');
    try {
      db.exec(migration.sql);
      db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)').run(migration.version, Date.now());
      db.exec('COMMIT');
      log.info(`Applied migration ${migration.version}`);
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  }
}

migrate();

export function transaction(fn) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (error) {
    try {
      db.exec('ROLLBACK');
    } catch {
      /* already rolled back */
    }
    throw error;
  }
}

export const queries = {
  run(sql, ...params) {
    return db.prepare(sql).run(...params);
  },
  get(sql, ...params) {
    return db.prepare(sql).get(...params);
  },
  all(sql, ...params) {
    return db.prepare(sql).all(...params);
  },
};

export function jsonParse(value, fallback) {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

export function closeDb() {
  try {
    db.close();
  } catch {
    /* ignore */
  }
}
