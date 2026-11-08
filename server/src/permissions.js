const { pool } = require('./db');
const { httpError } = require('./utils/httpError');

/**
 * Teacher scoping helpers.
 *
 * A teacher "handles" a section through SectionSubject rows. Every read/write
 * of sections, students and grades is checked against those assignments.
 */

async function getTeacherSectionIds(teacherId) {
  const [rows] = await pool.query(
    `SELECT DISTINCT SectionID FROM SectionSubject WHERE TeacherID = ?
     UNION
     SELECT AffectedRecordID AS SectionID FROM Log
      WHERE AffectedTable = 'Section' AND ActionType = 'CREATE' AND TeacherID = ?`,
    [teacherId, teacherId],
  );
  return rows.map((row) => row.SectionID);
}

async function getTeacherSubjectIds(teacherId) {
  const [rows] = await pool.query(
    `SELECT DISTINCT SubjectID FROM SectionSubject WHERE TeacherID = ?
     UNION
     SELECT DISTINCT cs.SubjectID
     FROM CourseSubject cs
     JOIN Section sec ON sec.CourseID = cs.CourseID
     WHERE sec.SectionID IN (
       SELECT DISTINCT SectionID FROM SectionSubject WHERE TeacherID = ?
       UNION
       SELECT AffectedRecordID FROM Log WHERE AffectedTable = 'Section' AND ActionType = 'CREATE' AND TeacherID = ?
     )
     UNION
     SELECT AffectedRecordID AS SubjectID FROM Log
      WHERE AffectedTable = 'Subject' AND ActionType = 'CREATE' AND TeacherID = ?`,
    [teacherId, teacherId, teacherId, teacherId],
  );
  return rows.map((row) => row.SubjectID);
}

async function getStudent(studentId) {
  const [rows] = await pool.query(
    'SELECT StudentID, SectionID, Name, Email, Status FROM Student WHERE StudentID = ? LIMIT 1',
    [studentId],
  );
  return rows[0] || null;
}

async function getSection(sectionId) {
  const [rows] = await pool.query(
    `SELECT sec.SectionID, sec.CourseID, sec.SectionName, c.CourseName
     FROM Section sec
     JOIN Course c ON c.CourseID = sec.CourseID
     WHERE sec.SectionID = ? LIMIT 1`,
    [sectionId],
  );
  return rows[0] || null;
}

async function getAssessment(assessmentId) {
  const [rows] = await pool.query(
    `SELECT a.AssessmentID, a.SubjectID, a.Title, a.MaxScore, a.AssessmentType,
            s.SubjectName
     FROM Assessment a
     JOIN Subject s ON s.SubjectID = a.SubjectID
     WHERE a.AssessmentID = ? LIMIT 1`,
    [assessmentId],
  );
  return rows[0] || null;
}

async function getScore(scoreId) {
  const [rows] = await pool.query(
    `SELECT sc.ScoreID, sc.AssessmentID, sc.StudentID, sc.Score, sc.Remarks,
            a.SubjectID
     FROM StudentScore sc
     JOIN Assessment a ON a.AssessmentID = sc.AssessmentID
     WHERE sc.ScoreID = ? LIMIT 1`,
    [scoreId],
  );
  return rows[0] || null;
}

async function getAttendance(attendanceId) {
  const [rows] = await pool.query(
    `SELECT AttendanceID, StudentID, SubjectID, Date, Status
     FROM Attendance WHERE AttendanceID = ? LIMIT 1`,
    [attendanceId],
  );
  return rows[0] || null;
}

async function assertTeacherSection(teacherId, sectionId) {
  const [rows] = await pool.query(
    `SELECT 1 FROM SectionSubject WHERE TeacherID = ? AND SectionID = ?
     UNION
     SELECT 1 FROM Log WHERE AffectedTable = 'Section' AND ActionType = 'CREATE' AND TeacherID = ? AND AffectedRecordID = ?
     LIMIT 1`,
    [teacherId, sectionId, teacherId, sectionId],
  );
  if (rows.length === 0) {
    throw httpError(403, 'You can only manage sections assigned to you.');
  }
}

async function assertTeacherSubject(teacherId, subjectId) {
  const [rows] = await pool.query(
    `SELECT 1 FROM SectionSubject WHERE TeacherID = ? AND SubjectID = ?
     UNION
     SELECT 1
     FROM CourseSubject cs
     JOIN Section sec ON sec.CourseID = cs.CourseID
     WHERE cs.SubjectID = ? AND (
       sec.SectionID IN (SELECT DISTINCT SectionID FROM SectionSubject WHERE TeacherID = ?)
       OR sec.SectionID IN (SELECT AffectedRecordID FROM Log WHERE AffectedTable = 'Section' AND ActionType = 'CREATE' AND TeacherID = ?)
     )
     UNION
     SELECT 1 FROM Log WHERE AffectedTable = 'Subject' AND ActionType = 'CREATE' AND TeacherID = ? AND AffectedRecordID = ?
     LIMIT 1`,
    [teacherId, subjectId, subjectId, teacherId, teacherId, teacherId, subjectId],
  );
  if (rows.length === 0) {
    throw httpError(403, 'You can only manage grade items for subjects you teach.');
  }
}

async function assertTeacherStudent(teacherId, studentId) {
  const [rows] = await pool.query(
    `SELECT 1
     FROM Student st
     WHERE st.StudentID = ? AND (
       st.SectionID IN (SELECT DISTINCT SectionID FROM SectionSubject WHERE TeacherID = ?)
       OR st.SectionID IN (SELECT AffectedRecordID FROM Log WHERE AffectedTable = 'Section' AND ActionType = 'CREATE' AND TeacherID = ?)
     )
     LIMIT 1`,
    [studentId, teacherId, teacherId],
  );
  if (rows.length === 0) {
    throw httpError(403, 'You can only manage students in your own sections.');
  }
}

async function assertTeacherAssessment(teacherId, assessmentId) {
  const assessment = await getAssessment(assessmentId);
  if (!assessment) throw httpError(404, 'Grade item not found.');
  await assertTeacherSubject(teacherId, assessment.SubjectID);
}

async function assertTeacherScoreAccess(teacherId, assessmentId, studentId) {
  await assertTeacherAssessment(teacherId, assessmentId);
  await assertTeacherStudent(teacherId, studentId);
}

module.exports = {
  getTeacherSectionIds,
  getTeacherSubjectIds,
  getStudent,
  getSection,
  getAssessment,
  getScore,
  getAttendance,
  assertTeacherSection,
  assertTeacherSubject,
  assertTeacherStudent,
  assertTeacherAssessment,
  assertTeacherScoreAccess,
};
