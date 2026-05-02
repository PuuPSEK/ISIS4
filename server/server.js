const express = require("express");
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 3000;

const DATA_FILE = path.join(__dirname, "data", "requests.json");

app.use(express.json());
app.use(express.static(path.join(__dirname, "..", "public")));

function ensureDB() {
  const dir = path.dirname(DATA_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, "[]", "utf-8");
}

function readDB() {
  ensureDB();
  const raw = fs.readFileSync(DATA_FILE, "utf-8").trim();
  if (!raw) {
    fs.writeFileSync(DATA_FILE, "[]", "utf-8");
    return [];
  }
  try {
    return JSON.parse(raw);
  } catch (error) {
    console.error("DB JSON parse error:", error.message);
    fs.writeFileSync(DATA_FILE, "[]", "utf-8");
    return [];
  }
}

function writeDB(data) {
  ensureDB();
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), "utf-8");
}

function normalizeStatus(status) {
  const allowed = ["new", "in_progress", "done"];
  return allowed.includes(status) ? status : "new";
}

app.get("/api/health", (req, res) => {
  res.json({ ok: true, service: "СоцПомощь API", storage: "JSON file" });
});

app.get("/api/sos", (req, res) => {
  const { status, search } = req.query;
  let items = readDB();

  if (status && status !== "all") {
    items = items.filter((item) => item.status === status);
  }

  if (search) {
    const q = String(search).toLowerCase();
    items = items.filter((item) =>
      [item.full_name, item.phone, item.problem_text, item.address, item.volunteer_name]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q))
    );
  }

  items.sort((a, b) => Number(b.id) - Number(a.id));
  res.json(items);
});

app.get("/api/sos/stats", (req, res) => {
  const items = readDB();
  res.json({
    total: items.length,
    new: items.filter((i) => i.status === "new").length,
    in_progress: items.filter((i) => i.status === "in_progress").length,
    done: items.filter((i) => i.status === "done").length
  });
});

app.post("/api/sos", (req, res) => {
  const required = ["full_name", "phone", "age", "problem_text", "address"];
  const missing = required.filter((field) => !req.body[field]);

  if (missing.length) {
    return res.status(422).json({ error: "Не заполнены обязательные поля", missing });
  }

  const items = readDB();
  const id = items.length ? Math.max(...items.map((item) => Number(item.id))) + 1 : 1;

  const item = {
    id,
    created_at: new Date().toLocaleString("ru-RU"),
    status: "new",
    full_name: String(req.body.full_name).trim(),
    phone: String(req.body.phone).trim(),
    age: Number(req.body.age),
    problem_text: String(req.body.problem_text).trim(),
    address: String(req.body.address).trim(),
    coordinates: String(req.body.coordinates || "").trim(),
    eta_minutes: Number(req.body.eta_minutes || 15),
    volunteer_name: "",
    notification_channel: String(req.body.notification_channel || "SMS"),
    
  };

  items.push(item);
  writeDB(items);

  res.status(201).json(item);
});

app.patch("/api/sos/:id", (req, res) => {
  const items = readDB();
  const id = Number(req.params.id);
  const index = items.findIndex((item) => Number(item.id) === id);

  if (index === -1) {
    return res.status(404).json({ error: "Заявка не найдена" });
  }

  items[index] = {
    ...items[index],
    ...req.body,
    status: req.body.status ? normalizeStatus(req.body.status) : items[index].status
  };

  writeDB(items);
  res.json(items[index]);
});

app.delete("/api/sos/:id", (req, res) => {
  const id = Number(req.params.id);
  const items = readDB();
  const next = items.filter((item) => Number(item.id) !== id);

  if (next.length === items.length) {
    return res.status(404).json({ error: "Заявка не найдена" });
  }

  writeDB(next);
  res.json({ ok: true });
});

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "public", "index.html"));
});

app.use((req, res) => {
  res.sendFile(path.join(__dirname, "..", "public", "index.html"));
});

app.listen(PORT, () => {
  console.log(`СоцПомощь app started on port ${PORT}`);
});
