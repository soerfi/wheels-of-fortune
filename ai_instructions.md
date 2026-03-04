# Wheel of Fortune - AI Instructions & Documentation

## 🎯 Projekt Übersicht
**Wheel of Fortune V2** ist eine interaktive, brutalistische Fullstack-Glücksrad-Anwendung (React Frontend + Node.js/SQLite Backend). Besucher von `SKATE.CH` können hier in zeitlich begrenzten Aktionen drehen, um exklusive Gutscheincodes, Rabatte oder Sachpreise zu gewinnen.

Das Projekt zeichnet sich durch ein **Single-Spin System** (1 Dreh pro Browser via LocalStorage) und einen **Pre-Generated Code Import** (CSVs mit gültigen ERP-Codes) aus. Echte Codes werden niemals im Frontend offengelegt, sondern erst nach Eingabe der E-Mail-Adresse sicher über die Resend API verschickt.

---

## 🏗 Architektur & Tech-Stack
* **Frontend:** React 18, Vite, Tailwind CSS v4, Lucide React, PapaParse (für CSV Import im Admin), HTML5 Canvas für das Rad (`components/Wheel.tsx`).
* **Backend:** Node.js, Express.
* **Datenbank:** `better-sqlite3` (lokale Datei `skate_wheel.db` im Root-Verzeichnis).
* **Emails:** `resend` SDK.

---

## 📂 Wichtige Dateien & Ordnerstruktur
* `server.ts`: Das Herzstück des Backends. Enthält alle zentralen API-Routen (Admin, Spin, Prizes) und die SQLite Initialisierung-Prüfung.
* `src/db.ts`: Definiert das Datenbankschema und exportiert die DB-Instanz (`skate_wheel.db`). Enthält Migrations-Logik.
* `src/pages/WheelPage.tsx`: Die Landingpage für die User. Enthält die Abfrage, ob das Rad aktuell aktiv ist, den Countdown-Timer und die Single-Spin Blockade (`localStorage`).
* `src/pages/AdminPage.tsx`: Admin-Dashboard (/admin). Hier können CSV-Codes hochgeladen, manuelle Preise angelegt (für Trostpreise ohne ERP Code) und Zeitfenster geplant werden.
* `src/components/Wheel.tsx`: Das eigentliche HTML5 Canvas Glücksrad. Berechnet Winkel, physikalisches Drehmoment und Animation.
* `src/components/VoucherModal.tsx`: Fängt den Lead (Name, Email) nach einem Gewinn ab und triggert den sicheren Resend-Email Versand via Backend.

---

## 🗄 Datenbank Schema (`skate_wheel.db`)
Das Projekt nutzt eine leichtgewichtige SQLite-Datenbank (`WAL` Mode aktiv für Concurrency).
1. **`settings`**: Steuert die globalen Zeitfenster (JSON Field `active_slots` als `[{from, to}]`) und das Voucher-Hintergrundbild.
2. **`prizes`**: Die verfügbaren Preise auf dem Rad (`id, name, color`).
3. **`prize_codes`**: Die via CSV importierten, realen ERP-Codes. Mapping erfolgt über `prize_id`. Beinhaltet den spezifischen `Wert` und einen `is_used` Boolean.
4. **`winners`**: Loggt jeden Gewinner (`prize_id, code, won_at, user_name, user_email`).

---

## ⚙️ Wie funktioniert der Code-Flow?
1. **CSV Import (Admin):**
   * Die CSV MUSS folgendes Format/Header haben: `Marke` (oder `Text`), `Code`, `Wert:` (oder `Wert`).
   * Trennzeichen ist auf **Europäisches Excel Format (Semikolon `;`)** eingestellt.
   * Das Backend übersetzt die Header in `prizes` (wenn neu) und befüllt `prize_codes` mit den Codes. Bereits bekannte Codes werden via `INSERT OR IGNORE` übersprungen.
2. **Der Spin (User):**
   * POST `/api/spin` checkt serverseitig: Ist die aktuelle Zeit in einem der `active_slots`?
   * Sammelt alle `prizes`, die noch **unbenutzte Codes** (`is_used = 0`) haben. Hat ein Preis 0 Codes, verschwindet er komplett aus dem Array (Nieten-Schutz).
   * Pickt via Weighted-Random (Menge = Wahrscheinlichkeit) einen noch verfügbaren Preis, markiert sofort einen zugehörigen Code als `is_used = 1` und loggt ihn in `winners`.
   * **Sicherheit:** Der echte Code String wird dem Frontend *nicht* zurückgegeben! Nur die ID und der Name des Preis-Objekts.
3. **Lead & Versand:**
   * User gibt im `VoucherModal` Name + E-Mail ein.
   * PUT `/api/winners/:id` speichert die Kontaktdaten und triggert den Resend-Block. Die E-Mail zieht sich aus `winners`, `prizes` und `prize_codes` alle benötigten Bausteine (`prize_name`, `prize_value`, `code`).

---

## 🚀 Deployment (Produktion)
Beim Ausrollen der App auf einen Live-Server (z.B. VPS oder Docker-Umgebung) müssen folgende Schritte beachtet werden:

1. **Environment Variables (`.env`)**
   Die `.env`-Datei muss zwingend auf dem Server angelegt werden:
   ```env
   # Admin Panel Login
   ADMIN_PASSWORD=dein_sicheres_passwort
   # E-Mail API (zwingend nötig für Gutscheinversand)
   RESEND_API_KEY=re_123456789
   # Absender Adresse
   FROM_EMAIL=skate@deinedomain.ch
   ```

2. **Frontend Build**
   Da es sich um eine Vite-Anwendung (React) handelt, muss das Frontend vor dem Start kompiliert werden:
   ```bash
   npm install
   npm run build
   ```
   Dies erzeugt den statischen `dist/` Ordner, den der Express-Server (`server.ts`) in Produktion automatisch ausliefert.

3. **Backend Start**
   Der Node.js Server (`server.ts`) dient sowohl als API als auch als Host für das React-Pendant. Normalerweise startet man diesen über PM2 (Process Manager) oder einen Docker-Container:
   ```bash
   # Via Node direkt (TypeScript Interpreter muss verfügbar sein, oder transpilieren)
   npx tsx server.ts
   
   # ODER via PM2 für Dauerbetrieb
   pm2 start 'npx tsx server.ts' --name wheel-app
   ```

4. **Datenbank Persistenz**
   Achte darauf, dass die Datei `skate_wheel.db` beim Deployment erhalten bleibt! In Docker z.B. mittels persistent Volumes mappen.

---

## 🐛 Known Pitfalls & Debugging (Für spätere AI Agents)
- **SQLite Missing Parameter Crash:** Die `better-sqlite3` Statements (`.get()` oder `.run()`) tolerieren im neuen Node Setup keine fehlenden Arrays/Mappings, wenn `WHERE id = ?` genutzt wird. Immer `db.prepare(...).get(p.id)` ausfüllen, ansonsten crasht die API Route in einen 500 Error und das UI triggert "Keine Preise vorhanden".
- **PapaParse / CSV Header Hölle:** Europäische Excels exportieren oft mit Semicolons `;` statt echten Kommas. Der PapaParse Block in `AdminPage.tsx` nutzt keine hardcodierten Delimiter mehr, sondern checkt smart Header. Bleibt der Upload bei `0 imported` hängen – unbedingt den `BOM` Header oder das Trennzeichen checken.
- **Timer verschwunden?** Wenn das `JSON.parse` des `active_slots` Arrays fehlschlägt, fällt das Rad auf *Aktion Beendet* und berechnet keinen `nextSlotDate`.
- **Admin Fetching:** `/api/prizes` nutzt Request-Header (`x-admin-password`) um festzustellen, ob versteckte "0-Code-Preise" an das React-Dashboard gesendet werden dürfen. Wenn diese fehlen, sieht der Admin keine leeren Preise mehr.
