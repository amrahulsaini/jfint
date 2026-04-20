import mysql from 'mysql2/promise';

async function addIndexes() {
  const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    port: Number(process.env.DB_PORT) || 3306,
  });

  const indexes = [
    { table: '2528firstyear_comm', index: 'idx_student_name', col: 'student_name(64)' },
    { table: '2528firstyear_comm', index: 'idx_roll_no_prefix', col: 'roll_no' },
    { table: 'jecr_1styear', index: 'idx_roll_no', col: 'roll_no' },
  ];

  for (const { table, index, col } of indexes) {
    try {
      await pool.query(`ALTER TABLE \`${table}\` ADD INDEX \`${index}\` (${col})`);
      console.log(`✅ Added index ${index} on ${table}`);
    } catch (e) {
      if (e.code === 'ER_DUP_KEYNAME') {
        console.log(`✓  Index ${index} already exists on ${table}`);
      } else {
        console.error(`❌ Failed ${index}:`, e.message);
      }
    }
  }

  pool.end();
}

addIndexes();
