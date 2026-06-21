const cleanText = (text) => {
  return text
    .replace(/\r/g, "")
    .replace(/[ ]{2,}/g, " ")
    .replace(/\n+/g, "\n")
    .trim();
};

/* =========================
   SUBJECT EXTRACTION (BEU STYLE)
========================= */
function extractSubjects(text) {
  const lines = text.split("\n");
  const subjects = [];

  lines.forEach((line) => {
    const match = line.match(
      /^([A-Z0-9]+)\s+(.+?)\s+(\d+)\s+(\d+)\s+(\d+)\s+([A-F+]+)\s+(\d+)$/
    );

    if (match) {
      subjects.push({
        subjectCode: match[1],
        subjectName: match[2],
        ese: Number(match[3]),
        ia: Number(match[4]),
        total: Number(match[5]),
        grade: match[6],
        credit: Number(match[7]),
        type: "THEORY"
      });
    }
  });

  return subjects;
}

/* =========================
   STUDENT INFO EXTRACTION
========================= */
function extractStudentInfo(text) {
  const regNo = text.match(/\d{10,}/)?.[0] || "UNKNOWN";

  const nameMatch = text.match(/Name\s*[:\-]?\s*(.+)/i);
  const studentName = nameMatch
    ? nameMatch[1].split("\n")[0].trim()
    : "Unknown";

  const semesterMatch = text.match(/Semester\s*[:\-]?\s*(\d+)/i);
  const semester = semesterMatch ? semesterMatch[1] : "N/A";

  const sgpaMatch = text.match(/SGPA\s*[:\-]?\s*([0-9.]+)/i);
  const cgpaMatch = text.match(/CGPA\s*[:\-]?\s*([0-9.]+)/i);

  const sgpa = sgpaMatch ? Number(sgpaMatch[1]) : 0;
  const cgpa = cgpaMatch ? Number(cgpaMatch[1]) : 0;

  const resultStatus = text.toLowerCase().includes("fail") ? "FAIL" : "PASS";

  return {
    regNo,
    studentName,
    semester,
    sgpa,
    cgpa,
    resultStatus
  };
}

/* =========================
   CREDIT CALCULATION
========================= */
function calculateCredits(subjects) {
  return subjects.reduce((sum, s) => sum + (s.credit || 0), 0);
}

/* =========================
   MAIN EXPORT FUNCTION
========================= */
function extractResultData(rawText) {
  const text = cleanText(rawText);

  const student = extractStudentInfo(text);
  const subjects = extractSubjects(text);
  const creditsEarned = calculateCredits(subjects);

  return {
    ...student,
    creditsEarned,
    subjects
  };
}

module.exports = {
  extractResultData
};

const cleanText = require("../utils/cleanText");

const text = cleanText(rawText);