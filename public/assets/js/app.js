const role = localStorage.getItem("role");

const roles = {
  pensioner: "👵 Пенсионер",
  volunteer: "🧑‍⚕️ Волонтёр",
  admin: "🛠 Администратор"
};

const statusText = {
  new: "🟣 Ожидает помощи",
  in_progress: "🔵 В работе у волонтёра",
  done: "🟢 Помощь оказана"
};

let currentFilter = "all";
let currentSearch = "";

const badge = document.getElementById("roleBadge");
const loginBtn = document.getElementById("loginBtn");
const list = document.getElementById("list");
const form = document.getElementById("sosForm");
const accessHint = document.getElementById("accessHint") || document.getElementById("roleHint");
const emptyState = document.getElementById("emptyState");

if (badge) badge.innerText = roles[role] || "Гость";

if (loginBtn) {
  loginBtn.innerText = role ? "Сменить пользователя" : "Вход";
  loginBtn.href = role ? "javascript:logout()" : "login.html";
}

function logout() {
  localStorage.removeItem("role");
  location.href = "login.html";
}

function login(roleName) {
  localStorage.setItem("role", roleName);
  location.href = "index.html";
}

function notify(text) {
  const n = document.createElement("div");
  n.className = "notify";
  n.innerText = text;
  document.body.appendChild(n);
  setTimeout(() => n.remove(), 2500);
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...options
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || "Ошибка запроса");
  }

  return data;
}

async function loadStats() {
  const box = document.getElementById("statsBox");
  if (!box) return;

  const stats = await api("/api/sos/stats");
  box.innerHTML = `
    <div class="stat"><b>${stats.total}</b><span>Всего заявок</span></div>
    <div class="stat"><b>${stats.new}</b><span>Ожидают</span></div>
    <div class="stat"><b>${stats.in_progress}</b><span>В работе</span></div>
    <div class="stat"><b>${stats.done}</b><span>Завершены</span></div>
  `;
}

async function loadData() {
  if (!list) return;

  try {
    const params = new URLSearchParams();
    params.set("status", currentFilter);
    if (currentSearch) params.set("search", currentSearch);

    const data = await api(`/api/sos?${params.toString()}`);
    renderRequests(data);
    loadStats();
  } catch (error) {
    list.innerHTML = `
      <div class="card">
        <b>Не удалось загрузить заявки</b><br>
        <span class="muted">${error.message}</span>
      </div>
    `;
  }
}

function renderRequests(items) {
  if (!list) return;

  list.innerHTML = "";
  if (emptyState) emptyState.style.display = items.length ? "none" : "block";

  if (!items.length) return;

  items.forEach((item) => {
    let actions = "";

    if (role === "volunteer" && item.status === "new") {
      actions += `<button class="btn success" onclick="take(${item.id})">Принять заявку</button>`;
    }

    if (role === "volunteer" && item.status === "in_progress") {
      actions += `<button class="btn secondary" onclick="finish(${item.id})">Помощь оказана</button>`;
    }

    if (role === "admin") {
      actions += `
        <button class="btn" onclick="setStatus(${item.id}, 'new')">Ожидает</button>
        <button class="btn secondary" onclick="setStatus(${item.id}, 'in_progress')">В работу</button>
        <button class="btn success" onclick="setStatus(${item.id}, 'done')">Завершить</button>
        <button class="btn danger" onclick="removeRequest(${item.id})">Удалить</button>
      `;
    }

    list.innerHTML += `
      <article class="card request-card ${item.status}">
        <div class="meta">
          <span>#${item.id}</span>
          <span>${item.created_at || ""}</span>
          <span></span>
          <span>${item.notification_channel || "SMS"}</span>
        </div>

        <h3>${item.full_name} (${item.age})</h3>
        <p><b>Проблема:</b> ${item.problem_text}</p>
        <p><b>Телефон:</b> ${item.phone}</p>
        <p><b>Адрес:</b> ${item.address}</p>
        <p><b>Координаты:</b> ${item.coordinates || "не указаны"} · <b>ETA:</b> ${item.eta_minutes || 15} мин</p>
        <p><b>Волонтёр:</b> ${item.volunteer_name || "не назначен"}</p>

        <div class="status-label">${statusText[item.status] || item.status}</div>
        <div class="mt">${actions}</div>
      </article>
    `;
  });
}

function setFilter(filter) {
  currentFilter = filter;
  loadData();
}

function setSearch(value) {
  currentSearch = value.trim();
  loadData();
}

async function updateRequest(id, payload, text = "Заявка обновлена") {
  await api(`/api/sos/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload)
  });
  notify(text);
  loadData();
}

function take(id) {
  if (role !== "volunteer") return;
  const name = prompt("Введите имя волонтёра:", "Артём Смирнов") || "Волонтёр";
  updateRequest(id, { status: "in_progress", volunteer_name: name }, "Заявка принята волонтёром");
}

function finish(id) {
  if (role !== "volunteer") return;
  updateRequest(id, { status: "done" }, "Заявка завершена");
}

function setStatus(id, status) {
  if (role !== "admin") return;
  updateRequest(id, { status }, "Статус изменён администратором");
}

async function removeRequest(id) {
  if (role !== "admin") return;
  if (!confirm("Удалить заявку?")) return;

  await api(`/api/sos/${id}`, { method: "DELETE" });
  notify("Заявка удалена");
  loadData();
}

if (form) {
  if (!role) {
    form.style.display = "none";
    if (accessHint) accessHint.innerText = "Войдите в систему, чтобы отправить SOS-заявку.";
  } else if (role !== "pensioner") {
    form.style.display = "none";
    if (accessHint) accessHint.innerText = "Создавать SOS-заявки может только пенсионер. Волонтёр и администратор работают со списком заявок.";
  } else {
    if (accessHint) accessHint.innerText = "Вы вошли как пенсионер. Заполните форму, чтобы отправить заявку волонтёрам.";
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const payload = {
      full_name: document.getElementById("full_name").value.trim(),
      phone: document.getElementById("phone").value.trim(),
      age: Number(document.getElementById("age").value),
      problem_text: document.getElementById("problem_text").value.trim(),
      address: document.getElementById("address").value.trim(),
      coordinates: document.getElementById("coordinates")?.value.trim() || "",
      eta_minutes: Number(document.getElementById("eta_minutes")?.value || 15),
      notification_channel: document.getElementById("notification_channel")?.value || "SMS"
    };

    try {
      await api("/api/sos", {
        method: "POST",
        body: JSON.stringify(payload)
      });

      form.reset();
      notify("SOS-заявка отправлена");
      setTimeout(() => location.href = "history.html", 700);
    } catch (error) {
      alert(error.message);
    }
  });
}

window.login = login;
window.logout = logout;
window.setFilter = setFilter;
window.setSearch = setSearch;
window.take = take;
window.finish = finish;
window.setStatus = setStatus;
window.removeRequest = removeRequest;

loadData();
loadStats();

