import mysql from 'mysql2/promise';

async function fixGender() {
  const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    port: Number(process.env.DB_PORT) || 3306,
  });
  
  try {
    console.log('Fetching all students without gender...');
    const [rows] = await pool.query('SELECT roll_no FROM `2528firstyear_comm` WHERE gender IS NULL OR gender = ""');
    console.log(`Found ${rows.length} students without gender.`);
    
    let updated = 0;
    for (const row of rows) {
      const roll_no = row.roll_no;
      
      const normalizedFmRoll = `REPLACE(REPLACE(REPLACE('${roll_no}', ' ', ''), '-', ''), '/', '')`;
      const rollMatchExpr = `(
        ai.\`earlier_enrollment_no\` = '${roll_no}'
        OR ai.\`entrance_exam_roll_no\` = '${roll_no}'
        OR REPLACE(REPLACE(REPLACE(TRIM(ai.\`earlier_enrollment_no\`), ' ', ''), '-', ''), '/', '') = ${normalizedFmRoll}
        OR REPLACE(REPLACE(REPLACE(TRIM(ai.\`entrance_exam_roll_no\`), ' ', ''), '-', ''), '/', '') = ${normalizedFmRoll}
      )`;
      
      const [aiRows] = await pool.query(`SELECT gender FROM \`2528allinfo\` ai WHERE ${rollMatchExpr} ORDER BY updated_at DESC, id DESC LIMIT 1`);
      
      if (aiRows.length > 0 && aiRows[0].gender) {
        await pool.query('UPDATE `2528firstyear_comm` SET gender = ? WHERE roll_no = ?', [aiRows[0].gender, roll_no]);
        updated++;
      }
    }
    
    console.log(`Successfully updated gender for ${updated} students.`);
    
    // Also drop the ensureFirstYearCommunicationTable function call from route.ts to make it FAST!
  } catch (e) {
    console.error(e);
  }
  pool.end();
}

fixGender();
