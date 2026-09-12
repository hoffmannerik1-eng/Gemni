// --- Passwortschutz ---
function getPassword() { return localStorage.getItem("app_password") || ""; }
function unlock() {
  const pw = document.getElementById("pwInput").value;
  localStorage.setItem("app_password", pw);
  document.getElementById("lockScreen").style.display = "none";
  loadTasks();
}
if (getPassword()) {
  document.getElementById("lockScreen").style.display = "none";
}

function authHeaders() {
  return { "Content-Type": "application/json", "x-app-password": getPassword() };
}

// --- Tabs ---
document.querySelectorAll(".tab-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
    document.querySelectorAll(".view").forEach((v) => v.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById(btn.dataset.view).classList.add("active");
  });
});

// --- Chat ---
const chatLog = document.getElementById("chatLog");
const chatForm = document.getElementById("chatForm");
const chatInput = document.getElementById("chatInput");
let history = [];

function addMessage(role, text, sources = []) {
  const div = document.createElement("div");
  div.className = "msg " + (role === "user" ? "user" : "bot");
  div.textContent = text;
  if (sources.length) {
    const s = document.createElement("span");
    s.className = "sources";
    s.innerHTML = "Quellen: " + sources.slice(0, 3).map((u, i) => `<a href="${u}" target="_blank">[${i + 1}]</a>`).join(" ");
    div.appendChild(s);
  }
  chatLog.appendChild(div);
  chatLog.scrollTop = chatLog.scrollHeight;
}

async function callChatApi(message, historyForRequest) {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ message, history: historyForRequest }),
  });
  return res;
}

chatForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const message = chatInput.value.trim();
  if (!message) return;
  chatInput.value = "";
  addMessage("user", message);
  history.push({ role: "user", text: message });
  const historyForRequest = history.slice(0, -1);

  const loadingDiv = document.createElement("div");
  loadingDiv.className = "msg bot";
  loadingDiv.textContent = "…";
  chatLog.appendChild(loadingDiv);
  chatLog.scrollTop = chatLog.scrollHeight;

  const attempts = [0, 4000, 8000];
  for (let i = 0; i < attempts.length; i++) {
    if (attempts[i] > 0) {
      loadingDiv.textContent = "Server wacht auf, einen Moment...";
      await new Promise((r) => setTimeout(r, attempts[i]));
    }
    try {
      const res = await callChatApi(message, historyForRequest);
      const data = await res.json();
      loadingDiv.remove();
      if (!res.ok) {
        addMessage("bot", "Fehler: " + (data.error || "Unbekannter Fehler"));
        return;
      }
      addMessage("bot", data.text, data.sources || []);
      history.push({ role: "assistant", text: data.text });
      return;
    } catch (err) {
      if (i === attempts.length - 1) {
        loadingDiv.remove();
        addMessage("bot", "Verbindungsfehler zum Server. Bitte kurz warten und nochmal senden.");
      }
    }
  }
});

chatInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    chatForm.requestSubmit();
  }
});

// --- Aufgaben ---
const taskForm = document.getElementById("taskForm");
const taskInput = document.getElementById("taskInput");
const taskList = document.getElementById("taskList");

async function loadTasks() {
  try {
    const res = await fetch("/api/tasks", { headers: authHeaders() });
    if (!res.ok) return;
    const tasks = await res.json();
    renderTasks(tasks);
  } catch {}
}

function renderTasks(tasks) {
  taskList.innerHTML = "";
  tasks.forEach((t) => {
    const div = document.createElement("div");
    div.className = "task" + (t.done ? " done" : "");
    div.innerHTML = `
      <input type="checkbox" ${t.done ? "checked" : ""} />
      <span class="txt"></span>
      <button title="Löschen">✕</button>
    `;
    div.querySelector(".txt").textContent = t.text;
    div.querySelector("input").addEventListener("change", async (e) => {
      await fetch(`/api/tasks/${t.id}`, {
        method: "PATCH",
        headers: authHeaders(),
        body: JSON.stringify({ done: e.target.checked }),
      });
      loadTasks();
    });
    div.querySelector("button").addEventListener("click", async () => {
      await fetch(`/api/tasks/${t.id}`, { method: "DELETE", headers: authHeaders() });
      loadTasks();
    });
    taskList.appendChild(div);
  });
}

taskForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const text = taskInput.value.trim();
  if (!text) return;
  taskInput.value = "";
  await fetch("/api/tasks", { method: "POST", headers: authHeaders(), body: JSON.stringify({ text }) });
  loadTasks();
});

// --- Mail-Regeln ---
const ruleForm = document.getElementById("ruleForm");
const ruleType = document.getElementById("ruleType");
const ruleValue = document.getElementById("ruleValue");
const ruleList = document.getElementById("ruleList");

async function loadRules() {
  try {
    const res = await fetch("/api/rules", { headers: authHeaders() });
    if (!res.ok) return;
    renderRules(await res.json());
  } catch {}
}

function renderRules(rules) {
  ruleList.innerHTML = "";
  rules.forEach((r) => {
    const div = document.createElement("div");
    div.className = "task" + (r.active ? "" : " done");
    const label = r.type === "sender" ? "Absender enthält" : "Stichwort";
    div.innerHTML = `
      <input type="checkbox" ${r.active ? "checked" : ""} title="Aktiv/Inaktiv" />
      <span class="txt"></span>
      <button title="Löschen">✕</button>
    `;
    div.querySelector(".txt").textContent = `${label}: "${r.value}"`;
    div.querySelector("input").addEventListener("change", async (e) => {
      await fetch(`/api/rules/${r.id}`, {
        method: "PATCH",
        headers: authHeaders(),
        body: JSON.stringify({ active: e.target.checked }),
      });
      loadRules();
    });
    div.querySelector("button").addEventListener("click", async () => {
      await fetch(`/api/rules/${r.id}`, { method: "DELETE", headers: authHeaders() });
      loadRules();
    });
    ruleList.appendChild(div);
  });
}

ruleForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const value = ruleValue.value.trim();
  if (!value) return;
  ruleValue.value = "";
  await fetch("/api/rules", {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ type: ruleType.value, value }),
  });
  loadRules();
});

if (getPassword()) {
  loadTasks();
  loadRules();
}
