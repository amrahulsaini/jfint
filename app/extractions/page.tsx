'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';

type EducationRow = {
  exam: string;
  rollNo: string;
  year: string;
  stream: string;
  board: string;
  obtainedMarks: string;
  maxMarks: string;
  percentage: string;
  cgpa: string;
  result: string;
};

type StudentFields = {
  applicantName: string;
  fatherName: string;
  motherName: string;
  gender: string;
  dateOfBirth: string;
  status: string;
  caste: string;
  categoryIAndII: string;
  categoryIII: string;
  specializationBranch: string;
  admissionStatus: string;
  earlierEnrollmentNo: string;
  permanentAddress: string;
  correspondenceAddress: string;
  mobileNo: string;
  parentMobileNo: string;
  entranceExamRollNo: string;
  entranceExamName: string;
  meritSecured: string;
  email: string;
  hasAadharCard: string;
  aadharNo: string;
  educationalQualification: string;
  collegeShift: string;
};

type StudentRecord = {
  pageNumber: number;
  metadata: {
    formType: string;
    session: string;
    college: string;
    branchName: string;
  };
  fields: StudentFields;
  educationRows: EducationRow[];
  rawText: string;
};

type ExtractionPayload = {
  exists?: boolean;
  sourceFile: string;
  outputFile: string;
  extractedAt: string;
  totalPages: number;
  totalRecords: number;
  records: StudentRecord[];
  message?: string;
  error?: string;
};

const SOURCE_FILE = 'forms-1styear/mechanical-engineering.pdf';

const FIELD_GROUPS: Array<{
  title: string;
  items: Array<{ key: keyof StudentFields; label: string; wide?: boolean }>;
}> = [
  {
    title: 'Identity',
    items: [
      { key: 'applicantName', label: 'Applicant Name', wide: true },
      { key: 'fatherName', label: 'Father Name' },
      { key: 'motherName', label: 'Mother Name' },
      { key: 'gender', label: 'Gender' },
      { key: 'dateOfBirth', label: 'Date Of Birth' },
      { key: 'status', label: 'Status' },
    ],
  },
  {
    title: 'Category And Admission',
    items: [
      { key: 'caste', label: 'Caste' },
      { key: 'categoryIAndII', label: 'Category I And II' },
      { key: 'categoryIII', label: 'Category III' },
      { key: 'specializationBranch', label: 'Specialization / Branch', wide: true },
      { key: 'admissionStatus', label: 'Admission Status' },
      { key: 'earlierEnrollmentNo', label: 'Earlier Enrollment No' },
      { key: 'collegeShift', label: 'College Shift' },
    ],
  },
  {
    title: 'Contact And Address',
    items: [
      { key: 'mobileNo', label: 'Mobile No' },
      { key: 'parentMobileNo', label: 'Parent Mobile No' },
      { key: 'email', label: 'Email', wide: true },
      { key: 'permanentAddress', label: 'Permanent Address', wide: true },
      { key: 'correspondenceAddress', label: 'Correspondence Address', wide: true },
    ],
  },
  {
    title: 'Exam And Aadhar',
    items: [
      { key: 'entranceExamName', label: 'Entrance Exam Name' },
      { key: 'entranceExamRollNo', label: 'Entrance Exam Roll No' },
      { key: 'meritSecured', label: 'Merit Secured' },
      { key: 'hasAadharCard', label: 'Has Aadhar Card' },
      { key: 'aadharNo', label: 'Aadhar No' },
      { key: 'educationalQualification', label: 'Educational Qualification', wide: true },
    ],
  },
];

function fmtDate(iso?: string) {
  if (!iso) return '-';
  return new Date(iso).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
}

export default function ExtractionsPage() {
  const [data, setData] = useState<ExtractionPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [extracting, setExtracting] = useState(false);
  const [error, setError] = useState('');
  const [selectedPage, setSelectedPage] = useState<number>(1);

  const loadExisting = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/extractions?file=${encodeURIComponent(SOURCE_FILE)}`);
      const json = (await res.json()) as ExtractionPayload;
      if (!res.ok || json.error) {
        setError(json.error || 'Failed to load extraction data.');
        setData(null);
      } else {
        setData(json.exists === false ? null : json);
        const firstPage = json.records?.[0]?.pageNumber || 1;
        setSelectedPage(firstPage);
      }
    } catch {
      setError('Failed to load extraction data.');
      setData(null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadExisting();
  }, [loadExisting]);

  const runExtraction = async () => {
    setExtracting(true);
    setError('');
    try {
      const res = await fetch('/api/extractions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file: SOURCE_FILE }),
      });

      const json = (await res.json()) as ExtractionPayload;
      if (!res.ok || json.error) {
        setError(json.error || 'Extraction failed.');
      } else {
        setData(json);
        setSelectedPage(json.records?.[0]?.pageNumber || 1);
      }
    } catch {
      setError('Extraction failed.');
    }
    setExtracting(false);
  };

  const selectedRecord = useMemo(() => {
    if (!data?.records?.length) return null;
    return data.records.find(r => r.pageNumber === selectedPage) || data.records[0];
  }, [data, selectedPage]);

  const withEmail = data?.records?.filter(r => r.fields.email).length || 0;
  const withAadhar = data?.records?.filter(r => r.fields.aadharNo).length || 0;

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100">
      <div className="max-w-7xl mx-auto px-5 md:px-8 py-8 md:py-10">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-cyan-400">PDF Extraction Console</p>
            <h1 className="text-2xl md:text-3xl font-black mt-1">First Year Form JSON Extractor</h1>
            <p className="text-sm text-neutral-400 mt-1">Source: {SOURCE_FILE}</p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/portal"
              className="h-10 px-4 rounded-xl border border-neutral-700 bg-neutral-900 hover:bg-neutral-800 text-xs font-black flex items-center"
            >
              Back To Portal
            </Link>
            <button
              onClick={loadExisting}
              className="h-10 px-4 rounded-xl border border-neutral-700 bg-neutral-900 hover:bg-neutral-800 text-xs font-black"
              disabled={loading || extracting}
            >
              Refresh
            </button>
            <button
              onClick={runExtraction}
              className="h-10 px-4 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-neutral-950 text-xs font-black disabled:opacity-60"
              disabled={extracting}
            >
              {extracting ? 'Extracting...' : 'Run Extraction'}
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-5 rounded-2xl border border-red-400/40 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-300">
            {error}
          </div>
        )}

        {loading ? (
          <div className="rounded-2xl border border-neutral-800 bg-neutral-900 px-6 py-10 text-sm font-semibold text-neutral-400">
            Loading extraction data...
          </div>
        ) : data ? (
          <div className="space-y-5">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-4">
                <p className="text-[11px] font-black uppercase tracking-wider text-neutral-500">Pages</p>
                <p className="text-2xl font-black text-cyan-300 mt-1">{data.totalPages}</p>
              </div>
              <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-4">
                <p className="text-[11px] font-black uppercase tracking-wider text-neutral-500">Records</p>
                <p className="text-2xl font-black text-emerald-300 mt-1">{data.totalRecords}</p>
              </div>
              <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-4">
                <p className="text-[11px] font-black uppercase tracking-wider text-neutral-500">With Email</p>
                <p className="text-2xl font-black text-amber-300 mt-1">{withEmail}</p>
              </div>
              <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-4">
                <p className="text-[11px] font-black uppercase tracking-wider text-neutral-500">With Aadhar</p>
                <p className="text-2xl font-black text-fuchsia-300 mt-1">{withAadhar}</p>
              </div>
            </div>

            <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-4 text-xs font-semibold text-neutral-400">
              <p>Saved JSON: {data.outputFile}</p>
              <p className="mt-1">Extracted At: {fmtDate(data.extractedAt)}</p>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
              <div className="xl:col-span-2 rounded-2xl border border-neutral-800 bg-neutral-900 p-3 max-h-[520px] overflow-auto">
                <h2 className="text-sm font-black text-neutral-100 px-1 pb-2">Pages</h2>
                <div className="space-y-2">
                  {data.records.map((r) => {
                    const active = selectedRecord?.pageNumber === r.pageNumber;
                    return (
                      <button
                        key={r.pageNumber}
                        onClick={() => setSelectedPage(r.pageNumber)}
                        className={`w-full text-left rounded-xl border px-3 py-2 transition-all ${
                          active
                            ? 'border-cyan-400 bg-cyan-500/10'
                            : 'border-neutral-800 bg-neutral-950 hover:border-neutral-600'
                        }`}
                      >
                        <p className="text-xs font-black text-cyan-300">Page {r.pageNumber}</p>
                        <p className="text-sm font-bold text-neutral-100 truncate">{r.fields.applicantName || '-'}</p>
                        <p className="text-[11px] font-semibold text-neutral-400 truncate">{r.fields.mobileNo || '-'} • {r.fields.email || '-'}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="xl:col-span-3 rounded-2xl border border-neutral-800 bg-neutral-900 p-4 max-h-[520px] overflow-auto">
                {selectedRecord ? (
                  <div className="space-y-4">
                    <div>
                      <h2 className="text-lg font-black">{selectedRecord.fields.applicantName || 'Unnamed Student'}</h2>
                      <p className="text-xs font-semibold text-neutral-400 mt-1">Page {selectedRecord.pageNumber} • {selectedRecord.metadata.branchName || 'Branch not found'}</p>
                    </div>

                    <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-3">
                      <h3 className="text-sm font-black mb-2">Form Metadata</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                        <div className="rounded-lg border border-neutral-800 px-3 py-2">
                          <p className="text-[11px] text-neutral-500 font-black uppercase">Form Type</p>
                          <p className="font-semibold mt-1">{selectedRecord.metadata.formType || '-'}</p>
                        </div>
                        <div className="rounded-lg border border-neutral-800 px-3 py-2">
                          <p className="text-[11px] text-neutral-500 font-black uppercase">Session</p>
                          <p className="font-semibold mt-1">{selectedRecord.metadata.session || '-'}</p>
                        </div>
                        <div className="rounded-lg border border-neutral-800 px-3 py-2 md:col-span-2">
                          <p className="text-[11px] text-neutral-500 font-black uppercase">College</p>
                          <p className="font-semibold mt-1">{selectedRecord.metadata.college || '-'}</p>
                        </div>
                        <div className="rounded-lg border border-neutral-800 px-3 py-2 md:col-span-2">
                          <p className="text-[11px] text-neutral-500 font-black uppercase">Branch Name</p>
                          <p className="font-semibold mt-1">{selectedRecord.metadata.branchName || '-'}</p>
                        </div>
                      </div>
                    </div>

                    {FIELD_GROUPS.map((group) => (
                      <div key={group.title} className="rounded-xl border border-neutral-800 bg-neutral-950 p-3">
                        <h3 className="text-sm font-black mb-2">{group.title}</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                          {group.items.map((item) => (
                            <div
                              key={String(item.key)}
                              className={`rounded-lg border border-neutral-800 px-3 py-2 ${item.wide ? 'md:col-span-2' : ''}`}
                            >
                              <p className="text-[11px] text-neutral-500 font-black uppercase">{item.label}</p>
                              <p className="font-semibold mt-1 break-words">{selectedRecord.fields[item.key] || '-'}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}

                    <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-3">
                      <h3 className="text-sm font-black mb-2">Raw Page Text</h3>
                      <pre className="text-xs text-neutral-300 bg-neutral-900 border border-neutral-800 rounded-lg p-3 overflow-auto max-h-[220px] whitespace-pre-wrap">
                        {selectedRecord.rawText || '-'}
                      </pre>
                    </div>

                    <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-3">
                      <h3 className="text-sm font-black mb-2">Education Rows</h3>
                      {selectedRecord.educationRows.length === 0 ? (
                        <p className="text-xs text-neutral-400">No rows parsed.</p>
                      ) : (
                        <div className="overflow-auto rounded-lg border border-neutral-800">
                          <table className="min-w-[900px] w-full text-xs">
                            <thead className="bg-neutral-900">
                              <tr>
                                <th className="text-left px-3 py-2 font-black text-neutral-400 uppercase tracking-wider">Exam</th>
                                <th className="text-left px-3 py-2 font-black text-neutral-400 uppercase tracking-wider">Roll No</th>
                                <th className="text-left px-3 py-2 font-black text-neutral-400 uppercase tracking-wider">Year</th>
                                <th className="text-left px-3 py-2 font-black text-neutral-400 uppercase tracking-wider">Stream</th>
                                <th className="text-left px-3 py-2 font-black text-neutral-400 uppercase tracking-wider">Board</th>
                                <th className="text-left px-3 py-2 font-black text-neutral-400 uppercase tracking-wider">Obt. Marks</th>
                                <th className="text-left px-3 py-2 font-black text-neutral-400 uppercase tracking-wider">Max. Marks</th>
                                <th className="text-left px-3 py-2 font-black text-neutral-400 uppercase tracking-wider">Percentage</th>
                                <th className="text-left px-3 py-2 font-black text-neutral-400 uppercase tracking-wider">CGPA</th>
                                <th className="text-left px-3 py-2 font-black text-neutral-400 uppercase tracking-wider">Result</th>
                              </tr>
                            </thead>
                            <tbody>
                              {selectedRecord.educationRows.map((row, idx) => (
                                <tr key={`${row.exam}-${idx}`} className="border-t border-neutral-800 odd:bg-neutral-950 even:bg-neutral-900/50">
                                  <td className="px-3 py-2 font-bold text-cyan-300 whitespace-nowrap">{row.exam || '-'}</td>
                                  <td className="px-3 py-2 text-neutral-200">{row.rollNo || '-'}</td>
                                  <td className="px-3 py-2 text-neutral-200">{row.year || '-'}</td>
                                  <td className="px-3 py-2 text-neutral-200">{row.stream || '-'}</td>
                                  <td className="px-3 py-2 text-neutral-200">{row.board || '-'}</td>
                                  <td className="px-3 py-2 text-neutral-200">{row.obtainedMarks || '-'}</td>
                                  <td className="px-3 py-2 text-neutral-200">{row.maxMarks || '-'}</td>
                                  <td className="px-3 py-2 text-neutral-200">{row.percentage || '-'}</td>
                                  <td className="px-3 py-2 text-neutral-200">{row.cgpa || '-'}</td>
                                  <td className="px-3 py-2 text-emerald-300 font-bold">{row.result || '-'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <p className="text-sm font-semibold text-neutral-400">No record selected.</p>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-4">
              <h3 className="text-sm font-black mb-3">Raw JSON Preview</h3>
              <pre className="text-xs text-neutral-300 bg-neutral-950 border border-neutral-800 rounded-xl p-3 overflow-auto max-h-[360px]">
                {JSON.stringify(data, null, 2)}
              </pre>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-neutral-800 bg-neutral-900 px-6 py-10 text-sm font-semibold text-neutral-400">
            No extraction JSON found yet. Click Run Extraction.
          </div>
        )}
      </div>
    </div>
  );
}
