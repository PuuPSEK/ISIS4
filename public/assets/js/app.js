let data = JSON.parse(localStorage.getItem("sos")) || [];
const role = localStorage.getItem("role");

/* =======================
   РОЛЬ UI
======================= */
const badge = document.getElementById("roleBadge");
if (badge) {
  const icons = {
    pensioner: "👵 Пенсионер",
    volunteer: "🧑‍⚕️ Волонтёр",
    admin: "🛠 Администратор"
  };
  badge.innerHTML = icons[role] || "Гость";
}

/* =======================
   КНОПКА ВХОДА / ВЫХОДА
======================= */
const loginBtn = document.getElementById("loginBtn");

if (loginBtn) {
  if (role) {
    loginBtn.innerText = "Сменить пользователя";
    loginBtn.href = "javascript:logout()";
  } else {
    loginBtn.innerText = "Вход";
    loginBtn.href = "login.html";
  }
}

/* =======================
   LOGOUT (СМЕНА ПОЛЬЗОВАТЕЛЯ)
======================= */
function logout() {
  localStorage.removeItem("role");
  location.href = "login.html";
}

/* =======================
   ТЕСТОВЫЕ ДАННЫЕ
======================= */
if (!data.length) {
  data = [
    { id: 1, full_name: "Мария", phone: "111", age: 70, problem_text: "Давление", address: "Дом 1", status: "new" },
    { id: 2, full_name: "Иван", phone: "222", age: 74, problem_text: "Лекарства", address: "Дом 2", status: "in_progress" },
    { id: 3, full_name: "Анна", phone: "333", age: 68, problem_text: "Еда", address: "Дом 3", status: "done" }
  ];
  localStorage.setItem("sos", JSON.stringify(data));
}

/* =======================
   ПЕРЕВОД СТАТУСОВ
======================= */
function getStatusText(status) {
  switch (status) {
    case "new":
      return "🟣 Ожидает помощи";
    case "in_progress":
      return "🔵 В работе у волонтёра";
    case "done":
      return "🟢 Помощь оказана";
    default:
      return "Неизвестно";
  }
}

/* =======================
   СОЗДАНИЕ (ТОЛЬКО ПЕНСИОНЕР)
======================= */
document.getElementById("sosForm")?.addEventListener("submit", e => {
  e.preventDefault();

  if (role !== "pensioner") {
    alert("Создавать заявки может только пенсионер");
    return;
  }

  const item = {
    id: Date.now(),
    full_name: full_name.value,
    phone: phone.value,
    age: age.value,
    problem_text: problem_text.value,
    address: address.value,
    status: "new",
    created_at: new Date().toLocaleString()
  };

  data.push(item);
  localStorage.setItem("sos", JSON.stringify(data));

  alert("Заявка отправлена");
  e.target.reset();
  render();
});

/* =======================
   ДЕЙСТВИЯ
======================= */
function take(id) {
  if (role !== "volunteer") return;
  updateStatus(id, "in_progress");
}

function setStatus(id, status) {
  if (role !== "admin") return;
  updateStatus(id, status);
}

function updateStatus(id, status) {
  data = data.map(i =>
    i.id === id ? { ...i, status } : i
  );

  localStorage.setItem("sos", JSON.stringify(data));
  render();
}

/* =======================
   РЕНДЕР
======================= */
const list = document.getElementById("list");

function render() {
  if (!list) return;

  list.innerHTML = "";

  data.forEach(item => {
    let actions = "";

    if (role === "volunteer") {
      actions = `<button class="btn" onclick="take(${item.id})">Принять заявку</button>`;
    }

    if (role === "admin") {
      actions = `
        <button class="btn secondary" onclick="setStatus(${item.id}, 'in_progress')">В работу</button>
        <button class="btn danger" onclick="setStatus(${item.id}, 'done')">Завершить</button>
      `;
    }

    list.innerHTML += `
      <div class="card ${item.status}">
        <b>${item.full_name}</b> (${item.age})<br>
        📞 ${item.phone}<br>
        ⚠ ${item.problem_text}<br>
        📍 ${item.address}<br>
        <div>${getStatusText(item.status)}</div>
        ${actions}
      </div>
    `;
  });
}

render();