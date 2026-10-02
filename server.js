require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcrypt');

const app = express();
const port = process.env.PORT || 3000;
const SALT_ROUNDS = 10;

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'my_app_db',
  password: process.env.DB_PASSWORD || 'postgres',
  port: process.env.DB_PORT || 5432,
});

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

// 1. АВТОРИЗАЦИЯ
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const userQuery = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (userQuery.rows.length === 0) return res.status(401).json({ error: 'Неверный email или пароль' });

    const user = userQuery.rows[0];
    const isPasswordValid = user.password.startsWith('$2')
      ? await bcrypt.compare(password, user.password)
      : password === user.password;

    if (!isPasswordValid) return res.status(401).json({ error: 'Неверный email или пароль' });
    delete user.password;

    if (user.role === 'student') {
      const st = await pool.query('SELECT id as student_id, group_id, faculty_id, specialty_id FROM students WHERE user_id = $1', [user.id]);
      if (st.rows.length > 0) Object.assign(user, st.rows[0]);
    }

    res.json({ success: true, user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2. СПРАВОЧНИКИ
app.get('/api/faculties', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM faculties ORDER BY name');
    res.json({ success: true, faculties: result.rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/specialties-all', async (req, res) => {
  try {
    const query = `
      SELECT s.id, s.name, s.code, f.name as faculty_name 
      FROM specialties s 
      LEFT JOIN faculties f ON s.faculty_id = f.id 
      ORDER BY f.name, s.name;
    `;
    const result = await pool.query(query);
    res.json({ success: true, specialties: result.rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/specialties/:facultyId', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM specialties WHERE faculty_id = $1 ORDER BY name', [req.params.facultyId]);
    res.json({ success: true, specialties: result.rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/groups-by-specialty/:specialtyId', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM groups WHERE specialty_id = $1 ORDER BY name', [req.params.specialtyId]);
    res.json({ success: true, groups: result.rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/admin/groups-all', async (req, res) => {
  try {
    const query = `
      SELECT g.id, g.name, sp.name as specialty_name, f.name as faculty_name 
      FROM groups g 
      LEFT JOIN specialties sp ON g.specialty_id = sp.id 
      LEFT JOIN faculties f ON sp.faculty_id = f.id 
      ORDER BY g.name;
    `;
    const result = await pool.query(query);
    res.json({ success: true, groups: result.rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/subjects', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM subjects ORDER BY title');
    res.json({ success: true, subjects: result.rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/admin/teachers', async (req, res) => {
  try {
    const result = await pool.query("SELECT id, full_name FROM users WHERE role = 'teacher' ORDER BY full_name");
    res.json({ success: true, teachers: result.rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/admin/all-students-list', async (req, res) => {
  try {
    const query = `
      SELECT s.id AS student_id, u.full_name, u.email, s.student_card, f.name AS faculty_name, sp.name AS specialty_name, g.name AS group_name
      FROM students s
      JOIN users u ON s.user_id = u.id
      LEFT JOIN faculties f ON s.faculty_id = f.id
      LEFT JOIN specialties sp ON s.specialty_id = sp.id
      LEFT JOIN groups g ON s.group_id = g.id
      ORDER BY u.full_name;
    `;
    const result = await pool.query(query);
    res.json({ success: true, students: result.rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/admin/teachers-list', async (req, res) => {
  try {
    const result = await pool.query("SELECT id, full_name, email FROM users WHERE role = 'teacher' ORDER BY full_name");
    res.json({ success: true, teachers: result.rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/admin/users-list', async (req, res) => {
  try {
    const result = await pool.query("SELECT id, full_name, email, role FROM users ORDER BY full_name");
    res.json({ success: true, users: result.rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/admin/schedule-list', async (req, res) => {
  try {
    const query = `
      SELECT s.id, g.name AS group_name, sub.title AS subject, u.full_name AS teacher, s.day_of_week, s.lesson_time, s.classroom
      FROM schedule s
      JOIN groups g ON s.group_id = g.id
      JOIN subjects sub ON s.subject_id = sub.id
      LEFT JOIN users u ON s.teacher_id = u.id
      ORDER BY g.name, s.day_of_week, s.lesson_time;
    `;
    const result = await pool.query(query);
    res.json({ success: true, schedule: result.rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// 3. ПРЕПОДАВАТЕЛЬ (Загрузка списка и Сохраненных оценок)
app.get('/api/teacher/students-filter', async (req, res) => {
  const { faculty_id, specialty_id, group_id } = req.query;
  try {
    let query = `
      SELECT s.id AS student_id, u.full_name, s.student_card, f.name AS faculty, sp.name AS specialty, g.name AS group_name
      FROM students s
      JOIN users u ON s.user_id = u.id
      LEFT JOIN faculties f ON s.faculty_id = f.id
      LEFT JOIN specialties sp ON s.specialty_id = sp.id
      LEFT JOIN groups g ON s.group_id = g.id
      WHERE 1=1
    `;
    const params = [];
    if (faculty_id) { params.push(faculty_id); query += ` AND s.faculty_id = $${params.length}`; }
    if (specialty_id) { params.push(specialty_id); query += ` AND s.specialty_id = $${params.length}`; }
    if (group_id) { params.push(group_id); query += ` AND s.group_id = $${params.length}`; }

    query += ' ORDER BY u.full_name';
    const result = await pool.query(query, params);
    res.json({ success: true, students: result.rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Список всех сохраненных оценок для журнала преподавателя
app.get('/api/teacher/all-grades-filtered', async (req, res) => {
  try {
    const query = `
      SELECT g.id, u.full_name AS student_name, s.student_card, gr.name AS group_name, f.name AS faculty_name, sub.title AS subject, g.grade, g.grade_type, g.date
      FROM grades g
      JOIN students s ON g.student_id = s.id
      JOIN users u ON s.user_id = u.id
      LEFT JOIN faculties f ON s.faculty_id = f.id
      LEFT JOIN groups gr ON s.group_id = gr.id
      JOIN subjects sub ON g.subject_id = sub.id
      ORDER BY g.date DESC;
    `;
    const result = await pool.query(query);
    res.json({ success: true, grades: result.rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/teacher/grades-bulk', async (req, res) => {
  const { subject_id, teacher_id, grade_type, grades_data } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const item of grades_data) {
      if (item.grade !== null && item.grade !== '') {
        await client.query(
          `INSERT INTO grades (student_id, subject_id, teacher_id, grade, grade_type) VALUES ($1, $2, $3, $4, $5)`,
          [item.student_id, subject_id, teacher_id, item.grade, grade_type]
        );
      }
    }
    await client.query('COMMIT');
    res.json({ success: true, message: 'Ведомость сохранена!' });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally { client.release(); }
});

// 4. СТУДЕНТ
app.get('/api/student/grades/:studentId', async (req, res) => {
  try {
    const query = `
      SELECT g.id, sub.title AS subject, u.full_name AS teacher, g.grade, g.grade_type, g.date
      FROM grades g JOIN subjects sub ON g.subject_id = sub.id LEFT JOIN users u ON g.teacher_id = u.id
      WHERE g.student_id = $1 ORDER BY g.date DESC;
    `;
    const result = await pool.query(query, [req.params.studentId]);
    res.json({ success: true, grades: result.rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/schedule/:groupId', async (req, res) => {
  try {
    const query = `
      SELECT s.id, s.day_of_week, s.lesson_time, s.classroom, sub.title AS subject, u.full_name AS teacher
      FROM schedule s JOIN subjects sub ON s.subject_id = sub.id LEFT JOIN users u ON s.teacher_id = u.id
      WHERE s.group_id = $1 ORDER BY s.day_of_week, s.lesson_time;
    `;
    const result = await pool.query(query, [req.params.groupId]);
    res.json({ success: true, schedule: result.rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// 5. АДМИНИСТРИРОВАНИЕ
app.post('/api/admin/faculties', async (req, res) => {
  try {
    const resu = await pool.query('INSERT INTO faculties (name) VALUES ($1) RETURNING *', [req.body.name]);
    res.json({ success: true, faculty: resu.rows[0] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/admin/faculties/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM faculties WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/admin/specialties', async (req, res) => {
  try {
    const resu = await pool.query('INSERT INTO specialties (faculty_id, name, code) VALUES ($1, $2, $3) RETURNING *', [req.body.faculty_id, req.body.name, req.body.code]);
    res.json({ success: true, specialty: resu.rows[0] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/admin/specialties/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM specialties WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/admin/groups', async (req, res) => {
  try {
    const resu = await pool.query('INSERT INTO groups (specialty_id, name) VALUES ($1, $2) RETURNING *', [req.body.specialty_id, req.body.name]);
    res.json({ success: true, group: resu.rows[0] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/admin/subjects', async (req, res) => {
  try {
    const resu = await pool.query('INSERT INTO subjects (title) VALUES ($1) RETURNING *', [req.body.title]);
    res.json({ success: true, subject: resu.rows[0] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/admin/schedule', async (req, res) => {
  const { group_id, subject_id, teacher_id, day_of_week, lesson_time, classroom } = req.body;
  try {
    const query = `INSERT INTO schedule (group_id, subject_id, teacher_id, day_of_week, lesson_time, classroom) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`;
    const resu = await pool.query(query, [group_id, subject_id, teacher_id, day_of_week, lesson_time, classroom]);
    res.json({ success: true, schedule: resu.rows[0] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/admin/users', async (req, res) => {
  const { full_name, email, password, role, faculty_id, specialty_id, group_id, student_card } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const hash = await bcrypt.hash(password, SALT_ROUNDS);
    const u = await client.query('INSERT INTO users (full_name, email, password, role) VALUES ($1, $2, $3, $4) RETURNING id', [full_name, email, hash, role]);
    
    if (role === 'student') {
      await client.query(
        'INSERT INTO students (user_id, faculty_id, specialty_id, group_id, student_card) VALUES ($1, $2, $3, $4, $5)',
        [u.rows[0].id, faculty_id || null, specialty_id || null, group_id || null, student_card || `ST-${Date.now().toString().slice(-6)}`]
      );
    }
    await client.query('COMMIT');
    res.json({ success: true });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally { client.release(); }
});

app.put('/api/admin/students/assign', async (req, res) => {
  const { student_id, faculty_id, specialty_id, group_id } = req.body;
  try {
    await pool.query(
      `UPDATE students SET faculty_id = $1, specialty_id = $2, group_id = $3 WHERE id = $4`,
      [faculty_id || null, specialty_id || null, group_id || null, student_id]
    );
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/admin/change-password', async (req, res) => {
  const { user_id, new_password } = req.body;
  try {
    const hashedPassword = await bcrypt.hash(new_password, SALT_ROUNDS);
    await pool.query('UPDATE users SET password = $1 WHERE id = $2', [hashedPassword, user_id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/admin/users/:id', async (req, res) => {
  try { await pool.query('DELETE FROM users WHERE id = $1', [req.params.id]); res.json({ success: true }); } 
  catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/admin/schedule/:id', async (req, res) => {
  try { await pool.query('DELETE FROM schedule WHERE id = $1', [req.params.id]); res.json({ success: true }); } 
  catch (err) { res.status(500).json({ error: err.message }); }
});

// 6. ЭКСПОРТ В CSV
function sendCsvResponse(res, filename, headers, rows) {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
  let csvContent = '\uFEFF' + headers.join(';') + '\n';
  rows.forEach(row => {
    const escapedRow = row.map(field => `"${String(field ?? '').replace(/"/g, '""')}"`);
    csvContent += escapedRow.join(';') + '\n';
  });
  res.send(csvContent);
}

app.get('/api/export/grades', async (req, res) => {
  try {
    const query = `
      SELECT u.full_name AS student_name, gr.name AS group_name, sub.title AS subject, g.grade, g.grade_type, g.date
      FROM grades g JOIN students s ON g.student_id = s.id JOIN users u ON s.user_id = u.id LEFT JOIN groups gr ON s.group_id = gr.id JOIN subjects sub ON g.subject_id = sub.id ORDER BY g.date DESC;
    `;
    const result = await pool.query(query);
    sendCsvResponse(res, 'Журнал_Оценок.csv', ['Студент', 'Группа', 'Предмет', 'Оценка', 'Тип', 'Дата'], result.rows.map(g => [g.student_name, g.group_name || '—', g.subject, g.grade, g.grade_type, new Date(g.date).toLocaleDateString('ru-RU')]));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/export/students', async (req, res) => {
  try {
    const query = `
      SELECT u.full_name, u.email, g.name AS group_name, s.student_card FROM students s JOIN users u ON s.user_id = u.id LEFT JOIN groups g ON s.group_id = g.id ORDER BY g.name, u.full_name;
    `;
    const result = await pool.query(query);
    sendCsvResponse(res, 'Список_Студентов.csv', ['ФИО', 'Email', 'Группа', 'Студ. билет'], result.rows.map(s => [s.full_name, s.email, s.group_name || '—', s.student_card || '—']));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/export/schedule', async (req, res) => {
  try {
    const query = `
      SELECT g.name AS group_name, s.day_of_week, s.lesson_time, sub.title AS subject, u.full_name AS teacher, s.classroom FROM schedule s JOIN groups g ON s.group_id = g.id JOIN subjects sub ON s.subject_id = sub.id LEFT JOIN users u ON s.teacher_id = u.id ORDER BY g.name, s.day_of_week, s.lesson_time;
    `;
    const result = await pool.query(query);
    sendCsvResponse(res, 'Расписание.csv', ['Группа', 'День', 'Время', 'Предмет', 'Преподаватель', 'Кабинет'], result.rows.map(s => [s.group_name, s.day_of_week, s.lesson_time, s.subject, s.teacher || '—', s.classroom]));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.listen(port, () => console.log(`Сервер с журналом оценок работает на http://localhost:${port}`));