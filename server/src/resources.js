/**
 * Declarative description of every table in the database.
 *
 * Each resource lists:
 *  - table / pk / keyFields : how rows are identified
 *  - list                    : SQL used by GET (includes helpful joins)
 *  - listForTeacher          : teacher-scoped GET SQL (optional)
 *  - fields                  : allowed writable columns + validation
 *  - readRoles / writeRoles  : simple role gates
 *  - hooks                   : scoping, extra validation and cascades
 *
 * The generic CRUD router uses these definitions, so identifiers always come
 * from this file and never directly from the request.
 */
const { pool } = require('./db');
const { httpError } = require('./utils/httpError');
const {
  getTeacherSectionIds,
  getStudent,
  getAssessment,
  getScore,
  getAttendance,
  assertTeacherSection,
  assertTeacherSubject,
  assertTeacherStudent,
  assertTeacherAssessment,
  assertTeacherScoreAccess,
} = require('./permissions');

function isTeacher(req) {
  return req.user.role === 'Teacher';
}

async function assertScoreWithinTotal(assessmentId, score) {
  const assessment = await getAssessment(assessmentId);
  if (!assessment) throw httpError(400, 'Choose a valid grade item.');
  if (Number(score) > Number(assessment.MaxScore)) {
    throw httpError(
      400,
      `The grade cannot exceed the grade item total (${assessment.MaxScore}).`,
    );
  }
}

async function cascadeDeleteStudent(studentId) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await connection.query('DELETE FROM `Attendance` WHERE `StudentID` = ?', [studentId]);
    await connection.query('DELETE FROM `StudentScore` WHERE `StudentID` = ?', [studentId]);
    await connection.query('DELETE FROM `Student` WHERE `StudentID` = ?', [studentId]);
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function cascadeDeleteSection(sectionId) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [students] = await connection.query(
      'SELECT `StudentID` FROM `Student` WHERE `SectionID` = ?',
      [sectionId],
    );
    const studentIds = students.map((row) => row.StudentID);

    if (studentIds.length > 0) {
      await connection.query('DELETE FROM `Attendance` WHERE `StudentID` IN (?)', [studentIds]);
      await connection.query('DELETE FROM `StudentScore` WHERE `StudentID` IN (?)', [studentIds]);
      await connection.query('DELETE FROM `Student` WHERE `StudentID` IN (?)', [studentIds]);
    }

    await connection.query('DELETE FROM `SectionSubject` WHERE `SectionID` = ?', [sectionId]);
    await connection.query('DELETE FROM `Section` WHERE `SectionID` = ?', [sectionId]);
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function cascadeDeleteAssessment(assessmentId) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await connection.query('DELETE FROM `StudentScore` WHERE `AssessmentID` = ?', [assessmentId]);
    await connection.query('DELETE FROM `Assessment` WHERE `AssessmentID` = ?', [assessmentId]);
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

const resources = {
  courses: {
    table: 'Course',
    label: 'Course',
    pk: 'CourseID',
    list: 'SELECT * FROM `Course` ORDER BY `CourseID` DESC',
    fields: {
      CourseName: { type: 'string', required: true, maxLength: 100 },
    },
    writeRoles: ['Admin'],
  },

  subjects: {
    table: 'Subject',
    label: 'Subject',
    pk: 'SubjectID',
    list: 'SELECT * FROM `Subject` ORDER BY `SubjectID` DESC',
    listForTeacher: 'SELECT * FROM `Subject` ORDER BY `SubjectName` ASC',
    fields: {
      SubjectName: { type: 'string', required: true, maxLength: 100 },
    },
    writeRoles: ['Teacher', 'Admin'],
    afterCreate: async ({ req, values, id }) => {
      if (!isTeacher(req)) return;
      const sectionIds = await getTeacherSectionIds(req.user.id);
      for (const sectionId of sectionIds) {
        await pool.query(
          `INSERT IGNORE INTO \`SectionSubject\` (\`SectionID\`, \`SubjectID\`, \`TeacherID\`)
           VALUES (?, ?, ?)`,
          [sectionId, id, req.user.id],
        );
      }
    },
  },

  'course-subjects': {
    table: 'CourseSubject',
    label: 'Course subject link',
    pk: null,
    keyFields: ['CourseID', 'SubjectID'],
    list: `SELECT cs.CourseID, cs.SubjectID, c.CourseName, s.SubjectName
           FROM CourseSubject cs
           JOIN Course c ON c.CourseID = cs.CourseID
           JOIN Subject s ON s.SubjectID = cs.SubjectID
           ORDER BY c.CourseName ASC, s.SubjectName ASC`,
    fields: {
      CourseID: { type: 'number', required: true },
      SubjectID: { type: 'number', required: true },
    },
    updatable: false,
    writeRoles: ['Admin'],
  },

  teachers: {
    table: 'Teacher',
    label: 'Teacher',
    pk: 'TeacherID',
    passwordField: 'Password',
    list: 'SELECT `TeacherID`, `Name`, `Email` FROM `Teacher` ORDER BY `TeacherID` DESC',
    fields: {
      Name: { type: 'string', required: true, maxLength: 100 },
      Email: { type: 'email', required: true, maxLength: 100 },
      Password: { type: 'password', required: true },
    },
    readRoles: ['Admin'],
    writeRoles: ['Admin'],
  },

  admins: {
    table: 'Admin',
    label: 'Admin',
    pk: 'AdminID',
    passwordField: 'Password',
    list: 'SELECT `AdminID`, `Name`, `Email` FROM `Admin` ORDER BY `AdminID` DESC',
    fields: {
      Name: { type: 'string', required: true, maxLength: 100 },
      Email: { type: 'email', required: true, maxLength: 100 },
      Password: { type: 'password', required: true },
    },
    readRoles: ['Admin'],
    writeRoles: ['Admin'],
  },

  sections: {
    table: 'Section',
    label: 'Section',
    pk: 'SectionID',
    list: `SELECT sec.SectionID, sec.CourseID, sec.SectionName,
                  c.CourseName
           FROM Section sec
           JOIN Course c ON c.CourseID = sec.CourseID
           ORDER BY c.CourseName ASC, sec.SectionName ASC`,
    listForTeacher: `SELECT sec.SectionID, sec.CourseID, sec.SectionName,
                            c.CourseName
                     FROM Section sec
                     JOIN Course c ON c.CourseID = sec.CourseID
                     WHERE EXISTS (
                       SELECT 1 FROM SectionSubject ss
                       WHERE ss.SectionID = sec.SectionID AND ss.TeacherID = ?
                     )
                     OR EXISTS (
                       SELECT 1 FROM Log l
                       WHERE l.AffectedTable = 'Section' AND l.ActionType = 'CREATE' AND l.TeacherID = ? AND l.AffectedRecordID = sec.SectionID
                     )
                     ORDER BY c.CourseName ASC, sec.SectionName ASC`,
    teacherParams: 2,
    fields: {
      CourseID: { type: 'number', required: true },
      SectionName: { type: 'string', required: true, maxLength: 50 },
    },
    writeRoles: ['Teacher', 'Admin'],
    requiresReasonOnDelete: true,
    deleteReasonMessage: 'A reason is required when deleting a section.',
    deleteWarning:
      'Students, their grades and their attendance records in this section will also be removed.',
    beforeUpdate: async ({ req, existing }) => {
      if (isTeacher(req)) await assertTeacherSection(req.user.id, existing.SectionID);
    },
    beforeDelete: async ({ req, existing }) => {
      if (isTeacher(req)) await assertTeacherSection(req.user.id, existing.SectionID);
    },
    afterCreate: async ({ req, values, id }) => {
      // A teacher who creates a section handles every subject currently linked
      // to that course. Administrators can adjust SectionSubject assignments.
      if (!isTeacher(req)) return;
      await pool.query(
        `INSERT IGNORE INTO \`SectionSubject\` (\`SectionID\`, \`SubjectID\`, \`TeacherID\`)
         SELECT ?, cs.SubjectID, ?
         FROM \`CourseSubject\` cs
         WHERE cs.CourseID = ?`,
        [id, req.user.id, values.CourseID],
      );
    },
    deleteHandler: async ({ existing }) => cascadeDeleteSection(existing.SectionID),
  },

  'section-subjects': {
    table: 'SectionSubject',
    label: 'Section subject assignment',
    pk: 'SectionSubjectID',
    list: `SELECT ss.SectionSubjectID, ss.SectionID, ss.SubjectID, ss.TeacherID,
                  sec.SectionName, sec.CourseID, c.CourseName,
                  sub.SubjectName, t.Name AS TeacherName
           FROM SectionSubject ss
           JOIN Section sec ON sec.SectionID = ss.SectionID
           JOIN Course c ON c.CourseID = sec.CourseID
           JOIN Subject sub ON sub.SubjectID = ss.SubjectID
           JOIN Teacher t ON t.TeacherID = ss.TeacherID
           ORDER BY c.CourseName ASC, sec.SectionName ASC, sub.SubjectName ASC`,
    listForTeacher: `SELECT ss.SectionSubjectID, ss.SectionID, ss.SubjectID, ss.TeacherID,
                            sec.SectionName, sec.CourseID, c.CourseName,
                            sub.SubjectName, t.Name AS TeacherName
                     FROM SectionSubject ss
                     JOIN Section sec ON sec.SectionID = ss.SectionID
                     JOIN Course c ON c.CourseID = sec.CourseID
                     JOIN Subject sub ON sub.SubjectID = ss.SubjectID
                     JOIN Teacher t ON t.TeacherID = ss.TeacherID
                     WHERE ss.TeacherID = ?
                     ORDER BY c.CourseName ASC, sec.SectionName ASC, sub.SubjectName ASC`,
    fields: {
      SectionID: { type: 'number', required: true },
      SubjectID: { type: 'number', required: true },
      TeacherID: { type: 'number', required: true },
    },
    writeRoles: ['Admin'],
  },

  students: {
    table: 'Student',
    label: 'Student',
    pk: 'StudentID',
    list: `SELECT st.StudentID, st.SectionID, st.Name, st.Email, st.Status,
                  sec.SectionName, sec.CourseID, c.CourseName
           FROM Student st
           JOIN Section sec ON sec.SectionID = st.SectionID
           JOIN Course c ON c.CourseID = sec.CourseID
           ORDER BY st.StudentID DESC`,
    listForTeacher: `SELECT st.StudentID, st.SectionID, st.Name, st.Email, st.Status,
                            sec.SectionName, sec.CourseID, c.CourseName
                     FROM Student st
                     JOIN Section sec ON sec.SectionID = st.SectionID
                     JOIN Course c ON c.CourseID = sec.CourseID
                     WHERE st.SectionID IN (
                       SELECT DISTINCT SectionID FROM SectionSubject WHERE TeacherID = ?
                       UNION
                       SELECT AffectedRecordID FROM Log WHERE AffectedTable = 'Section' AND ActionType = 'CREATE' AND TeacherID = ?
                     )
                     ORDER BY st.StudentID DESC`,
    teacherParams: 2,
    fields: {
      SectionID: { type: 'number', required: true },
      Name: { type: 'string', required: true, maxLength: 100 },
      Email: { type: 'email', required: false, maxLength: 100, emptyAsNull: true },
      Status: {
        type: 'enum',
        values: ['Active', 'Inactive', 'Graduated', 'Suspended'],
        default: 'Active',
      },
    },
    writeRoles: ['Teacher', 'Admin'],
    requiresReasonOnDelete: true,
    deleteReasonMessage: 'A reason is required when deleting a student.',
    deleteWarning:
      "This student's grades and attendance records will also be removed.",
    beforeCreate: async ({ req, values }) => {
      if (isTeacher(req)) await assertTeacherSection(req.user.id, values.SectionID);
    },
    beforeUpdate: async ({ req, existing, values }) => {
      if (!isTeacher(req)) return;
      await assertTeacherStudent(req.user.id, existing.StudentID);
      const nextSectionId = values.SectionID ?? existing.SectionID;
      await assertTeacherSection(req.user.id, nextSectionId);
    },
    beforeDelete: async ({ req, existing }) => {
      if (isTeacher(req)) await assertTeacherStudent(req.user.id, existing.StudentID);
    },
    deleteHandler: async ({ existing }) => cascadeDeleteStudent(existing.StudentID),
  },

  assessments: {
    table: 'Assessment',
    label: 'Grade item',
    pk: 'AssessmentID',
    list: `SELECT a.AssessmentID, a.SubjectID, a.Title, a.MaxScore, a.AssessmentType,
                  s.SubjectName
           FROM Assessment a
           JOIN Subject s ON s.SubjectID = a.SubjectID
           ORDER BY a.AssessmentID DESC`,
    listForTeacher: `SELECT a.AssessmentID, a.SubjectID, a.Title, a.MaxScore, a.AssessmentType,
                            s.SubjectName
                     FROM Assessment a
                     JOIN Subject s ON s.SubjectID = a.SubjectID
                     WHERE a.SubjectID IN (
                       SELECT DISTINCT SubjectID FROM SectionSubject WHERE TeacherID = ?
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
                       SELECT AffectedRecordID FROM Log WHERE AffectedTable = 'Subject' AND ActionType = 'CREATE' AND TeacherID = ?
                     )
                     ORDER BY a.AssessmentID DESC`,
    teacherParams: 4,
    fields: {
      SubjectID: { type: 'number', required: true },
      Title: { type: 'string', required: true, maxLength: 100 },
      MaxScore: { type: 'number', required: true, min: 0, max: 999.99, decimal: true },
      AssessmentType: {
        type: 'enum',
        required: true,
        values: ['Quiz', 'Exam', 'Assignment', 'Project', 'Activity'],
      },
    },
    writeRoles: ['Teacher', 'Admin'],
    requiresReasonOnUpdate: true,
    requiresReasonOnDelete: true,
    updateReasonMessage: 'A reason is required when editing a grade item.',
    deleteReasonMessage: 'A reason is required when deleting a grade item.',
    deleteWarning: 'All student grades recorded for this grade item will also be removed.',
    beforeCreate: async ({ req, values }) => {
      if (isTeacher(req)) await assertTeacherSubject(req.user.id, values.SubjectID);
    },
    afterCreate: async ({ req, values, id }) => {
      if (!isTeacher(req)) return;
      const sectionIds = await getTeacherSectionIds(req.user.id);
      for (const sectionId of sectionIds) {
        await pool.query(
          `INSERT IGNORE INTO \`SectionSubject\` (\`SectionID\`, \`SubjectID\`, \`TeacherID\`)
           VALUES (?, ?, ?)`,
          [sectionId, values.SubjectID, req.user.id],
        );
      }
    },
    beforeUpdate: async ({ req, existing, values }) => {
      if (!isTeacher(req)) return;
      await assertTeacherAssessment(req.user.id, existing.AssessmentID);
      const nextSubjectId = values.SubjectID ?? existing.SubjectID;
      await assertTeacherSubject(req.user.id, nextSubjectId);
    },
    beforeDelete: async ({ req, existing }) => {
      if (isTeacher(req)) await assertTeacherAssessment(req.user.id, existing.AssessmentID);
    },
    deleteHandler: async ({ existing }) => cascadeDeleteAssessment(existing.AssessmentID),
  },

  scores: {
    table: 'StudentScore',
    label: 'Student grade',
    pk: 'ScoreID',
    list: `SELECT sc.ScoreID, sc.AssessmentID, sc.StudentID, sc.Score, sc.Remarks,
                  a.Title AS AssessmentTitle, a.MaxScore, a.SubjectID,
                  sub.SubjectName, st.Name AS StudentName,
                  (SELECT COUNT(*) FROM Attendance at
                   WHERE at.StudentID = sc.StudentID
                     AND at.SubjectID = a.SubjectID
                     AND at.Status = 'Absent') AS Absences
           FROM StudentScore sc
           JOIN Assessment a ON a.AssessmentID = sc.AssessmentID
           JOIN Subject sub ON sub.SubjectID = a.SubjectID
           JOIN Student st ON st.StudentID = sc.StudentID
           ORDER BY sc.ScoreID DESC`,
    listForTeacher: `SELECT sc.ScoreID, sc.AssessmentID, sc.StudentID, sc.Score, sc.Remarks,
                            a.Title AS AssessmentTitle, a.MaxScore, a.SubjectID,
                            sub.SubjectName, st.Name AS StudentName,
                            (SELECT COUNT(*) FROM Attendance at
                             WHERE at.StudentID = sc.StudentID
                               AND at.SubjectID = a.SubjectID
                               AND at.Status = 'Absent') AS Absences
                     FROM StudentScore sc
                     JOIN Assessment a ON a.AssessmentID = sc.AssessmentID
                     JOIN Subject sub ON sub.SubjectID = a.SubjectID
                     JOIN Student st ON st.StudentID = sc.StudentID
                     WHERE st.SectionID IN (
                       SELECT DISTINCT SectionID FROM SectionSubject WHERE TeacherID = ?
                       UNION
                       SELECT AffectedRecordID FROM Log WHERE AffectedTable = 'Section' AND ActionType = 'CREATE' AND TeacherID = ?
                     )
                     ORDER BY sc.ScoreID DESC`,
    teacherParams: 2,
    fields: {
      AssessmentID: { type: 'number', required: true },
      StudentID: { type: 'number', required: true },
      Score: { type: 'number', required: true, min: 0, max: 999.99, decimal: true },
      Remarks: { type: 'string', required: false, maxLength: 255, emptyAsNull: true },
    },
    writeRoles: ['Teacher', 'Admin'],
    requiresReasonOnUpdate: true,
    requiresReasonOnDelete: true,
    updateReasonMessage: 'A reason is required when editing a student grade.',
    deleteReasonMessage: 'A reason is required when deleting a student grade.',
    beforeCreate: async ({ req, values }) => {
      await assertScoreWithinTotal(values.AssessmentID, values.Score);
      if (isTeacher(req)) {
        await assertTeacherScoreAccess(req.user.id, values.AssessmentID, values.StudentID);
      }
    },
    beforeUpdate: async ({ req, existing, values }) => {
      const nextAssessmentId = values.AssessmentID ?? existing.AssessmentID;
      const nextStudentId = values.StudentID ?? existing.StudentID;
      const nextScore = values.Score ?? existing.Score;
      await assertScoreWithinTotal(nextAssessmentId, nextScore);
      if (!isTeacher(req)) return;
      await assertTeacherScoreAccess(req.user.id, existing.AssessmentID, existing.StudentID);
      await assertTeacherScoreAccess(req.user.id, nextAssessmentId, nextStudentId);
    },
    beforeDelete: async ({ req, existing }) => {
      if (isTeacher(req)) {
        await assertTeacherScoreAccess(req.user.id, existing.AssessmentID, existing.StudentID);
      }
    },
  },

  attendance: {
    table: 'Attendance',
    label: 'Attendance record',
    pk: 'AttendanceID',
    list: `SELECT at.AttendanceID, at.StudentID, at.SubjectID, at.Date, at.Status,
                  st.Name AS StudentName, sub.SubjectName
           FROM Attendance at
           JOIN Student st ON st.StudentID = at.StudentID
           JOIN Subject sub ON sub.SubjectID = at.SubjectID
           ORDER BY at.Date DESC, at.AttendanceID DESC`,
    listForTeacher: `SELECT at.AttendanceID, at.StudentID, at.SubjectID, at.Date, at.Status,
                            st.Name AS StudentName, sub.SubjectName
                     FROM Attendance at
                     JOIN Student st ON st.StudentID = at.StudentID
                     JOIN Subject sub ON sub.SubjectID = at.SubjectID
                     WHERE st.SectionID IN (
                       SELECT DISTINCT SectionID FROM SectionSubject WHERE TeacherID = ?
                       UNION
                       SELECT AffectedRecordID FROM Log WHERE AffectedTable = 'Section' AND ActionType = 'CREATE' AND TeacherID = ?
                     )
                     ORDER BY at.Date DESC, at.AttendanceID DESC`,
    teacherParams: 2,
    fields: {
      StudentID: { type: 'number', required: true },
      SubjectID: { type: 'number', required: true },
      Date: { type: 'date', required: true },
      Status: {
        type: 'enum',
        required: true,
        values: ['Present', 'Absent', 'Late', 'Excused'],
      },
    },
    writeRoles: ['Teacher', 'Admin'],
    beforeCreate: async ({ req, values }) => {
      if (isTeacher(req)) {
        await assertTeacherSubject(req.user.id, values.SubjectID);
        await assertTeacherStudent(req.user.id, values.StudentID);
      }
    },
    beforeUpdate: async ({ req, existing, values }) => {
      if (!isTeacher(req)) return;
      const nextSubjectId = values.SubjectID ?? existing.SubjectID;
      const nextStudentId = values.StudentID ?? existing.StudentID;
      await assertTeacherSubject(req.user.id, existing.SubjectID);
      await assertTeacherStudent(req.user.id, existing.StudentID);
      await assertTeacherSubject(req.user.id, nextSubjectId);
      await assertTeacherStudent(req.user.id, nextStudentId);
    },
    beforeDelete: async ({ req, existing }) => {
      if (!isTeacher(req)) return;
      await assertTeacherSubject(req.user.id, existing.SubjectID);
      await assertTeacherStudent(req.user.id, existing.StudentID);
    },
    loadExisting: async (id) => getAttendance(id),
  },

  logs: {
    table: 'Log',
    label: 'Audit log',
    pk: 'LogID',
    readRoles: ['Admin'],
    list: `SELECT l.LogID, l.TeacherID, l.AdminID, l.Reason, l.ActionType,
                  l.AffectedTable, l.AffectedRecordID, l.Timestamp, l.Status,
                  COALESCE(t.Name, a.Name, 'System') AS ActorName,
                  COALESCE(t.Email, a.Email) AS ActorEmail,
                  CASE WHEN l.TeacherID IS NOT NULL THEN 'Teacher'
                       WHEN l.AdminID IS NOT NULL THEN 'Admin'
                       ELSE 'System' END AS ActorRole
           FROM Log l
           LEFT JOIN Teacher t ON t.TeacherID = l.TeacherID
           LEFT JOIN Admin a ON a.AdminID = l.AdminID
           ORDER BY l.LogID DESC`,
    fields: {},
    creatable: false,
    updatable: false,
    deletable: false,
    writeRoles: ['Admin'],
  },
};

// Attach a few helpers that need the database (kept next to their resource).
resources.sections.loadExisting = async (id) => {
  const [rows] = await pool.query(
    `SELECT sec.SectionID, sec.CourseID, sec.SectionName, c.CourseName
     FROM Section sec JOIN Course c ON c.CourseID = sec.CourseID
     WHERE sec.SectionID = ? LIMIT 1`,
    [id],
  );
  return rows[0] || null;
};
resources.students.loadExisting = async (id) => getStudent(id);
resources.assessments.loadExisting = async (id) => getAssessment(id);
resources.scores.loadExisting = async (id) => getScore(id);
resources.teachers.loadExisting = async (id) => {
  const [rows] = await pool.query('SELECT * FROM `Teacher` WHERE `TeacherID` = ? LIMIT 1', [id]);
  return rows[0] || null;
};
resources.admins.loadExisting = async (id) => {
  const [rows] = await pool.query('SELECT * FROM `Admin` WHERE `AdminID` = ? LIMIT 1', [id]);
  return rows[0] || null;
};

module.exports = resources;
