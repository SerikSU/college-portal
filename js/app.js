const API = "http://localhost:3000/api";
let currentUser = null;

async function login() {
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;

  const res = await fetch(`${API}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password })
  });
  const data = await res.json();
  
  if (!res.ok) {
    document.getElementById("login-error").innerText = data.error || "Ошибка входа";
    return;
  }

  currentUser = data.user;
  document.getElementById("login-block").classList.add("hidden");
  document.getElementById("portal-block").classList.remove("hidden");
  document.getElementById("user-name").innerText = currentUser.full_name;
  document.getElementById("user-role").innerText = `(${currentUser.role.toUpperCase()})`;

  if (currentUser.role === 'admin') {
    document.getElementById("admin-view").classList.remove("hidden");
    document.getElementById("teacher-view").classList.add("hidden");
    document.getElementById("student-view").classList.add("hidden");
    initAdminPanel();
  } else if (currentUser.role === 'teacher') {
    document.getElementById("teacher-view").classList.remove("hidden");
    document.getElementById("admin-view").classList.add("hidden");
    document.getElementById("student-view").classList.add("hidden");
    initVedFilters();
  } else if (currentUser.role === 'student') {
    document.getElementById("student-view").classList.remove("hidden");
    document.getElementById("admin-view").classList.add("hidden");
    document.getElementById("teacher-view").classList.add("hidden");
    loadStudentGrades();
    loadStudentSchedule();
  }
}

function downloadCSV(endpoint) {
  window.location.href = `${API.replace('/api', '')}${endpoint}`;
}