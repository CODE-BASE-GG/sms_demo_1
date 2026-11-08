const bcrypt = require('bcryptjs');
const express = require('express');
const { pool } = require('../db');
const resources = require('../resources');
const asyncHandler = require('../utils/asyncHandler');
const { writeLog } = require('../utils/audit');
const { httpError } = require('../utils/httpError');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Validates and normalizes request data using the resource's field rules.
 * Only whitelisted columns survive this function.
 */
async function prepareValues(body, cfg, { isUpdate }) {
  const values = {};

  for (const [field, rules] of Object.entries(cfg.fields)) {
    const present = Object.prototype.hasOwnProperty.call(body, field);

    if (!present || body[field] === undefined) {
      if (!isUpdate && rules.required) {
        throw httpError(400, `${field} is required.`);
      }
      continue;
    }

    let value = body[field];
    if (typeof value === 'string') value = value.trim();
    const isEmpty = value === '' || value === null;

    if (isEmpty) {
      if (rules.type === 'password') {
        if (isUpdate) continue;
        throw httpError(400, 'Password is required.');
      }
      if (rules.required) {
        throw httpError(400, `${field} is required.`);
      }
      if (rules.emptyAsNull) {
        values[field] = null;
      }
      // Optional enum/status fields left blank fall back to the DB default.
      continue;
    }

    if (rules.type === 'email') {
      value = String(value).toLowerCase();
      if (!EMAIL_RE.test(value)) {
        throw httpError(400, 'Enter a valid email address.');
      }
    }

    if (rules.maxLength && String(value).length > rules.maxLength) {
      throw httpError(400, `${field} must be ${rules.maxLength} characters or fewer.`);
    }

    if (rules.type === 'password') {
      if (String(value).length < 6) {
        throw httpError(400, 'Password must be at least 6 characters.');
      }
      if (String(value).length > 72) {
        throw httpError(400, 'Password must be 72 characters or fewer.');
      }
      values[field] = await bcrypt.hash(String(value), 10);
      continue;
    }

    if (rules.type === 'number') {
      const number = Number(value);
      if (!Number.isFinite(number)) {
        throw httpError(400, `${field} must be a number.`);
      }
      if (!rules.decimal && !Number.isInteger(number)) {
        throw httpError(400, `${field} must be a whole number.`);
      }
      if (rules.min !== undefined && number < rules.min) {
        throw httpError(400, `${field} must be at least ${rules.min}.`);
      }
      if (rules.max !== undefined && number > rules.max) {
        throw httpError(400, `${field} must be at most ${rules.max}.`);
      }
      values[field] = number;
      continue;
    }

    if (rules.type === 'date') {
      if (!DATE_RE.test(String(value)) || Number.isNaN(Date.parse(value))) {
        throw httpError(400, `${field} must be a valid date (YYYY-MM-DD).`);
      }
      values[field] = String(value);
      continue;
    }

    if (rules.type === 'enum') {
      if (rules.values && !rules.values.includes(String(value))) {
        throw httpError(400, `${field} must be one of: ${rules.values.join(', ')}.`);
      }
      values[field] = String(value);
      continue;
    }

    values[field] = String(value);
  }

  return values;
}

function actionReason(actorName, actionType, cfg, values = {}, id, existing = null) {
  const verb =
    actionType === 'CREATE' ? 'created' : actionType === 'UPDATE' ? 'updated' : 'deleted';
  const descriptor =
    values.Name ||
    values.Title ||
    values.CourseName ||
    values.SubjectName ||
    values.SectionName ||
    existing?.Name ||
    existing?.Title ||
    existing?.CourseName ||
    existing?.SubjectName ||
    existing?.SectionName ||
    existing?.AssessmentTitle;
  const target = descriptor ? `${cfg.label} "${descriptor}"` : cfg.label;
  const suffix = id ? ` (#${id})` : '';
  return `${actorName} ${verb} ${target}${suffix}`;
}

function requireReason(req, message) {
  const reason = String(req.body?.reason || '').trim();
  if (!reason) throw httpError(400, message || 'A reason is required for this action.');
  if (reason.length > 255) {
    throw httpError(400, 'The reason must be 255 characters or fewer.');
  }
  return reason;
}

function assertReadAccess(req, cfg) {
  if (cfg.readRoles && !cfg.readRoles.includes(req.user.role)) {
    throw httpError(403, `You do not have access to ${cfg.label.toLowerCase()} records.`);
  }
}

function assertWriteAccess(req, cfg) {
  if (cfg.writeRoles && !cfg.writeRoles.includes(req.user.role)) {
    throw httpError(403, `You do not have permission to change ${cfg.label.toLowerCase()} records.`);
  }
}

async function loadExisting(cfg, id) {
  if (cfg.loadExisting) return cfg.loadExisting(id);
  const [rows] = await pool.query(
    `SELECT * FROM \`${cfg.table}\` WHERE \`${cfg.pk}\` = ? LIMIT 1`,
    [id],
  );
  return rows[0] || null;
}

async function loadExistingComposite(cfg, keyOne, keyTwo) {
  const [rows] = await pool.query(
    `SELECT * FROM \`${cfg.table}\` WHERE \`${cfg.keyFields[0]}\` = ? AND \`${cfg.keyFields[1]}\` = ? LIMIT 1`,
    [keyOne, keyTwo],
  );
  return rows[0] || null;
}

async function recordLog({ req, cfg, actionType, recordId, values, existing, userReason }) {
  const sensitive =
    actionType === 'UPDATE'
      ? Boolean(cfg.requiresReasonOnUpdate)
      : actionType === 'DELETE'
        ? Boolean(cfg.requiresReasonOnDelete)
        : false;

  const reason =
    userReason ||
    actionReason(req.user.name, actionType, cfg, values || {}, recordId, existing);

  const status = req.user.role === 'Admin' ? 'Approved' : sensitive ? 'Pending' : 'Approved';

  await writeLog({
    actor: req.user,
    reason,
    actionType,
    affectedTable: cfg.table,
    affectedRecordId: recordId,
    status,
  });
}

function createResourceRouter(cfg) {
  const router = express.Router();

  router.get(
    '/',
    asyncHandler(async (req, res) => {
      assertReadAccess(req, cfg);

      const useTeacherScope = req.user.role === 'Teacher' && cfg.listForTeacher;
      const sql = useTeacherScope ? cfg.listForTeacher : cfg.list;
      const params = useTeacherScope
        ? Array(cfg.teacherParams || 1).fill(req.user.id)
        : [];
      const [rows] = await pool.query(sql, params);
      res.json(rows);
    }),
  );

  if (cfg.creatable !== false) {
    router.post(
      '/',
      asyncHandler(async (req, res) => {
        assertWriteAccess(req, cfg);

        const values = await prepareValues(req.body, cfg, { isUpdate: false });
        const columns = Object.keys(values);

        if (columns.length === 0) {
          throw httpError(400, 'No values were supplied.');
        }

        if (cfg.beforeCreate) {
          await cfg.beforeCreate({ req, values });
        }

        const sql = `INSERT INTO \`${cfg.table}\` (${columns
          .map((column) => `\`${column}\``)
          .join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`;
        const [result] = await pool.query(sql, columns.map((column) => values[column]));

        const recordId = cfg.pk ? result.insertId : Number(values[cfg.keyFields?.[0]]) || 0;

        if (cfg.afterCreate) {
          await cfg.afterCreate({ req, values, id: recordId });
        }

        const safeValues = { ...values };
        if (cfg.passwordField) delete safeValues[cfg.passwordField];

        await recordLog({
          req,
          cfg,
          actionType: 'CREATE',
          recordId,
          values: safeValues,
        });

        res.status(201).json({ id: recordId, message: `${cfg.label} created.` });
      }),
    );
  }

  if (cfg.updatable !== false && cfg.pk) {
    router.put(
      '/:id',
      asyncHandler(async (req, res) => {
        assertWriteAccess(req, cfg);

        const id = Number(req.params.id);
        if (!Number.isInteger(id)) {
          throw httpError(400, 'Invalid record id.');
        }

        const userReason = cfg.requiresReasonOnUpdate
          ? requireReason(req, cfg.updateReasonMessage)
          : null;

        const existing = await loadExisting(cfg, id);
        if (!existing) throw httpError(404, `${cfg.label} not found.`);

        const values = await prepareValues(req.body, cfg, { isUpdate: true });
        const columns = Object.keys(values);

        if (columns.length === 0) {
          throw httpError(400, 'No changes were supplied.');
        }

        if (cfg.beforeUpdate) {
          await cfg.beforeUpdate({ req, existing, values });
        }

        const sql = `UPDATE \`${cfg.table}\` SET ${columns
          .map((column) => `\`${column}\` = ?`)
          .join(', ')} WHERE \`${cfg.pk}\` = ?`;
        await pool.query(sql, [...columns.map((column) => values[column]), id]);

        const safeValues = { ...values };
        if (cfg.passwordField) delete safeValues[cfg.passwordField];

        await recordLog({
          req,
          cfg,
          actionType: 'UPDATE',
          recordId: id,
          values: safeValues,
          existing,
          userReason,
        });

        res.json({ message: `${cfg.label} updated.` });
      }),
    );
  }

  if (cfg.deletable !== false) {
    const deletePath = cfg.pk ? '/:id' : '/:keyOne/:keyTwo';

    router.delete(
      deletePath,
      asyncHandler(async (req, res) => {
        assertWriteAccess(req, cfg);

        const userReason = cfg.requiresReasonOnDelete
          ? requireReason(req, cfg.deleteReasonMessage)
          : null;

        let existing;
        let recordId;
        let where;
        let params;

        if (cfg.pk) {
          recordId = Number(req.params.id);
          if (!Number.isInteger(recordId)) {
            throw httpError(400, 'Invalid record id.');
          }
          existing = await loadExisting(cfg, recordId);
          where = `\`${cfg.pk}\` = ?`;
          params = [recordId];
        } else {
          const keyOne = Number(req.params.keyOne);
          const keyTwo = Number(req.params.keyTwo);
          if (!Number.isInteger(keyOne) || !Number.isInteger(keyTwo)) {
            throw httpError(400, 'Invalid record key.');
          }
          recordId = keyOne;
          existing = await loadExistingComposite(cfg, keyOne, keyTwo);
          where = `\`${cfg.keyFields[0]}\` = ? AND \`${cfg.keyFields[1]}\` = ?`;
          params = [keyOne, keyTwo];
        }

        if (!existing) throw httpError(404, `${cfg.label} not found.`);

        if (cfg.beforeDelete) {
          await cfg.beforeDelete({ req, existing });
        }

        if (cfg.deleteHandler) {
          await cfg.deleteHandler({ req, existing, reason: userReason });
        } else {
          await pool.query(`DELETE FROM \`${cfg.table}\` WHERE ${where}`, params);
        }

        await recordLog({
          req,
          cfg,
          actionType: 'DELETE',
          recordId,
          existing,
          userReason,
        });

        res.json({ message: `${cfg.label} deleted.` });
      }),
    );
  }

  return router;
}

const routers = {};
for (const [slug, cfg] of Object.entries(resources)) {
  routers[slug] = createResourceRouter(cfg);
}

module.exports = { routers, resources };
