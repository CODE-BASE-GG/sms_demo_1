const { pool } = require('../db');

const LOG_STATUSES = ['Pending', 'Approved', 'Rejected'];

/**
 * Writes an entry into the `Log` table.
 *
 * The Log table requires exactly one actor (Teacher or Admin) and a description
 * of the change. We never let audit failures break the actual request.
 *
 * Teacher actions that require a reason start as `Pending` so an administrator
 * can review them. Everything else starts as `Approved` (an admin performing
 * the action is already authorised to do so).
 */
async function writeLog({
  actor,
  reason,
  actionType,
  affectedTable,
  affectedRecordId,
  status = 'Approved',
}) {
  try {
    const teacherId = actor?.role === 'Teacher' ? actor.id : null;
    const adminId = actor?.role === 'Admin' ? actor.id : null;
    const safeStatus = LOG_STATUSES.includes(status) ? status : 'Approved';

    await pool.query(
      `INSERT INTO \`Log\`
        (\`TeacherID\`, \`AdminID\`, \`Reason\`, \`ActionType\`, \`AffectedTable\`, \`AffectedRecordID\`, \`Status\`)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        teacherId,
        adminId,
        String(reason).slice(0, 255),
        actionType,
        affectedTable,
        Number(affectedRecordId) || 0,
        safeStatus,
      ],
    );
  } catch (error) {
    console.error('[audit] Could not write log entry:', error.message);
  }
}

module.exports = { writeLog, LOG_STATUSES };
