async function loadStudentGrades() {
  const res = await fetch(`${API}/student/grades/${currentUser.student_id}`);
  const data = await res.json();
  const div = document.getElementById("student-grades");
  div.innerHTML = "";
  data.grades.forEach(g => {
    div.innerHTML += `<div class="card"><span class="grade-badge">${g.grade} б.</span><strong>${g.subject}</strong><br><small>Тип: ${g.grade_type} | Преподаватель: ${g.teacher || '—'}</small></div>`;
  });
}

async function loadStudentSchedule() {
  const res = await fetch(`${API}/schedule/${currentUser.group_id}`);
  const data = await res.json();
  const div = document.getElementById("student-schedule");
  div.innerHTML = "";
  data.schedule.forEach(s => {
    div.innerHTML += `<div class="card" style="border-left-color:#f39c12;"><strong>${s.day_of_week} (${s.lesson_time})</strong><br><small>${s.subject} | ${s.classroom}</small></div>`;
  });
}