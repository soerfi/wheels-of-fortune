import Database from 'better-sqlite3';

const db = new Database('./skate_wheel.db');
console.log("Current Prizes:");
console.log(db.prepare('SELECT * FROM prizes').all());
console.log("Codes Summary by Prize:");
console.log(db.prepare('SELECT prize_id, COUNT(*) as count FROM prize_codes GROUP BY prize_id').all());
