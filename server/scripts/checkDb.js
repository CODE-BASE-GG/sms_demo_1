const { pool } = require('../src/db');
const config = require('../src/config');
const resources = require('../src/resources');

async function main() {
  const [[databaseInfo]] = await pool.query('SELECT DATABASE() AS name');
  const expectedTables = [...new Set(Object.values(resources).map((resource) => resource.table))];

  const [tables] = await pool.query(
    `SELECT table_name AS name
     FROM information_schema.tables
     WHERE table_schema = DATABASE()`,
  );
  const existing = new Set(tables.map((row) => row.name));

  console.log('');
  console.log(`Connected to database: ${databaseInfo.name}`);
  console.log(`Host: ${config.db.host}:${config.db.port}`);
  console.log('');

  let missing = 0;
  for (const table of expectedTables) {
    if (!existing.has(table)) {
      console.log(`  ✗ ${table.padEnd(16)} MISSING`);
      missing += 1;
      continue;
    }
    const [[count]] = await pool.query(`SELECT COUNT(*) AS total FROM \`${table}\``);
    console.log(`  ✓ ${table.padEnd(16)} ${count.total} rows`);
  }

  console.log('');
  if (missing === 0) {
    console.log(`All ${expectedTables.length} expected tables are present in "${databaseInfo.name}".`);
  } else {
    console.log(
      `${missing} table(s) are missing. Run "npm run db:init" if this database should contain the schema.`,
    );
    process.exitCode = 1;
  }
}

main()
  .catch((error) => {
    console.error('Database check failed:', error.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
