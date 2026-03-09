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

3. **Automated Docker Deployment (Empfohlen)**
   Das Projekt ist vollständig für Docker-Orchestrierung vorbereitet. Der empfohlene Weg auf Linux-Servern ist die Nutzung des bereitgestellten `deploy.sh` Scripts:
   ```bash
   sh deploy.sh
   ```
   * Dieses Script:
   * Führt einen TypeScript Type-Check pro-aktiv während des Docker Image Builds durch (im `Dockerfile`), anstatt auf dem Host.
   * Zündet via `docker-compose up -d --build` einen Container basierend auf dem `Dockerfile`.
   * Der Container baut das Frontend (`npm run build`) und startet den Express Server auf Port `3000` (`npx tsx server.ts`).
   * Über `docker-compose.yml` wird dieser interne Port `3000` nach aussen auf den Host-Port **`3005`** gemappt, um Kollisionen mit bestehenden Services (wie dem SEO Master auf 3001) zu vermeiden. Die App ist also unter `http://SERVER_IP:3005` erreichbar. Wichtig: Die Ubuntu-Firewall muss diesen Port freigeben (`sudo ufw allow 3005`).

4. **Nginx Reverse Proxy & SSL (HTTPS)**
   Da auf dem Server bereits andere Node-Applikationen laufen (z.B. die `app-suite` auf Port 8000), fungiert ein globaler Nginx-Container (`global-nginx-proxy`) als Türsteher.
   * **Location:** `/home/server/app/wheels-of-fortune/deploy-proxy`
   * **Netzwerk:** Der Proxy nutzt `network_mode: host`, um direkt auf dem Host an den Ports 80 und 443 zu lauschen.
   * **Routing:** Anfragen an die Haupt-IP (`72.62.43.134`) werden als `default_server` an Port `8000` (App-Suite) weitergeleitet. Anfragen an `win.skate.ch` rufen Port `3005` (Wheel) auf.
   * **SSL (Let's Encrypt):** SSL-Zertifikate werden via Certbot (`sudo certbot certonly --standalone -d win.skate.ch`) generiert und direkt aus `/etc/letsencrypt` in den Proxy-Container gemountet. Nginx erzwingt HTTPS via 301 Redirect.
   * **App-Suite Bridge:** Falls die App-Suite separat neu gestartet wird, muss sie zwingend ins selbe Netzwerk mit dem QR-Backend gehängt werden (`docker run --network app_default ...`), da sie intern via Nginx-Upstream mit `qr-backend` kommuniziert.

5. **Datenbank Persistenz (Volumes)**
   Der SQLite Pfad ist dynamisch. Durch das `docker-compose.yml` wird der lokale `/data` Ordner des Servers in den Container gemappt (`DB_PATH=/app/data/skate_wheel.db`). Achte beim manuellen Setup darauf, dass die Volume-Bindings für die persistente `skate_wheel.db` mitsamt Wal-Files erhalten bleiben!

---

## 🐛 Known Pitfalls & Debugging (Für spätere AI Agents)
- **Rate-Limiting (IP-Lock):** Normalerweise darf eine IP nur alle 60 Minuten drehen (`express-rate-limit` windowMs). Zum Testen ist in `.env` oder Startparametern `NODE_ENV !== 'production'` implementiert. Startest du die App mittels `npm run dev`, ist die IP-Sperre in `server.ts` ausser Kraft gesetzt (über den `skip` check im RateLimiter) — localStorage Sperren müssen aber im Browser manuell gelöscht werden (Click-Target "Schon gedreht!" Box resetted den LocalStorage im Dev-Mode).
- **SQLite Missing Parameter Crash:** Die `better-sqlite3` Statements (`.get()` oder `.run()`) tolerieren im neuen Node Setup keine fehlenden Arrays/Mappings, wenn `WHERE id = ?` genutzt wird. Immer `db.prepare(...).get(p.id)` ausfüllen, ansonsten crasht die API Route in einen 500 Error und das UI triggert "Keine Preise vorhanden".
- **PapaParse / CSV Header Hölle:** Europäische Excels exportieren oft mit Semicolons `;` statt echten Kommas. Der PapaParse Block in `AdminPage.tsx` nutzt keine hardcodierten Delimiter mehr, sondern checkt smart Header. Bleibt der Upload bei `0 imported` hängen – unbedingt den `BOM` Header (`\uFEFF`) oder das Trennzeichen (`semicolon`) checken.
- **Timer verschwunden?** Wenn das `JSON.parse` des `active_slots` Arrays fehlschlägt, fällt das Rad auf *Aktion Beendet* und berechnet keinen `nextSlotDate`.
- **API Security Authentication:** Routen verlangen JWT Tokens (im Header `Authorization: Bearer <token>`). Fallbacks wie `x-admin-password` sollten vermieden werden. AdminPage ist vollständig auf die JWT Authentifizierung via `login` Endpoint migriert.
- **Docker Compose v1 Crash (KeyError: 'ContainerConfig'):** Wenn ein altes Docker Image modifiziert/gelöscht wird, wehrt sich das extrem veraltete Python `docker-compose` (Ubuntu Default) manchmal wehement mit einem Stacktrace KeyError, weil er Volumes von einem Geister-Container migrieren will. Lösung: `docker-compose rm -f -s -v` um den korrupten State tiefgründig zu bereinigen, bevor man `deploy.sh` ausführt.

---

## 🛠 Features & Learnings (Latest Updates)
- **Same Code for All (`is_same_code`):** Preise können als "Generischer Code" markiert werden. In diesem Fall wird der Code beim Gewinnen **nicht** auf `is_used = 1` gesetzt. Der Admin kann so Endlos-Gutscheine (z.B. "SKATE10") importieren, ohne dass diese aufgebraucht werden.
- **Code Management Modal:** Reale ERP-Codes können nun pro Preis in einem eigenen Modal (`CodeManagerModal.tsx`) gemanaged werden (Add, Edit, Delete). Ein strictes Case-Insensitive Duplicate-Checking (`LOWER(code)`) verhindert über alle Systeme hinweg doppelte Codes.
- **D'Hondt Sektor-Verteilung:** Das React-Laufrad nutzt nun die mathematische D'Hondt-Methode, um die 18 Slices proportional nach `Gewichtung` zuzuweisen. Jeder Preis erhält garantiert mindestens 1 Slot. Ein Interleaved-Algorithmus (Stride-2) sorgt für die absolute mathematische Garantie, dass zwei identische Preise niemals nebeneinander gezeichnet werden!
- **Dynamisches SVG-Rad statt Grafik:** Wegen Asymmetrien im ursprünglichen Hintergrundbild wird das Rad nun auf den Zehntel-Millimeter via React Code (`describeArc`) aufgebaut. Um den gewünschten "Grunge"-Stil zu erhalten, nutzt das Rad exklusive native SVG-Filter (`feTurbulence` & `feDisplacementMap`), sowie eine statische Logo-Ebene im Zentrum.
- **UI-UX-Pro-Max Headers:** Der Header nutzt skalierende und responsive Bild-Logos mit sanften CSS-Fades und korrekten Drop-Shadows (orientiert an den Premium UI Regeln).
- **Skater Physics Offset:** Der "Soerfi Skater Pin" ist nicht bei 0 Grad (Top) montiert, sondern links bei `-10deg`. Der Wheel Spin Algorithmus (`TARGET_ANGLE_BASE`) wurde mathematisch auf Target `330` kalibriert, sodass jede Gewinn-Slice pixelgenau mit ihrer Mitte exakt auf der Schuhsohle des Skaters zum Stehen kommt.
- **Robust CSV Parsing:** Das `AdminPage` PapaParse Skript zerlegt nun auch einzelne CSV Zellen mit multiplen Codes (getrennt durch Space, Komma, Semikolon oder NewLines) zuverlässig in Arrays. Dazu liest es Boolean Felder (wie "Jackpot Preis" in Gold) fehlertolerant als true, wenn die Datei "1", "ja", "yes", oder "true" (Case-Insensitive) übergibt.
