import mysql from 'mysql2/promise';

async function test() {
  const pool = mysql.createPool({
    uri: process.env.DATABASE_URL || 'mysql://root:@localhost:3306/jfint', // need to get the real DB URL
  });
  
  try {
    const [rows] = await pool.query('SELECT roll_no, gender FROM `2528firstyear_comm` LIMIT 5');
    console.log(rows);
  } catch (e) {
    console.error(e);
  }
  pool.end();
}

test();
