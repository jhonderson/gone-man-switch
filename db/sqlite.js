const sqlite3 = require("sqlite3");
const sqlite = require("sqlite");

const systemSettings = require('../services/system').getSystemSettings();

let db;

async function initializeDatabase() {
  if (!db) {
    db = await sqlite.open({
      filename: systemSettings.sqlite.path,
      driver: sqlite3.Database,
      mode: sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE
    });
    await runMigrations();
    await createTables();
  }
}

async function runMigrations() {
  await moveLastCheckinColumnToUserLevel();
}

/**
 * Move the column last_checkin_at from the messages table to the users table.
 */
async function moveLastCheckinColumnToUserLevel() {
  if (await doesTableExist('users') && !await doesTableContainColumn('users', 'last_checkin_at', 'TEXT')) {
    /**
     * users table
     */
    await db.run('ALTER TABLE users ADD COLUMN last_checkin_at TEXT');
    const allUsers = await db.all('SELECT id FROM users');
    for (const { id } of allUsers) {
      const result = await db.get(`
        SELECT last_checkin_at AS mostRecentCheckin
        FROM messages
        WHERE user_id = '${id}'
        ORDER BY 1 DESC
        LIMIT 1`);
      const mostRecentCheckin = result?.mostRecentCheckin || new Date().toISOString();
      await db.run('UPDATE users SET last_checkin_at = ? WHERE id = ?', mostRecentCheckin, id);
    }

    /**
     * messages table
     */
    await db.run('ALTER TABLE messages DROP COLUMN last_checkin_at');
    await db.run('ALTER TABLE messages DROP COLUMN checkin_status');

    /**
     * checkin_notifications table
     */
    await db.run(
      `CREATE TABLE IF NOT EXISTS checkin_notifications_temp (
                id TEXT PRIMARY KEY,
                message_id TEXT,
                user_id TEXT,
                sent_at TEXT
            )`);

    await db.run(`
      INSERT INTO checkin_notifications_temp (id, message_id, user_id, sent_at)
      SELECT checkin_notifications.id, checkin_notifications.message_id, messages.user_id AS userId, checkin_notifications.sent_at
      FROM checkin_notifications INNER JOIN messages
        ON checkin_notifications.message_id = messages.id`);

    await db.run('DROP TABLE checkin_notifications');

    await db.run(`
      CREATE TABLE checkin_notifications (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        sent_at TEXT,
        FOREIGN KEY (user_id) 
          REFERENCES users (id) 
              ON DELETE CASCADE 
              ON UPDATE NO ACTION
      )`);

    await db.run(`
      INSERT INTO checkin_notifications (id, user_id, sent_at)
      SELECT checkin_notifications_temp.id, checkin_notifications_temp.user_id, checkin_notifications_temp.sent_at
      FROM checkin_notifications_temp`);

    await db.run('DROP TABLE checkin_notifications_temp');
  }
}

async function createTables() {
  await db.run(
    `PRAGMA foreign_keys = ON`);
  await db.run(
    `CREATE TABLE IF NOT EXISTS users (
              id TEXT PRIMARY KEY,
              username TEXT,
              email TEXT,
              password_hash TEXT,
              role TEXT,
              created_at TEXT,
              last_checkin_at TEXT
          )`);
  await db.run(
    `CREATE TABLE IF NOT EXISTS messages (
              id TEXT PRIMARY KEY,
              user_id TEXT,
              recipients TEXT,
              subject TEXT,
              body TEXT,
              encryption TEXT,
              custom_encryption_pass_hint TEXT,
              attachment_name TEXT,
              attachment_content BLOB,
              checkin_frequency_days INTEGER,
              checkin_waiting_days INTEGER,
              FOREIGN KEY (user_id) 
                REFERENCES users (id) 
                    ON DELETE CASCADE 
                    ON UPDATE NO ACTION
          )`);
  await db.run(
    `CREATE TABLE IF NOT EXISTS checkin_notifications (
              id TEXT PRIMARY KEY,
              user_id TEXT,
              sent_at TEXT,
              FOREIGN KEY (user_id) 
                REFERENCES users (id) 
                    ON DELETE CASCADE 
                    ON UPDATE NO ACTION
          )`);
}

function getDb() {
  if (!db) {
    throw Error('Database not initialized, try calling initializeDatabase() function');
  }
  return db;
}

async function doesTableExist(tableName) {
  const { results_count } = await db.get(`
    SELECT count(*) AS results_count
    FROM sqlite_master
    WHERE type='table' and name = '${tableName}'`);
  return results_count > 0;
}

async function doesTableContainColumn(tableName, columnName, columnType) {
  const { results_count } = await db.get(`
    SELECT count(*) AS results_count
    FROM sqlite_master
    WHERE type='table' and name = '${tableName}'
      and sql like '%${columnName} ${columnType}%'`);
  return results_count > 0;
}

module.exports = {
  initializeDatabase,
  getDb
}
