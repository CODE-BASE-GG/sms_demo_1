const fs = require('fs');
const path = require('path');
const express = require('express');
const cors = require('cors');
const config = require('./config');
const { pool, verifyConnection } = require('./db');
const { requireAuth, requireRole } = require('./middleware/auth');
const asyncHandler = require('./utils/asyncHandler');
const { httpError } = require('./utils/httpError');
const authRoutes = require('./routes/auth');
const dashboardRoutes = require('./routes/dashboard');
const { routers } = require('./routes/resources');

const app = express();

app.use(
  cors({
    origin: config.clientOrigin,
    credentials: true,
  }),
);
app.use(express.json({ limit: '1mb' }));

app.get(
  '/api/health',
  asyncHandler(async (req, res) => {
    const [[database]] = await pool.query('SELECT DATABASE() AS name');
    const [[tables]] = await pool.query(
      `SELECT COUNT(*) AS total
       FROM information_schema.tables
       WHERE table_schema = DATABASE()`,
    );
    res.json({
      status: 'ok',
      database: database.name,
      tables: tables.total,
      time: new Date().toISOString(),
    });
  }),
);

app.use('/api/auth', authRoutes);
app.use('/api/dashboard', requireAuth, dashboardRoutes);

// Audit-log status updates (approve / reject / reset to pending).
// Only administrators can review reasons submitted by teachers.
app.patch(
  '/api/logs/:id/status',
  requireAuth,
  requireRole('Admin'),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const status = String(req.body.status || '').trim();

    if (!Number.isInteger(id)) throw httpError(400, 'Invalid log id.');
    if (!['Pending', 'Approved', 'Rejected'].includes(status)) {
      throw httpError(400, 'Status must be Pending, Approved, or Rejected.');
    }

    const [result] = await pool.query('UPDATE `Log` SET `Status` = ? WHERE `LogID` = ?', [
      status,
      id,
    ]);

    if (result.affectedRows === 0) throw httpError(404, 'Log entry not found.');

    res.json({ message: `Log marked as ${status}.` });
  }),
);

// Log maintenance: remove resolved entries while keeping anything still
// awaiting review. This keeps the audit table from growing without bound.
app.get(
  '/api/logs/stats',
  requireAuth,
  requireRole('Admin'),
  asyncHandler(async (req, res) => {
    const [[counts]] = await pool.query(`
      SELECT
        COUNT(*) AS total,
        COUNT(CASE WHEN Status = 'Pending' THEN 1 END) AS pending,
        COUNT(CASE WHEN Status = 'Approved' THEN 1 END) AS approved,
        COUNT(CASE WHEN Status = 'Rejected' THEN 1 END) AS rejected
      FROM \`Log\`
    `);
    const total = Number(counts.total) || 0;
    const threshold = 20;
    res.json({
      total,
      pending: Number(counts.pending) || 0,
      approved: Number(counts.approved) || 0,
      rejected: Number(counts.rejected) || 0,
      threshold,
      needsMaintenance: total >= threshold,
    });
  }),
);

app.post(
  '/api/logs/cleanup',
  requireAuth,
  requireRole('Admin'),
  asyncHandler(async (req, res) => {
    const [result] = await pool.query(
      "DELETE FROM `Log` WHERE `Status` IN ('Approved', 'Rejected')",
    );
    res.json({
      deleted: result.affectedRows,
      message: `Removed ${result.affectedRows} resolved log entr${
        result.affectedRows === 1 ? 'y' : 'ies'
      }.`,
    });
  }),
);

for (const [slug, router] of Object.entries(routers)) {
  app.use(`/api/${slug}`, requireAuth, router);
}

app.use('/api', (req, res) => {
  res.status(404).json({ error: 'API endpoint not found.' });
});

// If the React app has been built, serve it from the same server too.
// In development, Vite runs separately on port 5173.
const clientDist = path.resolve(__dirname, '../../client/dist');
if (fs.existsSync(path.join(clientDist, 'index.html'))) {
  app.use(express.static(clientDist));
  app.get('*', (req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (res.headersSent) return;

  if (err.code === 'ER_DUP_ENTRY') {
    return res.status(409).json({
      error:
        'That record already exists. Emails, course names and course-subject links must be unique.',
    });
  }
  if (err.code === 'ER_ROW_IS_REFERENCED_2') {
    return res.status(409).json({
      error:
        'This record is used by other records, so it cannot be deleted. Remove the related records first.',
    });
  }
  if (err.code === 'ER_NO_REFERENCED_ROW_2') {
    return res.status(400).json({
      error: 'One of the selected related records does not exist anymore.',
    });
  }
  if (err.code === 'ER_BAD_FIELD_ERROR') {
    return res.status(400).json({ error: 'The database schema does not match the app.' });
  }
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Request body is not valid JSON.' });
  }

  const status = err.status || 500;
  if (status >= 500) {
    console.error('[api]', err);
  }

  return res.status(status).json({
    error: err.expose ? err.message : 'Something went wrong. Please try again.',
  });
});

const server = app.listen(config.port, () => {
  console.log(`[api] Sunny Campus API listening on http://localhost:${config.port}`);
  verifyConnection();
});

function shutdown(signal) {
  console.log(`\n[api] ${signal} received, shutting down...`);
  server.close(() => process.exit(0));
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

module.exports = app;
