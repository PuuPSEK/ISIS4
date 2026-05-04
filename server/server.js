const express = require("express");
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 3000;

const DATA_FILE = path.join(__dirname, "data", "requests.json");

app.use(express.json());
app.use(express.static(path.join(__dirname, "..", "public")));

function getSeedData() {
  return [
    {
      id: 1,
      created_at: "2026-04-10 09:15",
      status: "new",
      priority: "high",
      full_name: "Мария Петровна Иванова",
      phone: "+7 391 111-11-11",
      age: 67,
      problem_text: "Нужны лекарства и помощь с давлением",
      address: "с. Берёзовка, ул. Центральная, 12",
      coordinates: "56.014, 92.893",
      eta_minutes: 15,
      volunteer_name: "",
      notification_channel: "SMS",
      manager_comment: "Перезвонить и уточнить список лекарств"
    },
    {
      id: 2,
      created_at: "2026-04-11 16:30",
      status: "in_progress",
      priority: "medium",
      full_name: "Анна Ивановна Смирнова",
      phone: "+7 391 222-22-22",
      age: 72,
      problem_text: "Нужна доставка продуктов",
      address: "Красноярск, ул. Ленина, 10",
      coordinates: "56.010, 92.852",
      eta_minutes: 18,
      volunteer_name: "Артём Смирнов",
      notification_channel: "Telegram",
      manager_comment: "Волонтёр назначен"
    },
    {
      id: 3,
      created_at: "2026-04-12 12:05",
      status: "done",
      priority: "low",
      full_name: "Иван Сергеевич Петров",
      phone: "+7 391 333-33-33",
      age: 70,
      problem_text: "Нужна помощь с покупкой продуктов",
      address: "Дивногорск, ул. Мира, 5",
      coordinates: "55.958, 92.372",
      eta_minutes: 20,
      volunteer_name: "Елена Кузнецова",
      notification_channel: "Звонок",
      manager_comment: "Помощь оказана"
    }
  ];
}

function ensureDB() {
  const dir = path.dirname(DATA_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(getSeedData(), null, 2), "utf-8");
  }
}

function readDB() {
  ensureDB();
  const raw = fs.readFileSync(DATA_FILE, "utf-8").trim();

  if (!raw) {
    const seed = getSeedData();
    fs.writeFileSync(DATA_FILE, JSON.stringify(seed, null, 2), "utf-8");
    return seed;
  }

  try {
    return JSON.parse(raw);
  } catch (error) {
    console.error("DB JSON parse error:", error.message);
    const seed = getSeedData();
    fs.writeFileSync(DATA_FILE, JSON.stringify(seed, null, 2), "utf-8");
    return seed;
  }
}

function writeDB(data) {
  ensureDB();
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), "utf-8");
}

function normalizeStatus(status) {
  return ["new", "in_progress", "done"].includes(status) ? status : "new";
}

function normalizePriority(priority) {
  return ["low", "medium", "high"].includes(priority) ? priority : "medium";
}

app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    service: "СоцПомощь Internal CRM API",
    storage: "JSON file",
    crm: "internal"
  });
});

app.get("/api/sos", (req, res) => {
  const { status, search, priority } = req.query;
  let items = readDB();

  if (status && status !== "all") items = items.filter((item) => item.status === status);
  if (priority && priority !== "all") items = items.filter((item) => item.priority === priority);

  if (search) {
    const q = String(search).toLowerCase();
    items = items.filter((item) =>
      [item.full_name, item.phone, item.problem_text, item.address, item.volunteer_name, item.manager_comment]
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
    done: items.filter((i) => i.status === "done").length,
    high: items.filter((i) => i.priority === "high").length,
    medium: items.filter((i) => i.priority === "medium").length,
    low: items.filter((i) => i.priority === "low").length
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
    priority: normalizePriority(req.body.priority || "medium"),
    full_name: String(req.body.full_name).trim(),
    phone: String(req.body.phone).trim(),
    age: Number(req.body.age),
    problem_text: String(req.body.problem_text).trim(),
    address: String(req.body.address).trim(),
    coordinates: String(req.body.coordinates || "").trim(),
    eta_minutes: Number(req.body.eta_minutes || 15),
    volunteer_name: "",
    notification_channel: String(req.body.notification_channel || "SMS"),
    manager_comment: ""
  };

  items.push(item);
  writeDB(items);

  res.status(201).json({ ok: true, message: "SOS-заявка создана во внутренней CRM", data: item });
});

app.patch("/api/sos/:id", (req, res) => {
  const items = readDB();
  const id = Number(req.params.id);
  const index = items.findIndex((item) => Number(item.id) === id);

  if (index === -1) return res.status(404).json({ error: "Заявка не найдена" });

  items[index] = {
    ...items[index],
    ...req.body,
    status: req.body.status ? normalizeStatus(req.body.status) : items[index].status,
    priority: req.body.priority ? normalizePriority(req.body.priority) : items[index].priority
  };

  writeDB(items);
  res.json(items[index]);
});

app.delete("/api/sos/:id", (req, res) => {
  const id = Number(req.params.id);
  const items = readDB();
  const next = items.filter((item) => Number(item.id) !== id);

  if (next.length === items.length) return res.status(404).json({ error: "Заявка не найдена" });

  writeDB(next);
  res.json({ ok: true });
});

app.get("/api/crm/export", (req, res) => {
  const items = readDB();
  const header = ["id", "created_at", "status", "priority", "full_name", "phone", "age", "problem_text", "address", "volunteer_name", "notification_channel", "manager_comment"];
  const rows = items.map((item) => header.map((key) => `"${String(item[key] ?? "").replaceAll('"', '""')}"`).join(";"));
  const csv = [header.join(";"), ...rows].join("\n");

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", "attachment; filename=socpomosh_requests.csv");
  res.send("\ufeff" + csv);
});

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "public", "index.html"));
});

app.use((req, res) => {
  res.sendFile(path.join(__dirname, "..", "public", "index.html"));
});

app.listen(PORT, () => {
  console.log(`СоцПомощь Internal CRM started on port ${PORT}`);
});
