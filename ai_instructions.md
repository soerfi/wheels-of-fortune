# Wheel of Fortune - AI Instructions & Documentation

## 🎯 Projekt Übersicht
**Wheel of Fortune V2** ist eine interaktive, brutalistische Fullstack-Glücksrad-Anwendung (React Frontend + Node.js/SQLite Backend). Besucher von `SKATE.CH` können hier in zeitlich begrenzten Aktionen drehen, um exklusive Gutscheincodes, Rabatte oder Sachpreise zu gewinnen.

Das Projekt zeichnet sich durch ein **Single-Spin System** (1 Dreh pro Browser via LocalStorage) und einen **Pre-Generated Code Import** (CSVs mit gültigen ERP-Codes) aus. Echte Codes werden niemals im Frontend offengelegt, sondern erst nach Eingabe der E-Mail-Adresse sicher über die Resend API verschickt.

---

## 🏗 Architektur & Tech-Stack
* **Frontend:** React 18, Vite, Tailwind CSS v4, Lucide React, PapaParse (für CSV Import im Admin), HTML5 Canvas-ähnliche SVG Manipulation (`components/Wheel.tsx`).
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
2. **`prizes`**: Die verfügbaren Preise auf dem Rad. 
   - Felder: `id`, `name`, `description`, `mail_description`, `mail_instruction`, `min_order_value`, `value`, `weight`, `is_jackpot`.
   - **Multi-Language Support**: Die Textfelder existieren dynamisch in 4 Sprachen (`_en`, `_fr`, `_it`). Beispiel: `description_en` oder `min_order_value_fr`. Fallback ist immer der leere String oder Deutsch (das originale Feld ohne Suffix).
3. **`prize_codes`**: Die via CSV importierten, realen ERP-Codes. Mapping erfolgt über `prize_id`. Beinhaltet den spezifischen `Wert` und einen `is_used` Boolean.
4. **`winners`**: Loggt jeden Gewinner (`prize_id, code, won_at, user_name, user_email, first_name`). Speichert seit neustem auch die Browser-Präferenz `language` (z.B. 'de', 'en') für den Mailversand.

---

## ⚙️ Wie funktioniert der Code-Flow?
1. **CSV Import (Admin):**
   * Die CSV MUSS via "Muster herunterladen" generiert oder strikt nach den `Name (DE)`, `Name EN`, `Beschreibung EN`, `Mindestbestellwert (DE)` etc. Headern formatiert sein.
   * Trennzeichen ist auf **Europäisches Excel Format (Semikolon `;`)** eingestellt.
   * Das Backend übersetzt die Header in die multilingualen `prizes` (wenn neu) und befüllt `prize_codes` mit den Codes. Bereits bekannte Codes werden via `INSERT OR IGNORE` übersprungen.
2. **Der Spin (User) - Weighted Random & Atomare Sicherheit:**
   * POST `/api/spin` checkt serverseitig: Ist die aktuelle Zeit in einem der `active_slots`?
   * Sammelt alle `prizes`, die noch **unbenutzte Codes** (`is_used = 0`) haben. Hat ein Preis 0 Codes, verschwindet er komplett aus dem Array (Nieten-Schutz & Verhindert Double-Spending von ausverkauften Preisen).
   * **Weighted Random Calculation:** Anstatt einer exakten `1 / n` Chance, berechnet der Server das Total aller Gewichte der `verfügbaren` Preise. Eine Zufallszahl entscheidet auf Basis dieses Gesamtgewichts den Gewinner. Der sicher zugewiesene Code wird sofort per `is_used = 1` in einer SQL-Transaction blockiert!
   * **18-Slice Wheel Mapping & Jackpot Logic:** Das React-Frontend nutzt das Backend-Datenarray, um **immer exakt 18 physikalische Rad-Sektoren** zu rendern, basierend auf einer SVG-Grafik (`Wheel-of-Fortune.svg`). Der wertvollste Preis (bzw. der mit `is_jackpot=1`) belegt starr den Index 2 (ein goldenes optisches Segment).
   * **Multi-Language Rendering:** Frontend ließt die `navigator.language` aus und versucht dynamisch das passende Suffix (z.B. `name_en`) darzustellen.
   * **Physik:** Das Rad dreht sich mit einer langsamen, kinematik-basierten Physik ca. 15 Sekunden.
   * **Sicherheit:** Der echte gewonnene Code String wird dem Frontend *nicht* zusammen mit dem Spin-Resultat zurückgegeben, sondern bleibt verdeckt, bis das E-Mail-Formular abgesendet ist!
3. **Lead & Versand:**
   * User gibt im `VoucherModal` Name, Vorname, E-Mail und Checkbox-Consent ein (Erscheint nach 5 Sek. Stillstand des Rads).
   * PUT `/api/winners/:id` speichert die Kontaktdaten und triggert den Resend-Block. 
   * Die E-Mail zieht sich aus `winners` die bevorzugte Sprache (z.B. 'fr') und pickt dynamisch die passenden Textelemente (`mail_instruction_fr`, `min_order_value_fr` etc.) für das E-Mail Template zusammen.

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
- **Rate-Limiting (IP-Lock):** Normalerweise darf eine IP nur alle 60 Minuten drehen (`express-rate-limit` windowMs). Zum Testen ist in `.env` oder Startparametern `NODE_ENV !== 'production'` implementiert. Startest du die App mittels `npm run dev`, ist die IP-Sperre in `server.ts` ausser Kraft gesetzt (über den `skip` check im RateLimiter) — localStorage Sperren müssen aber im Browser manuell gelöscht werden (Click-Target "Schon gedreht!" Box resetted den LocalStorage im Dev-Mode).
- **SQLite Missing Parameter Crash:** Die `better-sqlite3` Statements (`.get()` oder `.run()`) tolerieren im neuen Node Setup keine fehlenden Arrays/Mappings, wenn `WHERE id = ?` genutzt wird. Immer `db.prepare(...).get(p.id)` ausfüllen, ansonsten crasht die API Route in einen 500 Error und das UI triggert "Keine Preise vorhanden".
- **PapaParse / CSV Header Hölle:** Europäische Excels exportieren oft mit Semicolons `;` statt echten Kommas. Der PapaParse Block in `AdminPage.tsx` nutzt keine hardcodierten Delimiter mehr, sondern checkt smart Header. Bleibt der Upload bei `0 imported` hängen – unbedingt den `BOM` Header (`\uFEFF`) oder das Trennzeichen (`semicolon`) checken.
- **Timer verschwunden?** Wenn das `JSON.parse` des `active_slots` Arrays fehlschlägt, fällt das Rad auf *Aktion Beendet* und berechnet keinen `nextSlotDate`.
- **API Security Authentication:** Routen verlangen JWT Tokens (im Header `Authorization: Bearer <token>`). Fallbacks wie `x-admin-password` sollten vermieden werden. AdminPage ist vollständig auf die JWT Authentifizierung via `login` Endpoint migriert.
