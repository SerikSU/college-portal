function switchAdminTab(tab) {
  const tabs = ['faculty', 'specialty', 'group', 'subject', 'schedule', 'user', 'assign', 'password', 'list-students', 'list-teachers', 'list-schedule'];
  tabs.forEach(t => {
    document.getElementById(`adm-tab-${t}`).classList.add('hidden');
    document.getElementById(`btn-adm-${t}`).classList.remove('active');
  });
  document.getElementById(`adm-tab-${tab}`).classList.remove('hidden');
  document.getElementById(`btn-adm-${tab}`).classList.add('active');

  if (tab === 'assign') initAssignTab();
  if (tab === 'password') loadPasswordUsersList();
  if (tab === 'list-students') loadAdminStudentsList();
  if (tab === 'list-teachers') loadAdminTeachersList();
  if (tab === 'list-schedule') loadAdminScheduleList();
}

async function initAdminPanel() {
  loadFacultiesTable();
  loadSpecialtiesTable();
  populateFacDropdowns();
  initScheduleDropdowns();
}

async function populateFacDropdowns() {
  const res = await fetch(`${API}/faculties`);
  const data = await res.json();
  ['spec-fac-select', 'grp-fac-select', 'usr-fac', 'assign-fac-select'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.innerHTML = '<option value="">-- Выберите факультет --</option>';
    data.faculties.forEach(f => el.innerHTML += `<option value="${f.id}">${f.name}</option>`);
  });
}

async function initScheduleDropdowns() {
  const resG = await fetch(`${API}/admin/groups-all`);
  const dataG = await resG.json();
  const grpSel = document.getElementById("adm-sched-group");
  grpSel.innerHTML = "";
  dataG.groups.forEach(g => grpSel.innerHTML += `<option value="${g.id}">${g.name}</option>`);

  const resSub = await fetch(`${API}/subjects`);
  const dataSub = await resSub.json();
  const subSel = document.getElementById("adm-sched-subject");
  subSel.innerHTML = "";
  dataSub.subjects.forEach(s => subSel.innerHTML += `<option value="${s.id}">${s.title}</option>`);

  const resT = await fetch(`${API}/admin/teachers`);
  const dataT = await resT.json();
  const tSel = document.getElementById("adm-sched-teacher");
  tSel.innerHTML = "";
  dataT.teachers.forEach(t => tSel.innerHTML += `<option value="${t.id}">${t.full_name}</option>`);
}

async function createFaculty() {
  const name = document.getElementById("fac-name").value;
  if (!name) return alert("Введите название факультета!");
  const res = await fetch(`${API}/admin/faculties`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name })
  });
  if (res.ok) { document.getElementById("fac-name").value = ""; loadFacultiesTable(); populateFacDropdowns(); }
}

async function loadFacultiesTable() {
  const res = await fetch(`${API}/faculties`);
  const data = await res.json();
  const tbody = document.getElementById("tbl-faculties");
  tbody.innerHTML = "";
  data.faculties.forEach(f => {
    tbody.innerHTML += `<tr><td>${f.id}</td><td>${f.name}</td><td><button onclick="deleteEntity('faculties', ${f.id}, loadFacultiesTable)" class="action-btn" style="background:#e74c3c;">🗑️</button></td></tr>`;
  });
}

async function createSpecialty() {
  const faculty_id = document.getElementById("spec-fac-select").value;
  const code = document.getElementById("spec-code").value;
  const name = document.getElementById("spec-name").value;
  if (!faculty_id || !name || !code) return alert("Заполните все поля специальности!");
  const res = await fetch(`${API}/admin/specialties`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ faculty_id, code, name })
  });
  if (res.ok) { document.getElementById("spec-code").value = ""; document.getElementById("spec-name").value = ""; loadSpecialtiesTable(); }
}

async function loadSpecialtiesTable() {
  const res = await fetch(`${API}/specialties-all`);
  const data = await res.json();
  const tbody = document.getElementById("tbl-specialties");
  tbody.innerHTML = "";
  data.specialties.forEach(s => {
    tbody.innerHTML += `<tr><td>${s.code}</td><td>${s.name}</td><td>${s.faculty_name || '—'}</td><td><button onclick="deleteEntity('specialties', ${s.id}, loadSpecialtiesTable)" class="action-btn" style="background:#e74c3c;">🗑️</button></td></tr>`;
  });
}

async function loadGrpSpecs() {
  const facId = document.getElementById("grp-fac-select").value;
  const specSel = document.getElementById("grp-spec-select");
  specSel.innerHTML = "";
  if (!facId) return;
  const res = await fetch(`${API}/specialties/${facId}`);
  const data = await res.json();
  data.specialties.forEach(s => specSel.innerHTML += `<option value="${s.id}">${s.code} ${s.name}</option>`);
}

async function createGroup() {
  const specialty_id = document.getElementById("grp-spec-select").value;
  const name = document.getElementById("grp-name").value;
  if (!specialty_id || !name) return alert("Заполните все поля группы!");
  const res = await fetch(`${API}/admin/groups`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ specialty_id, name })
  });
  if (res.ok) { document.getElementById("grp-name").value = ""; alert("Группа создана!"); initScheduleDropdowns(); }
}

async function createAdminSubject() {
  const title = document.getElementById("adm-subject-title").value;
  if (!title) return alert("Введите название предмета!");
  const res = await fetch(`${API}/admin/subjects`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title })
  });
  if (res.ok) { document.getElementById("adm-subject-title").value = ""; alert("Предмет добавлен!"); initScheduleDropdowns(); }
}

async function createAdminSchedule() {
  const group_id = document.getElementById("adm-sched-group").value;
  const subject_id = document.getElementById("adm-sched-subject").value;
  const teacher_id = document.getElementById("adm-sched-teacher").value;
  const day_of_week = document.getElementById("adm-sched-day").value;
  const lesson_time = document.getElementById("adm-sched-time").value;
  const classroom = document.getElementById("adm-sched-room").value;

  const res = await fetch(`${API}/admin/schedule`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ group_id, subject_id, teacher_id, day_of_week, lesson_time, classroom })
  });
  if (res.ok) alert("Занятие добавлено в расписание!");
}

async function loadUsrSpecs() {
  const facId = document.getElementById("usr-fac").value;
  const specSel = document.getElementById("usr-spec");
  specSel.innerHTML = '<option value="">-- Выберите специальность --</option>';
  document.getElementById("usr-group").innerHTML = '';
  if (!facId) return;
  const res = await fetch(`${API}/specialties/${facId}`);
  const data = await res.json();
  data.specialties.forEach(s => specSel.innerHTML += `<option value="${s.id}">${s.code} ${s.name}</option>`);
}

async function loadUsrGroups() {
  const specId = document.getElementById("usr-spec").value;
  const grSel = document.getElementById("usr-group");
  grSel.innerHTML = '';
  if (!specId) return;
  const res = await fetch(`${API}/groups-by-specialty/${specId}`);
  const data = await res.json();
  data.groups.forEach(g => grSel.innerHTML += `<option value="${g.id}">${g.name}</option>`);
}

function toggleUserStudentFields() {
  const role = document.getElementById("usr-role").value;
  document.getElementById("usr-student-fields").style.display = role === 'student' ? 'block' : 'none';
}

async function createUser() {
  const full_name = document.getElementById("usr-fullname").value;
  const email = document.getElementById("usr-email").value;
  const password = document.getElementById("usr-password").value;
  const role = document.getElementById("usr-role").value;
  const faculty_id = document.getElementById("usr-fac").value;
  const specialty_id = document.getElementById("usr-spec").value;
  const group_id = document.getElementById("usr-group").value;
  const student_card = document.getElementById("usr-card").value;

  const res = await fetch(`${API}/admin/users`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ full_name, email, password, role, faculty_id, specialty_id, group_id, student_card })
  });
  if (res.ok) alert("Пользователь успешно создан!");
}

async function initAssignTab() {
  const res = await fetch(`${API}/admin/all-students-list`);
  const data = await res.json();
  const sel = document.getElementById("assign-student-select");
  sel.innerHTML = '<option value="">-- Выберите студента --</option>';
  data.students.forEach(s => {
    sel.innerHTML += `<option value="${s.student_id}">${s.full_name} (${s.faculty_name || 'Без факультета'} / ${s.group_name || 'Без группы'})</option>`;
  });
  populateFacDropdowns();
}

async function loadAssignSpecs() {
  const facId = document.getElementById("assign-fac-select").value;
  const specSel = document.getElementById("assign-spec-select");
  specSel.innerHTML = '<option value="">-- Выберите специальность --</option>';
  document.getElementById("assign-group-select").innerHTML = '';
  if (!facId) return;
  const res = await fetch(`${API}/specialties/${facId}`);
  const data = await res.json();
  data.specialties.forEach(s => specSel.innerHTML += `<option value="${s.id}">${s.code} ${s.name}</option>`);
}

async function loadAssignGroups() {
  const specId = document.getElementById("assign-spec-select").value;
  const grSel = document.getElementById("assign-group-select");
  grSel.innerHTML = '<option value="">-- Выберите группу --</option>';
  if (!specId) return;
  const res = await fetch(`${API}/groups-by-specialty/${specId}`);
  const data = await res.json();
  data.groups.forEach(g => grSel.innerHTML += `<option value="${g.id}">${g.name}</option>`);
}

async function saveStudentAssignment() {
  const student_id = document.getElementById("assign-student-select").value;
  const faculty_id = document.getElementById("assign-fac-select").value;
  const specialty_id = document.getElementById("assign-spec-select").value;
  const group_id = document.getElementById("assign-group-select").value;

  if (!student_id) return alert("Выберите студента!");
  const res = await fetch(`${API}/admin/students/assign`, {
    method: "PUT", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ student_id, faculty_id, specialty_id, group_id })
  });
  if (res.ok) { alert("Студент переведен/прикреплен!"); initAssignTab(); }
}

async function loadPasswordUsersList() {
  const res = await fetch(`${API}/admin/users-list`);
  const data = await res.json();
  const select = document.getElementById("adm-pwd-user");
  select.innerHTML = "";
  data.users.forEach(u => select.innerHTML += `<option value="${u.id}">${u.full_name} (${u.email} - ${u.role})</option>`);
}

async function changeUserPassword() {
  const user_id = document.getElementById("adm-pwd-user").value;
  const new_password = document.getElementById("adm-pwd-new").value;
  const res = await fetch(`${API}/admin/change-password`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_id, new_password })
  });
  if (res.ok) alert("Пароль обновлен!");
}

async function loadAdminStudentsList() {
  const res = await fetch(`${API}/admin/all-students-list`);
  const data = await res.json();
  const tbody = document.getElementById("tbl-students");
  tbody.innerHTML = "";
  data.students.forEach(s => {
    tbody.innerHTML += `<tr>
      <td>${s.full_name}</td><td>${s.email}</td>
      <td>${s.faculty_name || '—'} / ${s.group_name || '—'}</td>
      <td>${s.student_card || '—'}</td>
      <td><button onclick="deleteEntity('users', ${s.student_id}, loadAdminStudentsList)" class="action-btn" style="background:#e74c3c;">🗑️️</button></td>
    </tr>`;
  });
}

async function loadAdminTeachersList() {
  const res = await fetch(`${API}/admin/teachers-list`);
  const data = await res.json();
  const tbody = document.getElementById("tbl-teachers");
  tbody.innerHTML = "";
  data.teachers.forEach(t => {
    tbody.innerHTML += `<tr>
      <td>${t.full_name}</td><td>${t.email}</td>
      <td><button onclick="deleteEntity('users', ${t.id}, loadAdminTeachersList)" class="action-btn" style="background:#e74c3c;">🗑️</button></td>
    </tr>`;
  });
}

async function loadAdminScheduleList() {
  const res = await fetch(`${API}/admin/schedule-list`);
  const data = await res.json();
  const tbody = document.getElementById("tbl-schedule");
  tbody.innerHTML = "";
  data.schedule.forEach(s => {
    tbody.innerHTML += `<tr>
      <td>${s.group_name}</td><td>${s.day_of_week}</td><td>${s.lesson_time}</td><td>${s.subject}</td><td>${s.teacher || "—"}</td><td>${s.classroom}</td>
      <td><button onclick="deleteEntity('schedule', ${s.id}, loadAdminScheduleList)" class="action-btn" style="background:#e74c3c;">🗑️</button></td>
    </tr>`;
  });
}

async function deleteEntity(entityType, id, reloadCallback) {
  if (!confirm("Удалить эту запись?")) return;
  const res = await fetch(`${API}/admin/${entityType}/${id}`, { method: "DELETE" });
  if (res.ok && reloadCallback) reloadCallback();
}