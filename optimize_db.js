import mysql from 'mysql2/promise';

async function optimizeDb() {
  const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    port: Number(process.env.DB_PORT) || 3306,
  });
  
  try {
    console.log('Adding index to jecr_1styear.roll_no...');
    try {
      await pool.query('ALTER TABLE `jecr_1styear` ADD INDEX `idx_roll_no` (`roll_no`)');
      console.log('Index added successfully.');
    } catch (e) {
      if (e.code === 'ER_DUP_KEYNAME') {
        console.log('Index already exists.');
      } else {
        throw e;
      }
    }

    console.log('Fetching students to fix gender...');
    const [rows] = await pool.query('SELECT roll_no, student_name, father_name FROM `2528firstyear_comm` WHERE gender IS NULL OR gender = ""');
    console.log(`Found ${rows.length} students without gender.`);
    
    let updated = 0;
    for (const row of rows) {
      const studentName = (row.student_name || '').trim();
      const studentNameSpace = studentName.replace(/\s+/g, ' ');
      
      const fatherName = (row.father_name || '').trim();
      const fatherNameSpace = fatherName.replace(/\s+/g, ' ');
      
      const nameCandidates = [...new Set([studentName, studentNameSpace].filter(Boolean))];
      const fatherCandidates = [...new Set([fatherName, fatherNameSpace].filter(Boolean))];
      
      if (nameCandidates.length > 0 || fatherCandidates.length > 0) {
        let whereClauses = [];
        let params = [];
        if (nameCandidates.length > 0) {
          whereClauses.push(`applicant_name IN (${nameCandidates.map(()=>'?').join(',')})`);
          params.push(...nameCandidates);
        }
        if (fatherCandidates.length > 0) {
          whereClauses.push(`father_name IN (${fatherCandidates.map(()=>'?').join(',')})`);
          params.push(...fatherCandidates);
        }
        
        const q = `SELECT gender FROM \`2528allinfo\` WHERE (${whereClauses.join(' OR ')}) AND gender IS NOT NULL AND gender != '' ORDER BY updated_at DESC LIMIT 1`;
        const [aiRows] = await pool.query(q, params);
        
        if (aiRows.length > 0 && aiRows[0].gender) {
          await pool.query('UPDATE `2528firstyear_comm` SET gender = ? WHERE roll_no = ?', [aiRows[0].gender, row.roll_no]);
          updated++;
        }
      }
    }
    console.log(`Successfully updated gender for ${updated} students.`);

  } catch (e) {
    console.error(e);
  }
  pool.end();
}

optimizeDb();
