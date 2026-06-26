function cleanText(text) {
  return String(text || "")
    .replace(/\r/g, "")
    .replace(/\u00a0/g, " ")
    .replace(/\t/g, " ")
    .replace(/[ ]{2,}/g, " ")
    .replace(/\n+/g, "\n")
    .trim();
}

function splitMarks(value) {
  const raw = String(value || "").replace(/\D/g, "");
  const candidates = [];

  for (const eseLength of [2, 3]) {
    for (const iaLength of [2, 3]) {
      const totalLength = raw.length - eseLength - iaLength;
      if (![2, 3].includes(totalLength)) continue;

      const ese = Number(raw.slice(0, eseLength));
      const ia = Number(raw.slice(eseLength, eseLength + iaLength));
      const total = Number(raw.slice(eseLength + iaLength));

      if ([ese, ia, total].some((mark) => Number.isNaN(mark))) continue;
      if (ese > 100 || ia > 100 || total > 100) continue;

      const difference = Math.abs(total - (ese + ia));
      let score = difference === 0 ? 100 : difference <= 2 ? 50 : 0;
      if (!score) continue;
      if (ia <= 50) score += 10;
      if (eseLength === 2) score += 2;
      if (iaLength === 2) score += 2;

      candidates.push({ ese, ia, total, score });
    }
  }

  candidates.sort((a, b) => b.score - a.score);

  if (candidates.length) {
    const { ese, ia, total } = candidates[0];
    return { ese, ia, total };
  }

  if (raw.length >= 6) {
    return {
      ese: Number(raw.slice(0, 2)),
      ia: Number(raw.slice(2, 4)),
      total: Number(raw.slice(4)),
    };
  }

  return null;
}

function extractSubjects(text) {
  const subjects = [];
  let sectionType = null;
  let pendingRow = "";
  let pendingType = null;

  const lines = cleanText(text)
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ")
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);

  function flushPendingRow() {
    if (!pendingRow) return;

    const subject = parseSubjectRow(pendingRow, pendingType);
    if (subject) {
      subjects.push(subject);
    }

    pendingRow = "";
    pendingType = null;
  }

  function processSubjectLine(line) {
    if (/^THEORY$/i.test(line)) {
      flushPendingRow();
      sectionType = "THEORY";
      return;
    }

    if (/^PRACTICAL$/i.test(line)) {
      flushPendingRow();
      sectionType = "PRACTICAL";
      return;
    }

    if (isSubjectStopLine(line)) {
      flushPendingRow();
      sectionType = null;
      return;
    }

    if (isIgnoredSubjectLine(line)) {
      return;
    }

    if (isSubjectRowStart(line)) {
      flushPendingRow();
      pendingRow = line;
      pendingType = sectionType || (/^\d{6}P/i.test(line) ? "PRACTICAL" : "THEORY");
    } else if (pendingRow) {
      pendingRow += ` ${line}`;
    } else {
      return;
    }

    const subject = parseSubjectRow(pendingRow, pendingType);
    if (subject) {
      subjects.push(subject);
      pendingRow = "";
      pendingType = null;
    }
  }

  lines.forEach(processSubjectLine);
  flushPendingRow();

  return subjects;
}

function parseSubjectRow(row, sectionType) {
  const normalizedRow = String(row || "").replace(/\s+/g, " ").trim();
  const codeMatch = normalizedRow.match(/^(\d{6})(P?)(.*)$/i);

  if (!codeMatch) return null;

  const baseCode = codeMatch[1].toUpperCase();
  const codeSuffix = codeMatch[2].toUpperCase();
  let subjectCode = baseCode;
  let subjectText = codeMatch[3].trim();

  if (codeSuffix) {
    if (sectionType === "PRACTICAL") {
      subjectCode = `${baseCode}P`;
    } else {
      subjectText = `${codeSuffix}${subjectText}`.trim();
    }
  }

  const match = subjectText.match(
    /^([A-Za-z][A-Za-z0-9&()\-+.,/ ]*?)\s*(\d[\d^*]{3,12})\s*(A\+|A|B|C|D|P|F)\s*(\d+(?:\.\d+)?)$/i
  );

  if (!match) return null;

  const marks = splitMarks(match[2]);
  if (!marks) return null;

  const type =
    subjectCode.endsWith("P") ||
    sectionType === "PRACTICAL" ||
    /LAB|PRACTICAL|WORKSHOP/i.test(match[1])
      ? "PRACTICAL"
      : "THEORY";

  const subjectName = match[1].trim().replace(/\s+/g, " ");

  return {
    subjectCode,
    subjectName,
    type,
    ese: marks.ese,
    ia: marks.ia,
    total: marks.total,
    grade: match[3].toUpperCase(),
    credit: Number(match[4]),
  };
}

function isSubjectStopLine(line) {
  return /^(SGPA\s*\/\s*CGPA|Remarks\b|Note:|ESE:|IA:|SGPA:|CGPA:|AB:|NA:|N\/A:|\*:|CA:|UMC:|WEB COPY:|University\b)/i.test(
    line
  );
}

function isSubjectRowStart(line) {
  const match = String(line || "").match(
    /^(\d{6}P?)\s*([A-Za-z][A-Za-z0-9&()\-+.,/ ]*)/i
  );

  if (!match) return false;

  return !/^(A\+|A|B|C|D|P|F)\d+(?:\.\d+)?$/i.test(match[2].trim());
}

function isIgnoredSubjectLine(line) {
  return /^(Subject\b|CodeSubject\b|Subject\s*Code\b|BIHAR ENGINEERING UNIVERSITY\b|PATNA\b|WEB COPY\b|B\.?Tech\b|Semester\b|Examination\b|Registration\b|No:\b|Student Name:|Father's Name:|Mother's Name:|College Name:|Course Name:|https?:|\d{1,2}\/\d{1,2}\/\d{2,4})/i.test(
    line
  );
}

function normalizeSemester(value) {
  const cleaned = String(value || "")
    .trim()
    .replace(/(?:st|nd|rd|th)$/i, "")
    .toUpperCase();

  const semesterMap = {
    I: "1",
    II: "2",
    III: "3",
    IV: "4",
    V: "5",
    VI: "6",
    VII: "7",
    VIII: "8",
  };

  const semester = semesterMap[cleaned] || cleaned;
  return /^[1-8]$/.test(semester) ? semester : "N/A";
}

function extractSemester(...sources) {
  const text = cleanText(sources.filter(Boolean).join("\n")).replace(
    /[_.]+/g,
    " "
  );
  const semesterValuePattern = "(VIII|VII|VI|IV|III|II|I|V|[1-8])";

  const patterns = [
    new RegExp(
      `\\b(?:Semester|Sem)\\s*(?:No\\.?|Number)?\\s*[:\\-]?\\s*${semesterValuePattern}(?:st|nd|rd|th)?\\b`,
      "i"
    ),
    new RegExp(
      `\\b${semesterValuePattern}(?:st|nd|rd|th)?\\s*(?:Semester|Sem)\\b`,
      "i"
    ),
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    const semester = normalizeSemester(match?.[1]);

    if (semester !== "N/A") {
      return semester;
    }
  }

  return "N/A";
}

function extractGradePoints(text, semester) {
  const sectionMatch = text.match(
    /\bSGPA\s*\/\s*CGPA\b[\s\S]{0,400}?(?:\bRemarks\b|\bPASS\b|\bFAIL\b|$)/i
  );
  const section = sectionMatch ? sectionMatch[0] : text;
  const sgpaLine =
    section
      .split(/\n+/)
      .map((line) => line.trim())
      .find((line) => /^SGPA/i.test(line) && /\d/.test(line)) || section;

  const values = extractGpaValues(sgpaLine);
  const semesterIndex = Number(semester) - 1;

  if (
    Number.isInteger(semesterIndex) &&
    semesterIndex >= 0 &&
    values.length > semesterIndex
  ) {
    return {
      sgpa: values[semesterIndex],
      cgpa: values[values.length - 1],
    };
  }

  if (values.length >= 2) {
    return {
      sgpa: values[values.length - 2],
      cgpa: values[values.length - 1],
    };
  }

  if (values.length === 1) {
    return {
      sgpa: values[0],
      cgpa: values[0],
    };
  }

  return { sgpa: null, cgpa: null };
}

function extractGpaValues(value) {
  const compactValues = String(value || "").match(
    /10(?:\.0{1,2})?|[0-9]\.\d{1,2}/g
  );

  if (compactValues?.length) {
    return compactValues.map(Number).filter((number) => number >= 0 && number <= 10);
  }

  return (String(value || "").match(/\b\d+(?:\.\d+)?\b/g) || [])
    .map(Number)
    .filter((number) => number >= 0 && number <= 10);
}

function extractStudentInfo(text) {
  const regNo =
    text.match(/Registration No:\s*(\d+)/i)?.[1] ||
    text.match(/\d{10,}/)?.[0] ||
    "UNKNOWN";

  const studentName =
    text.match(/Student Name:\s*(.+)/i)?.[1]?.trim() ||
    text.match(/Name\s*[:\-]?\s*(.+)/i)?.[1]?.split("\n")[0].trim() ||
    "Unknown";

  const semester = extractSemester(text);
  const { sgpa, cgpa } = extractGradePoints(text, semester);

  return {
    regNo,
    studentName,
    semester,
    sgpa,
    cgpa,
    resultStatus: text.toLowerCase().includes("fail") ? "FAIL" : "PASS",
  };
}

function calculateCredits(subjects) {
  return subjects.reduce((sum, subject) => sum + (subject.credit || 0), 0);
}

function extractResultData(rawText) {
  const text = cleanText(rawText);
  const student = extractStudentInfo(text);
  const subjects = extractSubjects(text);

  return {
    ...student,
    creditsEarned: calculateCredits(subjects),
    subjects,
  };
}

module.exports = {
  cleanText,
  extractResultData,
  extractSubjects,
  extractSemester,
  extractGradePoints,
  splitMarks,
  normalizeSemester,
};
