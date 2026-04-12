import { NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { listFormPdfFiles, runExtraction, type StudentRecord } from '@/lib/extractions';

export const runtime = 'nodejs';

type LogLevel = 'info' | 'warn' | 'error';

type IngestLog = {
  at: string;
  level: LogLevel;
  message: string;
  file?: string;
};

type FileSummary = {
  file: string;
  outputFile?: string;
  totalPages: number;
  totalRecords: number;
  rowsSaved: number;
  status: 'ok' | 'failed';
  error?: string;
};

const TABLE_NAME = '2528allinfo';

function logPush(logs: IngestLog[], level: LogLevel, message: string, file?: string) {
  logs.push({ at: new Date().toISOString(), level, message, file });
}

async function ensureTable() {
  const pool = getPool();
  await pool.query(
    `CREATE TABLE IF NOT EXISTS \`${TABLE_NAME}\` (
      id BIGINT NOT NULL AUTO_INCREMENT,
      source_file VARCHAR(255) NOT NULL,
      page_number INT NOT NULL,
      form_type VARCHAR(255) DEFAULT '',
      session VARCHAR(64) DEFAULT '',
      college TEXT,
      branch_name VARCHAR(255) DEFAULT '',
      applicant_name VARCHAR(255) DEFAULT '',
      father_name VARCHAR(255) DEFAULT '',
      mother_name VARCHAR(255) DEFAULT '',
      gender VARCHAR(64) DEFAULT '',
      dob VARCHAR(128) DEFAULT '',
      student_status VARCHAR(128) DEFAULT '',
      caste VARCHAR(128) DEFAULT '',
      category_i_ii VARCHAR(128) DEFAULT '',
      category_iii VARCHAR(128) DEFAULT '',
      specialization_branch VARCHAR(255) DEFAULT '',
      admission_status VARCHAR(128) DEFAULT '',
      earlier_enrollment_no VARCHAR(128) DEFAULT '',
      permanent_address TEXT,
      correspondence_address TEXT,
      mobile_no VARCHAR(64) DEFAULT '',
      parent_mobile_no VARCHAR(64) DEFAULT '',
      entrance_exam_roll_no VARCHAR(128) DEFAULT '',
      entrance_exam_name VARCHAR(255) DEFAULT '',
      merit_secured VARCHAR(128) DEFAULT '',
      email VARCHAR(255) DEFAULT '',
      has_aadhar_card VARCHAR(64) DEFAULT '',
      aadhar_no VARCHAR(128) DEFAULT '',
      educational_qualification VARCHAR(255) DEFAULT '',
      college_shift VARCHAR(64) DEFAULT '',
      education_rows_json LONGTEXT,
      raw_text LONGTEXT,
      extracted_at DATETIME NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uk_source_page (source_file, page_number),
      KEY idx_mobile (mobile_no),
      KEY idx_email (email)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,
  );
}

async function upsertRecord(sourceFile: string, extractedAtIso: string, record: StudentRecord) {
  const pool = getPool();
  const f = record.fields;

  await pool.query(
    `INSERT INTO \`${TABLE_NAME}\` (
      source_file, page_number, form_type, session, college, branch_name,
      applicant_name, father_name, mother_name, gender, dob, student_status,
      caste, category_i_ii, category_iii, specialization_branch,
      admission_status, earlier_enrollment_no, permanent_address, correspondence_address,
      mobile_no, parent_mobile_no, entrance_exam_roll_no, entrance_exam_name,
      merit_secured, email, has_aadhar_card, aadhar_no,
      educational_qualification, college_shift,
      education_rows_json, raw_text, extracted_at
    ) VALUES (
      ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?,
      ?, ?, ?
    )
    ON DUPLICATE KEY UPDATE
      form_type = VALUES(form_type),
      session = VALUES(session),
      college = VALUES(college),
      branch_name = VALUES(branch_name),
      applicant_name = VALUES(applicant_name),
      father_name = VALUES(father_name),
      mother_name = VALUES(mother_name),
      gender = VALUES(gender),
      dob = VALUES(dob),
      student_status = VALUES(student_status),
      caste = VALUES(caste),
      category_i_ii = VALUES(category_i_ii),
      category_iii = VALUES(category_iii),
      specialization_branch = VALUES(specialization_branch),
      admission_status = VALUES(admission_status),
      earlier_enrollment_no = VALUES(earlier_enrollment_no),
      permanent_address = VALUES(permanent_address),
      correspondence_address = VALUES(correspondence_address),
      mobile_no = VALUES(mobile_no),
      parent_mobile_no = VALUES(parent_mobile_no),
      entrance_exam_roll_no = VALUES(entrance_exam_roll_no),
      entrance_exam_name = VALUES(entrance_exam_name),
      merit_secured = VALUES(merit_secured),
      email = VALUES(email),
      has_aadhar_card = VALUES(has_aadhar_card),
      aadhar_no = VALUES(aadhar_no),
      educational_qualification = VALUES(educational_qualification),
      college_shift = VALUES(college_shift),
      education_rows_json = VALUES(education_rows_json),
      raw_text = VALUES(raw_text),
      extracted_at = VALUES(extracted_at)`,
    [
      sourceFile,
      record.pageNumber,
      record.metadata.formType,
      record.metadata.session,
      record.metadata.college,
      record.metadata.branchName,
      f.applicantName,
      f.fatherName,
      f.motherName,
      f.gender,
      f.dateOfBirth,
      f.status,
      f.caste,
      f.categoryIAndII,
      f.categoryIII,
      f.specializationBranch,
      f.admissionStatus,
      f.earlierEnrollmentNo,
      f.permanentAddress,
      f.correspondenceAddress,
      f.mobileNo,
      f.parentMobileNo,
      f.entranceExamRollNo,
      f.entranceExamName,
      f.meritSecured,
      f.email,
      f.hasAadharCard,
      f.aadharNo,
      f.educationalQualification,
      f.collegeShift,
      JSON.stringify(record.educationRows),
      record.rawText,
      new Date(extractedAtIso),
    ],
  );
}

export async function POST() {
  const logs: IngestLog[] = [];
  const files: FileSummary[] = [];

  try {
    logPush(logs, 'info', `Preparing table ${TABLE_NAME}`);
    await ensureTable();
    logPush(logs, 'info', `Table ${TABLE_NAME} is ready`);

    const pdfFiles = await listFormPdfFiles();
    if (pdfFiles.length === 0) {
      return NextResponse.json({
        table: TABLE_NAME,
        totalFiles: 0,
        filesProcessed: 0,
        totalRecordsExtracted: 0,
        totalRowsSaved: 0,
        files,
        logs,
        message: 'No PDFs found in public/forms-1styear',
      });
    }

    let totalRecordsExtracted = 0;
    let totalRowsSaved = 0;

    for (const file of pdfFiles) {
      try {
        logPush(logs, 'info', 'Extracting PDF', file);
        const extraction = await runExtraction(file);
        totalRecordsExtracted += extraction.totalRecords;
        logPush(logs, 'info', `Extracted ${extraction.totalRecords} records from ${extraction.totalPages} pages`, file);

        let rowsSaved = 0;
        for (const record of extraction.records) {
          await upsertRecord(extraction.sourceFile, extraction.extractedAt, record);
          rowsSaved++;
        }
        totalRowsSaved += rowsSaved;

        files.push({
          file,
          outputFile: extraction.outputFile,
          totalPages: extraction.totalPages,
          totalRecords: extraction.totalRecords,
          rowsSaved,
          status: 'ok',
        });
        logPush(logs, 'info', `Saved ${rowsSaved} records to DB`, file);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed while processing file';
        files.push({ file, totalPages: 0, totalRecords: 0, rowsSaved: 0, status: 'failed', error: message });
        logPush(logs, 'error', message, file);
      }
    }

    const filesProcessed = files.filter(f => f.status === 'ok').length;

    return NextResponse.json({
      table: TABLE_NAME,
      totalFiles: files.length,
      filesProcessed,
      totalRecordsExtracted,
      totalRowsSaved,
      files,
      logs,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Batch extraction failed';
    logPush(logs, 'error', message);
    return NextResponse.json({ error: message, logs }, { status: 500 });
  }
}
