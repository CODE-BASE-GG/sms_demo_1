const { pool } = require('../src/db');

async function clearData() {
  console.log('Clearing all data except demo accounts...');
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    await connection.query('SET FOREIGN_KEY_CHECKS = 0');

    // Clear dependent tables
    console.log('Clearing Attendance...');
    await connection.query('TRUNCATE TABLE `Attendance`');

    console.log('Clearing StudentScore...');
    await connection.query('TRUNCATE TABLE `StudentScore`');

    console.log('Clearing Assessment...');
    await connection.query('TRUNCATE TABLE `Assessment`');

    console.log('Clearing Student...');
    await connection.query('TRUNCATE TABLE `Student`');

    console.log('Clearing SectionSubject...');
    await connection.query('TRUNCATE TABLE `SectionSubject`');

    console.log('Clearing Section...');
    await connection.query('TRUNCATE TABLE `Section`');

    console.log('Clearing CourseSubject...');
    await connection.query('TRUNCATE TABLE `CourseSubject`');

    console.log('Clearing Subject...');
    await connection.query('TRUNCATE TABLE `Subject`');

    console.log('Clearing Course...');
    await connection.query('TRUNCATE TABLE `Course`');

    console.log('Clearing Log...');
    await connection.query('TRUNCATE TABLE `Log`');

    console.log('Clearing PendingAction...');
    await connection.query('TRUNCATE TABLE `PendingAction`');

    // Keep only demo teachers
    console.log('Cleaning Teacher table to keep only demo accounts...');
    await connection.query(
      "DELETE FROM `Teacher` WHERE `Email` NOT IN ('teacher@sunnycampus.test', 'james@sunnycampus.test')",
    );

    // Keep only demo admin
    console.log('Cleaning Admin table to keep only demo admin...');
    await connection.query(
      "DELETE FROM `Admin` WHERE `Email` NOT IN ('admin@sunnycampus.test')",
    );

    await connection.query('SET FOREIGN_KEY_CHECKS = 1');

    await connection.commit();
    console.log('✓ Successfully cleared data! Fresh start ready.');
  } catch (error) {
    await connection.rollback();
    await connection.query('SET FOREIGN_KEY_CHECKS = 1');
    console.error('Failed to clear data:', error);
    process.exitCode = 1;
  } finally {
    connection.release();
    await pool.end();
  }
}

clearData();
