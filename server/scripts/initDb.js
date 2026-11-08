const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const config = require('../src/config');

const RESET = process.argv.includes('--reset');
const schemaPath = path.resolve(__dirname, '../../student_management_system_db.sql');

async function main() {
  if (!fs.existsSync(schemaPath)) {
    throw new Error(`Schema file not found at ${schemaPath}`);
  }

  const connection = await mysql.createConnection({
    host: config.db.host,
    port: config.db.port,
    user: config.db.user,
    password: config.db.password,
    database: config.db.database,
    ssl: config.db.ssl ? { rejectUnauthorized: false } : undefined,
    multipleStatements: true,
  });

  try {
    const [tables] = await connection.query(
      `SELECT table_name AS name
       FROM information_schema.tables
       WHERE table_schema = DATABASE()`,
    );
    const existing = new Set(tables.map((row) => row.name));
    const expectedTables = [
      'Course',
      'Subject',
      'CourseSubject',
      'Teacher',
      'Admin',
      'Section',
      'SectionSubject',
      'Student',
      'Assessment',
      'StudentScore',
      'Attendance',
      'Log',
      'PendingAction',
    ];
    const found = expectedTables.filter((table) => existing.has(table));

    if (found.length > 0) {
      if (!RESET) {
        if (found.length === expectedTables.length) {
          console.log(
            `Database is already initialised (all ${expectedTables.length} tables were found). Nothing to do.`,
          );
          console.log('Run "npm run db:reset" to drop everything and re-create it.');
        } else {
          console.error(
            `Only ${found.length} of the ${expectedTables.length} expected tables exist (${found.join(', ')}).`,
          );
          console.error('Run "npm run db:reset" to rebuild the schema cleanly.');
          process.exitCode = 1;
        }
        return;
      }

      console.log('Dropping existing tables...');
      await connection.query('SET FOREIGN_KEY_CHECKS = 0');
      for (const table of [
        'PendingAction',
        'Log',
        'Attendance',
        'StudentScore',
        'Assessment',
        'Student',
        'SectionSubject',
        'Section',
        'Admin',
        'Teacher',
        'CourseSubject',
        'Subject',
        'Course',
      ]) {
        if (existing.has(table)) {
          await connection.query(`DROP TABLE \`${table}\``);
        }
      }
      await connection.query('SET FOREIGN_KEY_CHECKS = 1');
    }

    const sql = fs.readFileSync(schemaPath, 'utf8');
    console.log(`Applying schema from ${schemaPath}...`);
    await connection.query(sql);
    console.log('Database schema created successfully.');
    console.log('Next: run "npm run db:seed" to add demo accounts and sample data.');
  } finally {
    await connection.end();
  }
}

main().catch((error) => {
  console.error('Database initialisation failed:', error.message);
  process.exitCode = 1;
});
