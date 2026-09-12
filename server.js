import express from "express";
import fetch from "node-fetch";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const APP_PASSWORD = process.env.APP_PASSWORD || "";
const TASKS_FILE = path.join(__dirname, "tasks.json");

const GMAIL_CLIENT_ID = process.env.GMAIL_CLIENT_ID;
const GMAIL_CLIENT_SECRET = process.env.GMAIL_CLIENT_SECRET;
const GMAIL_REFRESH_TOKEN = process.env.GMAIL_REFRESH_TOKEN;
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const EMAIL_CHECK_INTERVAL_MIN = Number(process.env.EMAIL_CHECK_INTERVAL_MIN || 3);
const RULES_FILE = path.join(__dirname, "rules.json");
const NOTIFIED_FILE = path.join(__dirname, "notified.json");
let lastCheckTimestamp = Math.floor(Date.now() / 1000) - 600;

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

app.get("/health", (req, res) => res.status(200).send("ok"));

function checkPassword(req, res, next) {
  if (!APP_PASSWORD) return next();
  const given = req.headers["x-app-password"];
  if (given === APP_PASSWORD) return next();
  return res.status(401).json({ error: "Falsches Passwort." });
}

async function readTasks() {
  try {
    const data = await fs.readFile(TASKS_FILE, "utf-8");
    return JSON.parse(data);
  } catch {
    return [];
  }
}
async function writeTasks(tasks) {
  await fs.writeFile(TASKS_FILE, JSON.stringify(tasks, null, 2), "utf-8");
}

app.post("/api/chat", checkPassword, async (req, res) => {
  try {
    if (!GEMINI_API_KEY) {
      return res.status(500).json({ error: "GEMINI_API_KEY ist auf dem Server nicht gesetzt." });
    }
    const { message, history = [] } = req.body;
    if (!message || typeof message !== "string") {
      return res.status(400).json({ error: "Feld 'message' fehlt." });
    }

    const contents = [
      ...history.map((h) => ({
        role: h.role === "assistant" ? "model" : "user",
        parts: [{ text: h.text }],
      })),
      { role: "user", parts: [{ text: message }] },
    ];

    const body = {
      contents,
      tools: [{ google_search: {} }],
      systemInstruction: {
        parts: [
          {
            text:
              "Du bist ein hilfreicher, direkter deutschsprachiger Assistent. " +
              "Wenn nach aktuellen Ereignissen, Ergebnissen, Nachrichten oder Daten gefragt wird, " +
              "nutze die Websuche und nenne das Datum/die Quelle kurz mit. " +
              "Antworte knapp und klar.",
          },
        ],
      },
    };

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
    const r = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": GEMINI_API_KEY,
      },
      body: JSON.stringify(body),
    });

    const data = await r.json();

    if (!r.ok) {
      console.error("Gemini API Fehler:", data);
      return res.status(500).json({ error: data?.error?.message || "Gemini API Fehler" });
    }

    const candidate = data.candidates?.[0];
    const text =
      candidate?.content?.parts?.map((p) => p.text).filter(Boolean).join("\n") ||
      "(Keine Antwort erhalten)";

    const sources =
      candidate?.groundingMetadata?.groundingChunks
        ?.map((c) => c.web?.uri)
        .filter(Boolean) || [];

    res.json({ text, sources });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Serverfehler beim Aufruf von Gemini." });
  }
});

app.get("/api/tasks", checkPassword, async (req, res) => {
  res.json(await readTasks());
});

app.post("/api/tasks", checkPassword, async (req, res) => {
  const { text } = req.body;
  if (!text) return res.status(400).json({ error: "Feld 'text' fehlt." });
  const tasks = await readTasks();
  const task = { id: Date.now().toString(), text, done: false, createdAt: new Date().toISOString() };
  tasks.push(task);
  await writeTasks(tasks);
  res.json(task);
});

app.patch("/api/tasks/:id", checkPassword, async (req, res) => {
  const tasks = await readTasks();
  const task = tasks.find((t) => t.id === req.params.id);
  if (!task) return res.status(404).json({ error: "Aufgabe nicht gefunden." });
  if (typeof req.body.done === "boolean") task.done = req.body.done;
  if (typeof req.body.text === "string") task.text = req.body.text;
  await writeTasks(tasks);
  res.json(task);
});

app.delete("/api/tasks/:id", checkPassword, async (req, res) => {
  let tasks = await readTasks();
  tasks = tasks.filter((t) => t.id !== req.params.id);
  await writeTasks(tasks);
  res.json({ ok: true });
});

async function readJsonFile(file, fallback) {
  try {
    return JSON.parse(await fs.readFile(file, "utf-8"));
  } catch {
    return fallback;
  }
}
async function writeJsonFile(file, data) {
  await fs.writeFile(file, JSON.stringify(data, null, 2), "utf-8");
}

app.get("/api/rules", checkPassword, async (req, res) => {
  res.json(await readJsonFile(RULES_FILE, []));
});

app.post("/api/rules", checkPassword, async (req, res) => {
  const { type, value } = req.body;
  if (!type || !value) return res.status(400).json({ error: "Felder 'type' und 'value' nötig." });
  const rules = await readJsonFile(RULES_FILE, []);
  const rule = { id: Date.now().toString(), type, value, active: true };
  rules.push(rule);
  await writeJsonFile(RULES_FILE, rules);
  res.json(rule);
});

app.patch("/api/rules/:id", checkPassword, async (req, res) => {
  const rules = await readJsonFile(RULES_FILE, []);
  const rule = rules.find((r) => r.id === req.params.id);
  if (!rule) return res.status(404).json({ error: "Regel nicht gefunden." });
  if (typeof req.body.active === "boolean") rule.active = req.body.active;
  await writeJsonFile(RULES_FILE, rules);
  res.json(rule);
});

app.delete("/api/rules/:id", checkPassword, async (req, res) => {
  let rules = await readJsonFile(RULES_FILE, []);
  rules = rules.filter((r) => r.id !== req.params.id);
  await writeJsonFile(RULES_FILE, rules);
  res.json({ ok: true });
});

async function sendTelegram(text) {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    console.warn("Telegram nicht konfiguriert, überspringe Benachrichtigung.");
    return;
  }
  try {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text }),
    });
  } catch (err) {
    console.error("Telegram-Fehler:", err);
  }
}

async function getGmailAccessToken() {
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: GMAIL_CLIENT_ID,
      client_secret: GMAIL_CLIENT_SECRET,
      refresh_token: GMAIL_REFRESH_TOKEN,
      grant_type: "refresh_token",
    }),
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error_description || "Gmail-Token-Fehler");
  return data.access_token;
}

async function checkGmailAgainstRules() {
  if (!GMAIL_CLIENT_ID || !GMAIL_CLIENT_SECRET || !GMAIL_REFRESH_TOKEN) return;
  const rules = (await readJsonFile(RULES_FILE, [])).filter((r) => r.active);
  if (rules.length === 0) return;

  try {
    const accessToken = await getGmailAccessToken();
    const notified = await readJsonFile(NOTIFIED_FILE, []);
    const notifiedSet = new Set(notified);
    const newTimestamp = Math.floor(Date.now() / 1000);

    for (const rule of rules) {
      const query =
        rule.type === "sender"
          ? `after:${lastCheckTimestamp} from:${rule.value}`
          : `after:${lastCheckTimestamp} ${rule.value}`;

      const listUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(query)}&maxResults=10`;
      const listRes = await fetch(listUrl, { headers: { Authorization: `Bearer ${accessToken}` } });
      const listData = await listRes.json();
      if (!listRes.ok || !listData.messages) continue;

      for (const m of listData.messages) {
        if (notifiedSet.has(m.id)) continue;
        const msgRes = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${m.id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        const msgData = await msgRes.json();
        const headers = msgData.payload?.headers || [];
        const from = headers.find((h) => h.name === "From")?.value || "Unbekannt";
        const subject = headers.find((h) => h.name === "Subject")?.value || "(kein Betreff)";

        await sendTelegram(`📧 Neue passende E-Mail (Regel: ${rule.type} "${rule.value}")\nVon: ${from}\nBetreff: ${subject}`);
        notifiedSet.add(m.id);
      }
    }

    const trimmed = Array.from(notifiedSet).slice(-500);
    await writeJsonFile(NOTIFIED_FILE, trimmed);
    lastCheckTimestamp = newTimestamp;
  } catch (err) {
    console.error("Fehler bei der Gmail-Prüfung:", err.message);
  }
}

if (GMAIL_CLIENT_ID && GMAIL_CLIENT_SECRET && GMAIL_REFRESH_TOKEN) {
  setInterval(checkGmailAgainstRules, EMAIL_CHECK_INTERVAL_MIN * 60 * 1000);
  checkGmailAgainstRules();
  console.log(`Gmail-Überwachung aktiv (alle ${EMAIL_CHECK_INTERVAL_MIN} Min.)`);
} else {
  console.log("Gmail-Überwachung inaktiv (GMAIL_* Umgebungsvariablen fehlen).");
}

app.listen(PORT, () => {
  console.log(`Server läuft auf Port ${PORT}`);
});
