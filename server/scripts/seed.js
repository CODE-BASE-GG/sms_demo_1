/**
 * Optional demo data so the app is useful immediately after connecting it.
 *
 * Demo accounts:
 *   Admin   - admin@sunnycampus.test   / admin123
 *   Teacher - teacher@sunnycampus.test / teacher123
 *   Teacher - james@sunnycampus.test   / teacher123
 *
 * The script is safe to run more than once: it checks for existing rows first.
 */
const bcrypt = require('bcryptjs');
const { pool } = require('../src/db');
const { writeLog } = require('../src/utils/audit');

async function one(sql, params = []) {
  const [rows] = await pool.query(sql, params);
  return rows[0] || null;
}

async function ensureStaff(table, pk, name, email, password) {
  const existing = await one(
    `SELECT \`${pk}\`, \`Name\` FROM \`${table}\` WHERE \`Email\` = ? LIMIT 1`,
    [email],
  );
  if (existing) return existing[pk];

  const hash = await bcrypt.hash(password, 10);
  const [result] = await pool.query(
    `INSERT INTO \`${table}\` (\`Name\`, \`Email\`, \`Password\`) VALUES (?, ?, ?)`,
    [name, email, hash],
  );
  return result.insertId;
}

async function ensureCourse(name) {
  const existing = await one('SELECT `CourseID` FROM `Course` WHERE `CourseName` = ?', [name]);
  if (existing) return existing.CourseID;
  const [result] = await pool.query('INSERT INTO `Course` (`CourseName`) VALUES (?)', [name]);
  return result.insertId;
}

async function ensureSubject(name) {
  const existing = await one('SELECT `SubjectID` FROM `Subject` WHERE `SubjectName` = ?', [name]);
  if (existing) return existing.SubjectID;
  const [result] = await pool.query('INSERT INTO `Subject` (`SubjectName`) VALUES (?)', [name]);
  return result.insertId;
}

async function ensureCourseSubject(courseId, subjectId) {
  const existing = await one(
    'SELECT 1 FROM `CourseSubject` WHERE `CourseID` = ? AND `SubjectID` = ?',
    [courseId, subjectId],
  );
  if (!existing) {
    await pool.query('INSERT INTO `CourseSubject` (`CourseID`, `SubjectID`) VALUES (?, ?)', [
      courseId,
      subjectId,
    ]);
  }
}

async function ensureSection(courseId, sectionName) {
  const existing = await one(
    'SELECT `SectionID` FROM `Section` WHERE `CourseID` = ? AND `SectionName` = ?',
    [courseId, sectionName],
  );
  if (existing) return existing.SectionID;
  const [result] = await pool.query(
    'INSERT INTO `Section` (`CourseID`, `SectionName`) VALUES (?, ?)',
    [courseId, sectionName],
  );
  return result.insertId;
}

async function ensureSectionSubject(sectionId, subjectId, teacherId) {
  const existing = await one(
    'SELECT 1 FROM `SectionSubject` WHERE `SectionID` = ? AND `SubjectID` = ?',
    [sectionId, subjectId],
  );
  if (!existing) {
    await pool.query(
      'INSERT INTO `SectionSubject` (`SectionID`, `SubjectID`, `TeacherID`) VALUES (?, ?, ?)',
      [sectionId, subjectId, teacherId],
    );
  }
}

async function ensureStudent(sectionId, name, email, status = 'Active') {
  const existing = await one('SELECT `StudentID` FROM `Student` WHERE `Email` = ?', [email]);
  if (existing) return existing.StudentID;
  const [result] = await pool.query(
    'INSERT INTO `Student` (`SectionID`, `Name`, `Email`, `Status`) VALUES (?, ?, ?, ?)',
    [sectionId, name, email, status],
  );
  return result.insertId;
}

async function ensureAssessment(subjectId, title, maxScore, type) {
  const existing = await one(
    'SELECT `AssessmentID` FROM `Assessment` WHERE `SubjectID` = ? AND `Title` = ?',
    [subjectId, title],
  );
  if (existing) return existing.AssessmentID;
  const [result] = await pool.query(
    'INSERT INTO `Assessment` (`SubjectID`, `Title`, `MaxScore`, `AssessmentType`) VALUES (?, ?, ?, ?)',
    [subjectId, title, maxScore, type],
  );
  return result.insertId;
}

async function ensureScore(assessmentId, studentId, score, remarks) {
  const existing = await one(
    'SELECT 1 FROM `StudentScore` WHERE `AssessmentID` = ? AND `StudentID` = ?',
    [assessmentId, studentId],
  );
  if (!existing) {
    await pool.query(
      'INSERT INTO `StudentScore` (`AssessmentID`, `StudentID`, `Score`, `Remarks`) VALUES (?, ?, ?, ?)',
      [assessmentId, studentId, score, remarks],
    );
  }
}

async function ensureAttendance(studentId, subjectId, date, status) {
  const existing = await one(
    'SELECT 1 FROM `Attendance` WHERE `StudentID` = ? AND `SubjectID` = ? AND `Date` = ?',
    [studentId, subjectId, date],
  );
  if (!existing) {
    await pool.query(
      'INSERT INTO `Attendance` (`StudentID`, `SubjectID`, `Date`, `Status`) VALUES (?, ?, ?, ?)',
      [studentId, subjectId, date, status],
    );
  }
}

function isoDate(daysAgo = 0) {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return date.toISOString().slice(0, 10);
}

async function main() {
  console.log('Seeding demo data...');

  const adminId = await ensureStaff(
    'Admin',
    'AdminID',
    'Alex Rivera',
    'admin@sunnycampus.test',
    'admin123',
  );
  const teacherId = await ensureStaff(
    'Teacher',
    'TeacherID',
    'Maria Santos',
    'teacher@sunnycampus.test',
    'teacher123',
  );
  const teacher2Id = await ensureStaff(
    'Teacher',
    'TeacherID',
    'James Lee',
    'james@sunnycampus.test',
    'teacher123',
  );

  const it = await ensureCourse('BS Information Technology');
  const cs = await ensureCourse('BS Computer Science');
  const ba = await ensureCourse('BS Business Administration');

  const math = await ensureSubject('Mathematics');
  const programming = await ensureSubject('Programming Fundamentals');
  const database = await ensureSubject('Database Systems');
  const communication = await ensureSubject('Communication Skills');
  const web = await ensureSubject('Web Development');

  await ensureCourseSubject(it, math);
  await ensureCourseSubject(it, programming);
  await ensureCourseSubject(it, database);
  await ensureCourseSubject(it, web);
  await ensureCourseSubject(cs, math);
  await ensureCourseSubject(cs, programming);
  await ensureCourseSubject(cs, database);
  await ensureCourseSubject(ba, math);
  await ensureCourseSubject(ba, communication);

  const it1a = await ensureSection(it, 'IT-1A');
  const cs2b = await ensureSection(cs, 'CS-2B');
  await ensureSection(ba, 'BA-1A');

  await ensureSectionSubject(it1a, math, teacherId);
  await ensureSectionSubject(it1a, programming, teacher2Id);
  await ensureSectionSubject(it1a, database, teacherId);
  await ensureSectionSubject(cs2b, programming, teacher2Id);
  await ensureSectionSubject(cs2b, database, teacherId);

  const juan = await ensureStudent(it1a, 'Juan Dela Cruz', 'juan.delacruz@student.test');
  const ana = await ensureStudent(it1a, 'Ana Reyes', 'ana.reyes@student.test');
  const miguel = await ensureStudent(cs2b, 'Miguel Torres', 'miguel.torres@student.test');
  const sofia = await ensureStudent(cs2b, 'Sofia Garcia', 'sofia.garcia@student.test');

  const dbQuiz = await ensureAssessment(database, 'Database Quiz 1', 50, 'Quiz');
  const dbExam = await ensureAssessment(database, 'Database Midterm Exam', 100, 'Exam');
  const progAssignment = await ensureAssessment(
    programming,
    'Programming Assignment 1',
    100,
    'Assignment',
  );

  await ensureScore(dbQuiz, juan, 45, 'Excellent work');
  await ensureScore(dbQuiz, ana, 38, 'Good');
  await ensureScore(dbExam, juan, 88, 'Strong performance');
  await ensureScore(progAssignment, miguel, 92, 'Outstanding');
  await ensureScore(progAssignment, sofia, 78, 'Keep improving');

  await ensureAttendance(juan, database, isoDate(0), 'Present');
  await ensureAttendance(ana, database, isoDate(0), 'Present');
  await ensureAttendance(miguel, programming, isoDate(0), 'Late');
  await ensureAttendance(sofia, programming, isoDate(0), 'Absent');
  await ensureAttendance(juan, database, isoDate(1), 'Present');
  await ensureAttendance(ana, database, isoDate(1), 'Excused');

  await writeLog({
    actor: { id: adminId, role: 'Admin', name: 'Alex Rivera' },
    reason: 'Demo data seeded for Sunny Campus',
    actionType: 'CREATE',
    affectedTable: 'Course',
    affectedRecordId: it,
  });
  await writeLog({
    actor: { id: teacherId, role: 'Teacher', name: 'Maria Santos' },
    reason: 'Maria Santos created Student "Juan Dela Cruz" during demo seeding',
    actionType: 'CREATE',
    affectedTable: 'Student',
    affectedRecordId: juan,
  });

  console.log('Demo data ready.');
  console.log('');
  console.log('  Admin   : admin@sunnycampus.test   / admin123');
  console.log('  Teacher : teacher@sunnycampus.test / teacher123');
  console.log('  Teacher : james@sunnycampus.test   / teacher123');
}

main()
  .catch((error) => {
    console.error('Seeding failed:', error.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
