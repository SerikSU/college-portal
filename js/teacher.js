function switchTeacherTab(tab) {
  document.getElementById("teach-tab-sheet").classList.add("hidden");
  document.getElementById("teach-tab-journal").classList.add("hidden");
  document.getElementById("btn-teach-sheet").classList.remove("active");
  document.getElementById("btn-teach-journal").classList.remove("active");

  if (tab === 'sheet') {
    document.getElementById("teach-tab-sheet").classList.remove("hidden");
    document.getElementById("btn-teach-sheet").classList.add("active");
  } else {
    document.getElementById("teach-tab-journal").classList.remove("hidden");
    document.getElementById("btn-teach-journal").classList.add("active");
    loadTeacherJournal();
  }
}

async function loadTeacherJournal() {
  const res = await fetch(`${API}/teacher/all-grades-filtered`);
  const data = await res.json();
  const tbody = document.getElementById("tbl-teacher-journal");
  tbody.innerHTML = "";
  data.grades.forEach(g => {
    const d = new Date(g.date).toLocaleDateString("ru-RU");
    tbody.innerHTML += `
      <tr>
        <td><strong>${g.student_name}</strong></td>
        <td>${g.student_card || '—'}</td>
        <td>${g.faculty_name || '—'} / ${g.group_name || '—'}</td>
        <td>${g.subject}</td>
        <td><span class="grade-badge" style="float:none;">${g.grade}</span></td>
        <td>${g.grade_type}</td>
        <td>${d}</td>
      </tr>
    `;
  });
}

async function initVedFilters() {
  const resFac = await fetch(`${API}/faculties`);
  const dataFac = await resFac.json();
  const facSel = document.getElementById("ved-fac");
  facSel.innerHTML = '<option value="">-- Все Факультеты --</option>';
  dataFac.faculties.forEach(f => facSel.innerHTML += `<option value="${f.id}">${f.name}</option>`);

  const resSub = await fetch(`${API}/subjects`);
  const dataSub = await resSub.json();
  const subSel = document.getElementById("ved-subject");
  subSel.innerHTML = '';
  dataSub.subjects.forEach(s => subSel.innerHTML += `<option value="${s.id}">${s.title}</option>`);
}

async function loadVedSpecialties() {
  const facId = document.getElementById("ved-fac").value;
  const specSel = document.getElementById("ved-spec");
  specSel.innerHTML = '<option value="">-- Все Специальности --</option>';
  document.getElementById("ved-group").innerHTML = '<option value="">-- Все Группы --</option>';
  if (!facId) return;

  const res = await fetch(`${API}/specialties/${facId}`);
  const data = await res.json();
  data.specialties.forEach(sp => specSel.innerHTML += `<option value="${sp.id}">${sp.code} ${sp.name}</option>`);
}

async function loadVedGroups() {
  const specId = document.getElementById("ved-spec").value;
  const grSel = document.getElementById("ved-group");
  grSel.innerHTML = '<option value="">-- Все Группы --</option>';
  if (!specId) return;

  const res = await fetch(`${API}/groups-by-specialty/${specId}`);
  const data = await res.json();
  data.groups.forEach(g => grSel.innerHTML += `<option value="${g.id}">${g.name}</option>`);
}

async function fillSheet() {
  const fac = document.getElementById("ved-fac").value;
  const spec = document.getElementById("ved-spec").value;
  const group = document.getElementById("ved-group").value;

  const res = await fetch(`${API}/teacher/students-filter?faculty_id=${fac}&specialty_id=${spec}&group_id=${group}`);
  const data = await res.json();
  const tbody = document.getElementById("sheet-body");
  tbody.innerHTML = "";

  if (!data.students || data.students.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">Студенты не найдены</td></tr>';
    return;
  }

  data.students.forEach((s, idx) => {
    tbody.innerHTML += `
      <tr>
        <td>${idx + 1}</td>
        <td>${s.student_card || "—"}</td>
        <td><strong>${s.full_name}</strong></td>
        <td>${s.faculty || "—"} / ${s.specialty || "—"} (${s.group_name || "—"})</td>
        <td>
          <input type="number" class="grade-input" data-id="${s.student_id}" min="1" max="100" placeholder="0-100" />
        </td>
      </tr>
    `;
  });
}

async function saveSheet() {
  const subject_id = document.getElementById("ved-subject").value;
  const grade_type = document.getElementById("ved-type").value;
  const inputs = document.querySelectorAll(".grade-input");

  const grades_data = [];
  inputs.forEach(i => {
    if (i.value.trim() !== "") grades_data.push({ student_id: i.dataset.id, grade: parseInt(i.value, 10) });
  });

  if (grades_data.length === 0) return alert("Заполните хотя бы одну оценку!");

  const res = await fetch(`${API}/teacher/grades-bulk`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ subject_id, teacher_id: currentUser.id, grade_type, grades_data })
  });

  if (res.ok) {
    document.getElementById("sheet-msg").innerText = "✅ Ведомость успешно проведена!";
    setTimeout(() => { document.getElementById("sheet-msg").innerText = ""; fillSheet(); }, 2500);
  }
}