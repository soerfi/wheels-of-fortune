import Database from 'better-sqlite3';
const db = new Database('./skate_wheel.db');
console.log(db.prepare('SELECT active_slots FROM settings WHERE id = 1').get());
