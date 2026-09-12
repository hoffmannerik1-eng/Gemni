// Dieses Skript führst du EINMALIG auf deinem eigenen PC aus (nicht auf Render!),
// um dir selbst Zugriff auf dein Gmail-Konto zu geben.
// Aufruf: node get-gmail-token.js
// Voraussetzung: Node.js installiert, GMAIL_CLIENT_ID und GMAIL_CLIENT_SECRET als Umgebungsvariablen
// oder direkt unten eintragen.

import http from "http";
import { URL } from "url";
import dotenv from "dotenv";
dotenv.config();

const CLIENT_ID = process.env.GMAIL_CLIENT_ID;
const CLIENT_SECRET = process.env.GMAIL_CLIENT_SECRET;
const REDIRECT_URI = "http://localhost:8091/oauth2callback";

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error("Bitte GMAIL_CLIENT_ID und GMAIL_CLIENT_SECRET in .env eintragen, dann erneut starten.");
  process.exit(1);
}

const authUrl =
  `https://accounts.google.com/o/oauth2/v2/auth?` +
  new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: "code",
    access_type: "offline",
    prompt: "consent",
    scope: "https://www.googleapis.com/auth/gmail.readonly",
  }).toString();

console.log("\n1. Öffne diesen Link in deinem Browser und logge dich mit dem Gmail-Konto ein, das überwacht werden soll:\n");
console.log(authUrl + "\n");
console.log("2. Nach der Bestätigung wirst du automatisch zurückgeleitet, dieses Fenster zeigt dann den Refresh-Token an.\n");

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, REDIRECT_URI);
  if (url.pathname !== "/oauth2callback") return res.end("OK");

  const code = url.searchParams.get("code");
  res.end("Fertig! Du kannst dieses Fenster/Terminal jetzt schließen.");

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      redirect_uri: REDIRECT_URI,
      grant_type: "authorization_code",
    }),
  });
  const tokenData = await tokenRes.json();

  if (tokenData.refresh_token) {
    console.log("\n✅ Dein Refresh-Token (trage ihn als GMAIL_REFRESH_TOKEN in Render ein):\n");
    console.log(tokenData.refresh_token);
  } else {
    console.log("\n❌ Kein Refresh-Token erhalten. Antwort von Google:\n", tokenData);
    console.log("Tipp: Falls du das schon mal ausgeführt hast, in deinem Google-Konto unter");
    console.log("myaccount.google.com/permissions den Zugriff der App erst entfernen und erneut versuchen.");
  }
  server.close();
  process.exit(0);
});

server.listen(8091);
