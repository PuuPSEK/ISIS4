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

const priorityText = {
  high: "Высокий",
  medium: "Средний",
  low: "Низкий"
};

let currentFilter = "all";
let currentSearch = "";
let currentPriority = "all";

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

  if (!response.ok) throw new Error(data.error || "Ошибка запроса");
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

  const crmPriorityStats = document.getElementById("crmPriorityStats");
  if (crmPriorityStats) {
    crmPriorityStats.innerHTML = `
      <div class="stat"><b>${stats.high}</b><span>Высокий приоритет</span></div>
      <div class="stat"><b>${stats.medium}</b><span>Средний приоритет</span></div>
      <div class="stat"><b>${stats.low}</b><span>Низкий приоритет</span></div>
    `;
  }
}

async function loadData() {
  if (!list && !document.getElementById("crmTableBody")) return;

  try {
    const params = new URLSearchParams();
    params.set("status", currentFilter);
    params.set("priority", currentPriority);
    if (currentSearch) params.set("search", currentSearch);

    const data = await api(`/api/sos?${params.toString()}`);

    if (list) renderRequests(data);
    if (document.getElementById("crmTableBody")) renderCrmTable(data);

    loadStats();
  } catch (error) {
    if (list) {
      list.innerHTML = `
        <div class="card">
          <b>Не удалось загрузить заявки</b><br>
          <span class="muted">${error.message}</span>
        </div>
      `;
    }
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
          <span>${item.notification_channel || "SMS"}</span>
          <span class="priority ${item.priority || "medium"}">${priorityText[item.priority || "medium"]}</span>
        </div>
        <h3>${item.full_name} (${item.age})</h3>
        <p><b>Проблема:</b> ${item.problem_text}</p>
        <p><b>Телефон:</b> ${item.phone}</p>
        <p><b>Адрес:</b> ${item.address}</p>
        <p><b>Ориентир:</b> ${item.coordinates || "не указан"} · <b>ETA:</b> ${item.eta_minutes || 15} мин</p>
        <p><b>Волонтёр:</b> ${item.volunteer_name || "не назначен"}</p>
        <p><b>Комментарий менеджера:</b> ${item.manager_comment || "нет"}</p>
        <div class="status-label">${statusText[item.status] || item.status}</div>
        <div class="mt">${actions}</div>
      </article>
    `;
  });
}

function renderCrmTable(items) {
  const body = document.getElementById("crmTableBody");
  if (!body) return;

  body.innerHTML = "";

  if (!items.length) {
    body.innerHTML = `<tr><td colspan="9">Нет заявок</td></tr>`;
    return;
  }

  items.forEach((item) => {
    body.innerHTML += `
      <tr>
        <td>#${item.id}<br><span class="muted">${item.created_at || ""}</span></td>
        <td><b>${item.full_name}</b><br>${item.phone}<br>${item.age} лет</td>
        <td>${item.problem_text}</td>
        <td>${item.address}</td>
        <td>
          <select class="small-input" onchange="updateCrmField(${item.id}, 'status', this.value)">
            <option value="new" ${item.status === "new" ? "selected" : ""}>Ожидает</option>
            <option value="in_progress" ${item.status === "in_progress" ? "selected" : ""}>В работе</option>
            <option value="done" ${item.status === "done" ? "selected" : ""}>Завершена</option>
          </select>
        </td>
        <td>
          <select class="small-input" onchange="updateCrmField(${item.id}, 'priority', this.value)">
            <option value="high" ${item.priority === "high" ? "selected" : ""}>Высокий</option>
            <option value="medium" ${item.priority === "medium" ? "selected" : ""}>Средний</option>
            <option value="low" ${item.priority === "low" ? "selected" : ""}>Низкий</option>
          </select>
        </td>
        <td>
          <input class="small-input" value="${item.volunteer_name || ""}" 
                 onchange="updateCrmField(${item.id}, 'volunteer_name', this.value)"
                 placeholder="Волонтёр">
        </td>
        <td>
          <input class="small-input" value="${item.manager_comment || ""}" 
                 onchange="updateCrmField(${item.id}, 'manager_comment', this.value)"
                 placeholder="Комментарий">
        </td>
        <td class="crm-table-actions">
          <button class="btn danger" onclick="removeRequest(${item.id})">Удалить</button>
        </td>
      </tr>
    `;
  });
}

function setFilter(filter) {
  currentFilter = filter;
  loadData();
}

function setPriority(filter) {
  currentPriority = filter;
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

function updateCrmField(id, field, value) {
  updateRequest(id, { [field]: value }, "CRM-заявка обновлена");
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
    if (accessHint) accessHint.innerHTML = `Войдите как пенсионер, чтобы отправить SOS-заявку. <a href="login.html">Войти</a>`;
  } else if (role !== "pensioner") {
    form.style.display = "none";
    if (accessHint) accessHint.innerText = "Создавать SOS-заявки может только пенсионер. Волонтёр и администратор работают со списком заявок.";
  } else {
    if (accessHint) accessHint.innerText = "Заполните форму, чтобы создать заявку во внутренней CRM.";
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
      notification_channel: document.getElementById("notification_channel")?.value || "SMS",
      priority: document.getElementById("priority")?.value || "medium"
    };

    try {
      await api("/api/sos", {
        method: "POST",
        body: JSON.stringify(payload)
      });
      notify("SOS-заявка создана во внутренней CRM");
      setTimeout(() => location.href = "history.html", 700);
    } catch (error) {
      alert(error.message);
    }
  });
}

window.login = login;
window.logout = logout;
window.setFilter = setFilter;
window.setPriority = setPriority;
window.setSearch = setSearch;
window.take = take;
window.finish = finish;
window.setStatus = setStatus;
window.updateCrmField = updateCrmField;
window.removeRequest = removeRequest;

loadData();
loadStats();
