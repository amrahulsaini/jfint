import mysql from 'mysql2/promise';

async function fixGenderBulk() {
  const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    port: Number(process.env.DB_PORT) || 3306,
  });

  try {
    console.log('Starting bulk gender fix via name+father matching...');

    // Single bulk UPDATE joining comm table to allinfo on name+father
    const [result] = await pool.query(`
      UPDATE \`2528firstyear_comm\` fc
      JOIN (
        SELECT
          ai.applicant_name,
          ai.father_name,
          ai.gender,
          ROW_NUMBER() OVER (PARTITION BY ai.applicant_name, ai.father_name ORDER BY ai.updated_at DESC, ai.id DESC) AS rn
        FROM \`2528allinfo\` ai
        WHERE ai.gender IS NOT NULL AND ai.gender != ''
      ) best ON (
        best.applicant_name = fc.student_name
        AND best.father_name = fc.father_name
        AND best.rn = 1
      )
      SET fc.gender = best.gender
      WHERE fc.gender IS NULL OR fc.gender = ''
    `);
    console.log('Bulk update done. Result:', result);

    // Verify
    const [check] = await pool.query("SELECT COUNT(*) as filled FROM `2528firstyear_comm` WHERE gender IS NOT NULL AND gender != ''");
    console.log('Students with gender after update:', check[0].filled);

    // Sample
    const [sample] = await pool.query("SELECT roll_no, student_name, gender FROM `2528firstyear_comm` WHERE gender != '' LIMIT 5");
    console.log('Sample with genders:', sample);

  } catch (e) {
    console.error('Error:', e.message);
  }
  pool.end();
}

fixGenderBulk();
