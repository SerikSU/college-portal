require('dotenv').config();
const { Pool } = require('pg');
const bcrypt = require('bcrypt');

const SALT_ROUNDS = 10;

const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'my_app_db',
  password: process.env.DB_PASSWORD || 'postgres',
  port: process.env.DB_PORT || 5432,
});

async function seedDatabase() {
  const client = await pool.connect();

  try {
    console.log('⏳ Пересоздаем таблицы с факультетами и специальностями...');
    await client.query('BEGIN');

    await client.query(`
      DROP TABLE IF EXISTS grades CASCADE;
      DROP TABLE IF EXISTS schedule CASCADE;
      DROP TABLE IF EXISTS students CASCADE;
      DROP TABLE IF EXISTS groups CASCADE;
      DROP TABLE IF EXISTS specialties CASCADE;
      DROP TABLE IF EXISTS faculties CASCADE;
      DROP TABLE IF EXISTS subjects CASCADE;
      DROP TABLE IF EXISTS users CASCADE;
    `);

    await client.query(`
      CREATE TABLE users (
        id SERIAL PRIMARY KEY,
        full_name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        role VARCHAR(50) NOT NULL CHECK (role IN ('student', 'teacher', 'admin')),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE faculties (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE
      );

      CREATE TABLE specialties (
        id SERIAL PRIMARY KEY,
        faculty_id INT REFERENCES faculties(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        code VARCHAR(50) NOT NULL
      );

      CREATE TABLE groups (
        id SERIAL PRIMARY KEY,
        specialty_id INT REFERENCES specialties(id) ON DELETE CASCADE,
        name VARCHAR(100) NOT NULL UNIQUE
      );

      CREATE TABLE subjects (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL UNIQUE
      );

      CREATE TABLE students (
        id SERIAL PRIMARY KEY,
        user_id INT UNIQUE REFERENCES users(id) ON DELETE CASCADE,
        faculty_id INT REFERENCES faculties(id) ON DELETE SET NULL,
        specialty_id INT REFERENCES specialties(id) ON DELETE SET NULL,
        group_id INT REFERENCES groups(id) ON DELETE SET NULL,
        student_card VARCHAR(100) UNIQUE
      );

      CREATE TABLE schedule (
        id SERIAL PRIMARY KEY,
        group_id INT REFERENCES groups(id) ON DELETE CASCADE,
        subject_id INT REFERENCES subjects(id) ON DELETE CASCADE,
        teacher_id INT REFERENCES users(id) ON DELETE SET NULL,
        day_of_week VARCHAR(50) NOT NULL,
        lesson_time VARCHAR(50) NOT NULL,
        classroom VARCHAR(50) NOT NULL
      );

      CREATE TABLE grades (
        id SERIAL PRIMARY KEY,
        student_id INT REFERENCES students(id) ON DELETE CASCADE,
        subject_id INT REFERENCES subjects(id) ON DELETE CASCADE,
        teacher_id INT REFERENCES users(id) ON DELETE SET NULL,
        grade INT CHECK (grade >= 1 AND grade <= 100),
        grade_type VARCHAR(50) DEFAULT 'Текущая',
        date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    const defaultPasswordHash = await bcrypt.hash('123456', SALT_ROUNDS);

    // Админ и преподаватели
    await client.query(`
      INSERT INTO users (full_name, email, password, role) 
      VALUES ('Администратор Системы', 'admin@college.kz', $1, 'admin');
    `, [defaultPasswordHash]);

    const teacher1Res = await client.query(`
      INSERT INTO users (full_name, email, password, role) 
      VALUES ('Ахметов Серик Болатович', 'teacher1@college.kz', $1, 'teacher') RETURNING id;
    `, [defaultPasswordHash]);

    // Факультеты и Специальности
    const fac1 = await client.query(`INSERT INTO faculties (name) VALUES ('Информационные технологии') RETURNING id;`);
    const fac2 = await client.query(`INSERT INTO faculties (name) VALUES ('Медицина и Фармация') RETURNING id;`);

    const spec1 = await client.query(`
      INSERT INTO specialties (faculty_id, name, code) VALUES ($1, 'Программное обеспечение', '6B06101') RETURNING id;
    `, [fac1.rows[0].id]);

    const spec2 = await client.query(`
      INSERT INTO specialties (faculty_id, name, code) VALUES ($1, 'Сетевое администрирование', '6B06102') RETURNING id;
    `, [fac1.rows[0].id]);

    // Группы
    const gr1 = await client.query(`INSERT INTO groups (specialty_id, name) VALUES ($1, 'ПО-23') RETURNING id;`, [spec1.rows[0].id]);
    const gr2 = await client.query(`INSERT INTO groups (specialty_id, name) VALUES ($1, 'СА-23') RETURNING id;`, [spec2.rows[0].id]);

    // Студенты
    const stUser1 = await client.query(`
      INSERT INTO users (full_name, email, password, role) 
      VALUES ('Куандыков Нурсултан Калдарбекович', 'student1@college.kz', $1, 'student') RETURNING id;
    `, [defaultPasswordHash]);

    const stUser2 = await client.query(`
      INSERT INTO users (full_name, email, password, role) 
      VALUES ('Петров Алексей Игоревич', 'student2@college.kz', $1, 'student') RETURNING id;
    `, [defaultPasswordHash]);

    await client.query(`
      INSERT INTO students (user_id, faculty_id, specialty_id, group_id, student_card)
      VALUES 
        ($1, $2, $3, $4, 'ST-000000001'),
        ($5, $2, $3, $4, 'ST-000000002');
    `, [stUser1.rows[0].id, fac1.rows[0].id, spec1.rows[0].id, gr1.rows[0].id, stUser2.rows[0].id]);

    const sub1 = await client.query(`INSERT INTO subjects (title) VALUES ('Веб-разработка') RETURNING id;`);

    await client.query('COMMIT');
    console.log('🎉 БД успешно инициализирована с Факультетами и Специальностями!');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Ошибка инициализации:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

seedDatabase();