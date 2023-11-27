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
    await createTables();
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
              created_at TEXT
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
              checkin_status TEXT,
              checkin_frequency_days INTEGER,
              checkin_waiting_days INTEGER,
              last_checkin_at TEXT,
              FOREIGN KEY (user_id) 
                REFERENCES users (id) 
                    ON DELETE CASCADE 
                    ON UPDATE NO ACTION
          )`);
  await db.run(
    `CREATE TABLE IF NOT EXISTS checkin_notifications (
              id TEXT PRIMARY KEY,
              message_id TEXT,
              sent_at TEXT,
              FOREIGN KEY (message_id) 
                REFERENCES messages (id) 
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

module.exports = {
  initializeDatabase,
  getDb
}
