const mysql = require('mysql2/promise');
const config = require('./config');

const pool = mysql.createPool({
  host: config.db.host,
  port: config.db.port,
  user: config.db.user,
  password: config.db.password,
  database: config.db.database,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  dateStrings: true,
  ssl: config.db.ssl ? { rejectUnauthorized: false } : undefined,
});

async function verifyConnection() {
  try {
    const connection = await pool.getConnection();
    await connection.ping();
    connection.release();
    console.log(
      `[db] Connected to MySQL at ${config.db.host}:${config.db.port}/${config.db.database}`,
    );
    return true;
  } catch (error) {
    console.error('[db] Could not connect to MySQL:', error.message);

    if (error.code === 'ER_BAD_DB_ERROR') {
      console.error(
        `[db] The database "${config.db.database}" does not exist for this user. Check DB_NAME in server/.env.`,
      );
    } else if (error.code === 'ER_DBACCESS_DENIED_ERROR') {
      console.error(
        `[db] This MySQL user cannot access the "${config.db.database}" database. Grant it access or check DB_NAME.`,
      );
    } else if (error.code === 'ER_ACCESS_DENIED_ERROR') {
      console.error('[db] The MySQL username or password was rejected.');
    }

    console.error(
      '[db] Check DATABASE_URL / DB_* values in server/.env, then restart the server.',
    );
    return false;
  }
}

module.exports = { pool, verifyConnection };
