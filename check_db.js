import mysql from 'mysql2/promise';

async function checkDb() {
  const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    port: Number(process.env.DB_PORT) || 3306,
  });
  
  try {
    const [c1] = await pool.query("SELECT COUNT(*) as c FROM `1styearmaster` WHERE roll_no LIKE '25%'");
    console.log('1styearmaster count:', c1[0].c);

    const [c2] = await pool.query("SELECT COUNT(*) as c FROM `2528firstyear_comm`");
    console.log('2528firstyear_comm count:', c2[0].c);

    const [c3] = await pool.query("SELECT COUNT(*) as c FROM `2528firstyear_comm` WHERE gender IS NOT NULL AND gender != ''");
    console.log('2528firstyear_comm gender count:', c3[0].c);

    const [aiCount] = await pool.query("SELECT COUNT(*) as c FROM `2528allinfo` WHERE gender IS NOT NULL AND gender != ''");
    console.log('2528allinfo gender count:', aiCount[0].c);

    const [sample] = await pool.query("SELECT roll_no, gender FROM `2528firstyear_comm` LIMIT 5");
    console.log('Sample from comm table:', sample);

    const [aiSample] = await pool.query("SELECT earlier_enrollment_no, entrance_exam_roll_no, gender FROM `2528allinfo` WHERE gender IS NOT NULL LIMIT 5");
    console.log('Sample from allinfo:', aiSample);
  } catch (e) {
    console.error(e);
  }
  pool.end();
}

checkDb();
