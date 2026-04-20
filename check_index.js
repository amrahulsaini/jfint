import mysql from 'mysql2/promise';

async function checkIndex() {
  const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    port: Number(process.env.DB_PORT) || 3306,
  });
  
  try {
    const [rows] = await pool.query("SHOW INDEXES FROM `jecr_1styear`");
    console.log('Indexes in jecr_1styear:', rows);
  } catch (e) {
    console.error(e);
  }
  pool.end();
}

checkIndex();
