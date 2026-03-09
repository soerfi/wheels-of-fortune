import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const dbPath = process.env.DB_PATH || path.resolve(process.cwd(), 'skate_wheel.db');

// Ensure directory exists if DB_PATH is provided (e.g., for Docker volume)
if (process.env.DB_PATH) {
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export const db = new Database(dbPath);

// Use WAL mode for better concurrency
db.pragma('journal_mode = WAL');

// Initialize tables
db.exec(`
  CREATE TABLE IF NOT EXISTS settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    active_slots TEXT DEFAULT '[]', -- JSON array of {from: string, to: string}
    voucher_bg_url TEXT,
    test_mode INTEGER DEFAULT 0
  );

  INSERT OR IGNORE INTO settings (id, active_slots, voucher_bg_url)
  VALUES (1, '[{"from": "' || datetime('now') || '", "to": "' || datetime('now', '+30 days') || '"}]', 'https://images.unsplash.com/photo-1564982752979-3f7bc974d29a?q=80&w=1000&auto=format&fit=crop');

  CREATE TABLE IF NOT EXISTS prizes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    name_en TEXT DEFAULT "",
    name_fr TEXT DEFAULT "",
    name_it TEXT DEFAULT "",
    color TEXT NOT NULL,
    description TEXT DEFAULT "",
    description_en TEXT DEFAULT "",
    description_fr TEXT DEFAULT "",
    description_it TEXT DEFAULT "",
    mail_description TEXT DEFAULT "",
    mail_description_en TEXT DEFAULT "",
    mail_description_fr TEXT DEFAULT "",
    mail_description_it TEXT DEFAULT "",
    mail_instruction TEXT DEFAULT "",
    mail_instruction_en TEXT DEFAULT "",
    mail_instruction_fr TEXT DEFAULT "",
    mail_instruction_it TEXT DEFAULT "",
    min_order_value TEXT DEFAULT "",
    min_order_value_en TEXT DEFAULT "",
    min_order_value_fr TEXT DEFAULT "",
    min_order_value_it TEXT DEFAULT "",
    weight INTEGER DEFAULT 1,
    is_jackpot INTEGER DEFAULT 0,
    is_same_code INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS prize_codes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    prize_id INTEGER NOT NULL,
    code TEXT NOT NULL,
    value TEXT,
    is_used INTEGER DEFAULT 0,
    FOREIGN KEY(prize_id) REFERENCES prizes(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS winners (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    prize_id INTEGER,
    code TEXT NOT NULL,
    won_at TEXT NOT NULL,
    user_name TEXT,
    first_name TEXT,
    last_name TEXT,
    newsletter INTEGER DEFAULT 0,
    user_email TEXT,
    email_sent INTEGER DEFAULT 0,
    language TEXT DEFAULT "de",
    FOREIGN KEY(prize_id) REFERENCES prizes(id) ON DELETE SET NULL
  );
`);

// Support for older schema
try {
  db.exec('ALTER TABLE settings ADD COLUMN active_slots TEXT DEFAULT "[]";');
} catch (e) { }

try {
  db.exec('ALTER TABLE settings ADD COLUMN test_mode INTEGER DEFAULT 0;');
} catch (e) { }

try {
  db.exec('ALTER TABLE prizes ADD COLUMN description TEXT DEFAULT "";');
} catch (e) { }

try {
  db.exec('ALTER TABLE prizes ADD COLUMN value TEXT DEFAULT "";');
} catch (e) { }

try {
  db.exec('ALTER TABLE prizes ADD COLUMN weight INTEGER DEFAULT 1;');
} catch (e) { }

try {
  db.exec('ALTER TABLE winners ADD COLUMN user_name TEXT;');
  db.exec('ALTER TABLE winners ADD COLUMN user_email TEXT;');
} catch (e) {
  // Columns might already exist, ignore error
}

try {
  db.exec('ALTER TABLE winners ADD COLUMN email_sent INTEGER DEFAULT 0;');
} catch (e) {
  // Column might already exist, ignore error
}

try {
  db.exec('ALTER TABLE prize_codes ADD COLUMN value TEXT;');
} catch (e) {
  // Column might already exist, ignore error
}

try {
  db.exec('ALTER TABLE prizes ADD COLUMN is_jackpot INTEGER DEFAULT 0;');
} catch (e) {
  // Column might already exist, ignore error
}

try {
  db.exec('ALTER TABLE prizes ADD COLUMN mail_description TEXT DEFAULT "";');
  db.exec('ALTER TABLE prizes ADD COLUMN mail_instruction TEXT DEFAULT "";');
} catch (e) { }

try {
  db.exec('ALTER TABLE prizes ADD COLUMN is_same_code INTEGER DEFAULT 0;');
} catch (e) { }

try {
  db.exec('ALTER TABLE winners ADD COLUMN first_name TEXT;');
  db.exec('ALTER TABLE winners ADD COLUMN last_name TEXT;');
  db.exec('ALTER TABLE winners ADD COLUMN newsletter INTEGER DEFAULT 0;');
} catch (e) { }

try {
  db.exec('ALTER TABLE prizes ADD COLUMN name_en TEXT DEFAULT "";');
  db.exec('ALTER TABLE prizes ADD COLUMN name_fr TEXT DEFAULT "";');
  db.exec('ALTER TABLE prizes ADD COLUMN name_it TEXT DEFAULT "";');

  db.exec('ALTER TABLE prizes ADD COLUMN description_en TEXT DEFAULT "";');
  db.exec('ALTER TABLE prizes ADD COLUMN description_fr TEXT DEFAULT "";');
  db.exec('ALTER TABLE prizes ADD COLUMN description_it TEXT DEFAULT "";');

  db.exec('ALTER TABLE prizes ADD COLUMN mail_description_en TEXT DEFAULT "";');
  db.exec('ALTER TABLE prizes ADD COLUMN mail_description_fr TEXT DEFAULT "";');
  db.exec('ALTER TABLE prizes ADD COLUMN mail_description_it TEXT DEFAULT "";');

  db.exec('ALTER TABLE prizes ADD COLUMN mail_instruction_en TEXT DEFAULT "";');
  db.exec('ALTER TABLE prizes ADD COLUMN mail_instruction_fr TEXT DEFAULT "";');
  db.exec('ALTER TABLE prizes ADD COLUMN mail_instruction_it TEXT DEFAULT "";');

  db.exec('ALTER TABLE winners ADD COLUMN language TEXT DEFAULT "de";');
} catch (e) { }

// Generate some dummy codes for the default prizes if prize_codes is empty
const codesCount = db.prepare('SELECT COUNT(*) as count FROM prize_codes').get() as { count: number };
const prizesCount = db.prepare('SELECT COUNT(*) as count FROM prizes').get() as { count: number };
if (codesCount.count === 0 && prizesCount.count > 0) {
  const insertCode = db.prepare('INSERT INTO prize_codes (prize_id, code) VALUES (?, ?)');
  const defaultPrizes = db.prepare('SELECT id FROM prizes').all() as { id: number }[];

  if (defaultPrizes.length >= 4) {
    // 5 Decks
    for (let i = 1; i <= 5; i++) insertCode.run(defaultPrizes[0].id, `DECK-00${i}`);
    // 20 Griptapes
    for (let i = 1; i <= 20; i++) insertCode.run(defaultPrizes[1].id, `GRIP-00${i}`);
    // 100 Stickers
    for (let i = 1; i <= 100; i++) insertCode.run(defaultPrizes[2].id, `STICK-${i}`);
    // 200 Rabatt
    for (let i = 1; i <= 200; i++) insertCode.run(defaultPrizes[3].id, `DISC-${i}`);
  }
}
