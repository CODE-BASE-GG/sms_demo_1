const express = require('express');
const { pool } = require('../db');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

const ADMIN_STATS_SQL = `
  SELECT
    (SELECT COUNT(*) FROM \`Course\`) AS courses,
    (SELECT COUNT(*) FROM \`Subject\`) AS subjects,
    (SELECT COUNT(*) FROM \`CourseSubject\`) AS courseSubjects,
    (SELECT COUNT(*) FROM \`Teacher\`) AS teachers,
    (SELECT COUNT(*) FROM \`Admin\`) AS admins,
    (SELECT COUNT(*) FROM \`Section\`) AS sections,
    (SELECT COUNT(*) FROM \`SectionSubject\`) AS sectionSubjects,
    (SELECT COUNT(*) FROM \`Student\`) AS students,
    (SELECT COUNT(*) FROM \`Assessment\`) AS assessments,
    (SELECT COUNT(*) FROM \`StudentScore\`) AS scores,
    (SELECT COUNT(*) FROM \`Attendance\`) AS attendance,
    (SELECT COUNT(*) FROM \`Log\`) AS logs,
    (SELECT COUNT(*) FROM \`Log\` WHERE Status = 'Pending') AS pendingReviews
`;

const TEACHER_STATS_SQL = `
  SELECT
    (SELECT COUNT(DISTINCT sec.CourseID)
       FROM SectionSubject ss JOIN Section sec ON sec.SectionID = ss.SectionID
      WHERE ss.TeacherID = ?) AS courses,
    (SELECT COUNT(DISTINCT ss.SubjectID)
       FROM SectionSubject ss WHERE ss.TeacherID = ?) AS subjects,
    (SELECT COUNT(*)
       FROM CourseSubject cs
      WHERE cs.CourseID IN (
        SELECT DISTINCT sec.CourseID
        FROM SectionSubject ss JOIN Section sec ON sec.SectionID = ss.SectionID
        WHERE ss.TeacherID = ?
      )) AS courseSubjects,
    1 AS teachers,
    0 AS admins,
    (SELECT COUNT(DISTINCT ss.SectionID)
       FROM SectionSubject ss WHERE ss.TeacherID = ?) AS sections,
    (SELECT COUNT(*) FROM SectionSubject ss WHERE ss.TeacherID = ?) AS sectionSubjects,
    (SELECT COUNT(*)
       FROM Student st
      WHERE st.SectionID IN (
        SELECT DISTINCT SectionID FROM SectionSubject WHERE TeacherID = ?
      )) AS students,
    (SELECT COUNT(*)
       FROM Assessment a
      WHERE a.SubjectID IN (
        SELECT DISTINCT SubjectID FROM SectionSubject WHERE TeacherID = ?
      )) AS assessments,
    (SELECT COUNT(*)
       FROM StudentScore sc
       JOIN Assessment a ON a.AssessmentID = sc.AssessmentID
       JOIN Student st ON st.StudentID = sc.StudentID
      WHERE a.SubjectID IN (
              SELECT DISTINCT SubjectID FROM SectionSubject WHERE TeacherID = ?
            )
        AND st.SectionID IN (
              SELECT DISTINCT SectionID FROM SectionSubject WHERE TeacherID = ?
            )) AS scores,
    (SELECT COUNT(*)
       FROM Attendance at
       JOIN Student st ON st.StudentID = at.StudentID
      WHERE at.SubjectID IN (
              SELECT DISTINCT SubjectID FROM SectionSubject WHERE TeacherID = ?
            )
        AND st.SectionID IN (
              SELECT DISTINCT SectionID FROM SectionSubject WHERE TeacherID = ?
            )) AS attendance,
    (SELECT COUNT(*) FROM Log l WHERE l.TeacherID = ?) AS logs,
    (SELECT COUNT(*) FROM Log l WHERE l.TeacherID = ? AND l.Status = 'Pending') AS pendingReviews
`;

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const isTeacher = req.user.role === 'Teacher';
    const teacherId = req.user.id;

    const [[stats]] = isTeacher
      ? await pool.query(TEACHER_STATS_SQL, Array(13).fill(teacherId))
      : await pool.query(ADMIN_STATS_SQL);

    const recentLogsSql = `
      SELECT l.LogID, l.Reason, l.ActionType, l.AffectedTable, l.AffectedRecordID,
             l.Timestamp, l.Status,
             COALESCE(t.Name, a.Name, 'System') AS ActorName,
             CASE WHEN l.TeacherID IS NOT NULL THEN 'Teacher'
                  WHEN l.AdminID IS NOT NULL THEN 'Admin'
                  ELSE 'System' END AS ActorRole
      FROM Log l
      LEFT JOIN Teacher t ON t.TeacherID = l.TeacherID
      LEFT JOIN Admin a ON a.AdminID = l.AdminID
      ${isTeacher ? 'WHERE l.TeacherID = ?' : ''}
      ORDER BY l.LogID DESC
      LIMIT 8
    `;
    const [recentLogs] = await pool.query(recentLogsSql, isTeacher ? [teacherId] : []);

    const attendanceBreakdownSql = `
      SELECT at.Status, COUNT(*) AS Total
      FROM Attendance at
      ${isTeacher ? 'JOIN Student st ON st.StudentID = at.StudentID' : ''}
      ${
        isTeacher
          ? `WHERE at.SubjectID IN (
               SELECT DISTINCT SubjectID FROM SectionSubject WHERE TeacherID = ?
             )
             AND st.SectionID IN (
               SELECT DISTINCT SectionID FROM SectionSubject WHERE TeacherID = ?
             )`
          : ''
      }
      GROUP BY at.Status
      ORDER BY Total DESC
    `;
    const [attendanceBreakdown] = await pool.query(
      attendanceBreakdownSql,
      isTeacher ? [teacherId, teacherId] : [],
    );

    const studentsByCourseSql = isTeacher
      ? `SELECT c.CourseName, COUNT(DISTINCT st.StudentID) AS Total
         FROM Course c
         JOIN Section sec ON sec.CourseID = c.CourseID
         JOIN Student st ON st.SectionID = sec.SectionID
         WHERE sec.SectionID IN (
           SELECT DISTINCT SectionID FROM SectionSubject WHERE TeacherID = ?
         )
         GROUP BY c.CourseID, c.CourseName
         ORDER BY Total DESC, c.CourseName ASC`
      : `SELECT c.CourseName, COUNT(st.StudentID) AS Total
         FROM Course c
         LEFT JOIN Section sec ON sec.CourseID = c.CourseID
         LEFT JOIN Student st ON st.SectionID = sec.SectionID
         GROUP BY c.CourseID, c.CourseName
         ORDER BY Total DESC, c.CourseName ASC`;
    const [studentsByCourse] = await pool.query(
      studentsByCourseSql,
      isTeacher ? [teacherId] : [],
    );

    res.json({
      stats,
      recentLogs,
      attendanceBreakdown,
      studentsByCourse,
    });
  }),
);

module.exports = router;
