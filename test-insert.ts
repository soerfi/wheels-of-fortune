import Database from 'better-sqlite3';

const db = new Database('./skate_wheel.db');

const items = [
    { prizeName: 'SKATE.CH Gutschein für 100.-', code: 'asdasd-adasd1', value: '100' },
    { prizeName: 'SKATE.CH Gutschein für 50.-', code: 'asdasd-adasd3', value: '50' }
];

console.log("Before:");
console.log(db.prepare('SELECT * FROM prizes').all());

const insertCode = db.prepare('INSERT OR IGNORE INTO prize_codes (prize_id, code, value) VALUES (?, ?, ?)');
let imported = 0;

db.transaction(() => {
    for (const item of items) {
        let prize = db.prepare('SELECT id FROM prizes WHERE name = ?').get(item.prizeName) as { id: number };
        if (!prize) {
            console.log("Prize not found, inserting:", item.prizeName);
            const insertPrize = db.prepare('INSERT INTO prizes (name, color) VALUES (?, ?)');
            const result = insertPrize.run(item.prizeName, '#EF4444');
            prize = { id: result.lastInsertRowid as number };
        }
        const codeRes = insertCode.run(prize.id, item.code, item.value || null);
        if (codeRes.changes > 0) imported++;
    }
})();

console.log("Imported:", imported);
console.log("After Prizes:");
console.log(db.prepare('SELECT * FROM prizes').all());
console.log("After Codes:");
console.log(db.prepare('SELECT * FROM prize_codes').all());
