import Database from 'better-sqlite3';
import path from 'path';

const dbPath = process.env.DB_PATH || path.resolve(process.cwd(), 'skate_wheel.db');
const db = new Database(dbPath);

console.log('Verbinde mit Datenbank:', dbPath);

// Alle tabellen leeren außer settings
try {
  db.exec('DELETE FROM winners;');
  db.exec('DELETE FROM prize_codes;');
  db.exec('DELETE FROM prizes;');

  // Reset auto-increment
  db.exec('DELETE FROM sqlite_sequence WHERE name IN (\'winners\', \'prize_codes\', \'prizes\');');

  console.log('✅ Datenbank erfolgreich zurückgesetzt.');
  console.log('Alle Gewinner, Preise und Gutschein-Codes wurden gelöscht. Einstellungen bleiben erhalten.');
} catch (error) {
  console.error('❌ Fehler beim Zurücksetzen der Datenbank:', error);
}
