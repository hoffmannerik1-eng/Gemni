# Mein KI-Assistent

Eine kleine, selbstgehostete Webapp mit Gemini:
- **Chat** mit Websuche für aktuelle Infos (z.B. "zeig mir das Ergebnis von gestern")
- **Aufgabenliste**, die du der KI/dir selbst geben kannst — sichtbar auf PC und Handy, weil beide dieselbe Webseite öffnen

Du brauchst dafür **keine** Programmierkenntnisse. Du musst nur den Schritten unten folgen.

---

## Schritt 1: Gemini API-Key holen

1. Gehe zu https://aistudio.google.com/apikey
2. Melde dich mit deinem Google-Konto an
3. Klicke auf "Create API key"
4. Kopiere den Key, du brauchst ihn gleich

## Schritt 2: GitHub-Repository erstellen

1. Gehe zu https://github.com und logge dich ein (Account erstellen, falls nötig)
2. Klicke oben rechts auf **+** → **New repository**
3. Gib einen Namen ein, z.B. `mein-ki-assistent`, wähle **Private** oder **Public**, klicke **Create repository**
4. Klicke auf **"uploading an existing file"** (oder "Add file" → "Upload files")
5. Ziehe **alle Dateien und Ordner** aus diesem Projekt-Ordner in das Upload-Fenster (auch den `public`-Ordner mit seinem Inhalt)
6. Klicke unten auf **Commit changes**

Damit liegt dein Code jetzt auf GitHub.

## Schritt 3: Kostenlos hosten mit Render

1. Gehe zu https://render.com und melde dich **mit deinem GitHub-Account** an
2. Klicke auf **New +** → **Web Service**
3. Wähle dein gerade hochgeladenes Repository aus
4. Trage folgende Einstellungen ein:
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Instance Type:** Free
5. Scrolle zu **Environment Variables** und füge hinzu:
   - `GEMINI_API_KEY` = dein Key aus Schritt 1
   - `APP_PASSWORD` = ein selbst ausgedachtes Passwort (schützt deine App vor Fremdzugriff)
   - `GEMINI_MODEL` = `gemini-2.5-flash`
6. Klicke **Create Web Service** und warte, bis "Live" angezeigt wird (paar Minuten)

Du bekommst eine URL wie `https://mein-ki-assistent.onrender.com`.

## Schritt 4: Auf PC und Handy benutzen

1. Öffne die URL im Browser deines PCs **und** deines Handys
2. Gib beim ersten Mal das Passwort ein (das du in Schritt 3 gesetzt hast)
3. Fertig — beide Geräte greifen auf **denselben Server** zu. Was du im Chat fragst oder in die Aufgabenliste einträgst, ist auf beiden Geräten gleich, weil es nicht "zwei Apps" sind, sondern eine gemeinsame Webseite.
4. Tipp: Auf dem Handy kannst du die Seite über "Zum Startbildschirm hinzufügen" wie eine App ablegen.

---

## Schritt 5 (optional): E-Mail-Überwachung + Telegram-Benachrichtigung

Damit die App dein Gmail-Postfach checken und dir bei Treffern Bescheid geben kann.

### 5a. Telegram-Bot einrichten (5 Minuten)

1. Öffne Telegram, suche nach **@BotFather**, schreib ihm `/newbot` und folge den Anweisungen
2. Du bekommst einen **Bot-Token** (sieht aus wie `123456:ABC-...`) — kopieren
3. Suche in Telegram nach deinem neu erstellten Bot und schreib ihm irgendeine Nachricht (z.B. "Hallo")
4. Öffne im Browser: `https://api.telegram.org/bot<DEIN_TOKEN>/getUpdates` (Token einsetzen)
5. Darin findest du `"chat":{"id":123456789,...}` — diese Zahl ist deine **Chat-ID**

### 5b. Gmail-Zugriff einrichten (etwas technischer, aber nur einmalig)

1. Gehe zu https://console.cloud.google.com/ → neues Projekt erstellen (Name egal)
2. Unter **APIs & Services → Library**: Suche "Gmail API" → **Enable**
3. Unter **APIs & Services → OAuth consent screen**:
   - User Type: **External**
   - App-Name, deine E-Mail eintragen, speichern
   - Scopes: `.../auth/gmail.readonly` hinzufügen
   - Unter **Test users**: deine eigene Gmail-Adresse hinzufügen
   - **Wichtig:** Anschließend oben auf **"PUBLISH APP"** klicken, damit der Status auf **"In production"** wechselt (sonst läuft der Zugang nach 7 Tagen ab). Die Warnung "Google hat diese App nicht überprüft" ist bei einer nur von dir selbst genutzten App normal — du kannst dort auf "Erweitert" → "Trotzdem fortfahren" klicken.
4. Unter **APIs & Services → Credentials → Create Credentials → OAuth client ID**:
   - Application type: **Web application**
   - Authorized redirect URIs: `http://localhost:8091/oauth2callback`
   - Erstellen → du bekommst **Client-ID** und **Client-Secret**
5. Auf deinem eigenen PC (nicht auf Render): lege eine `.env`-Datei an mit `GMAIL_CLIENT_ID` und `GMAIL_CLIENT_SECRET`, dann ausführen:
   ```bash
   npm install
   node get-gmail-token.js
   ```
6. Folge dem Link, der im Terminal ausgegeben wird, logge dich mit dem zu überwachenden Gmail-Konto ein und bestätige den Zugriff
7. Das Terminal zeigt dir danach einen **Refresh-Token** an — kopieren

### 5c. Alles bei Render eintragen

Trage bei deinem Render-Web-Service unter **Environment** zusätzlich ein:

| Variable | Wert |
|---|---|
| `GMAIL_CLIENT_ID` | aus Schritt 5b.4 |
| `GMAIL_CLIENT_SECRET` | aus Schritt 5b.4 |
| `GMAIL_REFRESH_TOKEN` | aus Schritt 5b.7 |
| `TELEGRAM_BOT_TOKEN` | aus Schritt 5a.2 |
| `TELEGRAM_CHAT_ID` | aus Schritt 5a.5 |

Nach dem Speichern startet Render neu, und die App checkt ab dann alle 3 Minuten dein Postfach anhand der Regeln, die du im **"Mail-Regeln"**-Tab der App selbst einträgst.

---

## Wichtig zu wissen

- **Kostenlose Render-Instanzen "schlafen" nach Inaktivität** ein und brauchen beim ersten Aufruf ~30 Sekunden zum Aufwachen. Für "immer sofort an" bräuchtest du einen bezahlten Plan.
- **Aufgaben werden in einer einfachen Datei gespeichert** (`tasks.json` auf dem Server). Bei einem Neu-Deploy auf dem kostenlosen Plan kann diese Datei zurückgesetzt werden. Für dauerhafte Speicherung später eine echte Datenbank (z.B. Supabase, kostenlos) ergänzen.
- **Die KI kann keine Videospiele für dich spielen.** Sie kann dir aber Infos beschaffen, Fragen beantworten und deine Aufgaben verwalten. "Automatisches Durchspielen" wäre ein eigenes, viel größeres Projekt mit spielspezifischer Technik.
- **Telegram deckt PC und Handy gleichzeitig ab:** Installiere die Telegram-App auf dem iPhone (normale Push-Mitteilung) und optional Telegram Desktop/Web auf dem PC (Desktop-Benachrichtigung während du arbeitest) — beide hängen am selben Bot, kein Extra-Aufwand nötig.
- Falls `gemini-2.5-flash` nicht mehr verfügbar ist, schau unter https://ai.google.dev/gemini-api/docs/models nach dem aktuellen Modellnamen und trage ihn bei `GEMINI_MODEL` in Render ein.

## Lokal testen (optional)

Falls du es vor dem Hosting mal auf deinem PC ausprobieren willst und Node.js installiert hast:

```bash
cp .env.example .env
# trage in .env deinen echten GEMINI_API_KEY ein
npm install
npm start
```

Dann im Browser: http://localhost:3000
