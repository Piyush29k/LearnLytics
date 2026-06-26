const pdfParse = require("pdf-parse");
const Tesseract = require("tesseract.js");
const Result = require("../models/Result");
const User = require("../models/userModel");

/* =========================
   CLEAN TEXT
========================= */
function cleanText(text) {
  return String(text || "")
    .replace(/\r/g, "")
    .replace(/\u00a0/g, " ")
    .replace(/\t/g, " ")
    .replace(/[ ]{2,}/g, " ")
    .replace(/\n+/g, "\n")
    .trim();
}

/* =========================
   OCR FUNCTION
========================= */
async function runOCR(buffer) {
  const result = await Tesseract.recognize(buffer, "eng");
  return result.data.text;
}

/* =========================
   EXTRACT SUBJECTS
========================= */
function extractSubjects(text) {
  const subjects = [];
  const lines = cleanText(text)
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ")
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);

  let sectionType = null;
  let pendingRow = "";
  let pendingType = null;

  const flushPendingRow = () => {
    if (!pendingRow) return;

    const subject = parseSubjectRow(pendingRow, pendingType);
    if (subject) {
      subjects.push(subject);
    }

    pendingRow = "";
    pendingType = null;
  };

  lines.forEach((line) => {
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
  });

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
    (!sectionType && /LAB|PRACTICAL|INTERNSHIP/i.test(match[1]))
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
      `\\bSemester\\s*:\\s*${semesterValuePattern}(?:st|nd|rd|th)?\\b`,
      "i"
    ),
    new RegExp(
      `\\bB\\.?Tech\\s*${semesterValuePattern}(?:st|nd|rd|th)?\\s*Semester\\b`,
      "i"
    ),
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

function calculateCredits(subjects) {
  return subjects.reduce((sum, subject) => {
    const credit = Number(subject.credit);
    return sum + (Number.isFinite(credit) ? credit : 0);
  }, 0);
}

function roundGpa(value) {
  return Math.round(value * 100) / 100;
}

function normalizeIdentifier(value) {
  return String(value || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

function normalizeName(value) {
  return String(value || "")
    .toUpperCase()
    .replace(/[^A-Z]/g, "");
}

function cleanupExtractedValue(value) {
  return String(value || "")
    .split(/\n/)[0]
    .replace(/\s+(Father|Mother|College|Course|Registration|Reg\.?|Roll|Semester)\b.*$/i, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function extractFirstMatch(text, patterns) {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) {
      return cleanupExtractedValue(match[1]);
    }
  }

  return "";
}

function extractStudentInfo(text) {
  const regNo =
    extractFirstMatch(text, [
      /\bRegistration\s*(?:No\.?|Number)?\s*[:\-]?\s*([A-Z0-9/-]{6,})/i,
      /\bReg\.?\s*(?:No\.?|Number)?\s*[:\-]?\s*([A-Z0-9/-]{6,})/i,
    ]) ||
    text.match(/\b\d{8,15}\b/)?.[0] ||
    "";

  const rollNo = extractFirstMatch(text, [
    /\bRoll\s*(?:No\.?|Number)?\s*[:\-]?\s*([A-Z0-9/-]{3,})/i,
    /\bRoll\s*[:\-]?\s*([A-Z0-9/-]{3,})/i,
  ]);

  const studentName =
    extractFirstMatch(text, [
      /\bStudent\s*Name\s*[:\-]?\s*([^\n]+)/i,
      /\bName\s*of\s*Student\s*[:\-]?\s*([^\n]+)/i,
    ]) || "";

  return {
    regNo: regNo || "UNKNOWN",
    rollNo,
    studentName: studentName || "Unknown",
  };
}

function namesMatch(profileName, extractedName) {
  const profile = normalizeName(profileName);
  const extracted = normalizeName(extractedName);

  if (!profile || !extracted) return false;
  return (
    profile === extracted ||
    (profile.length >= 5 && extracted.includes(profile)) ||
    (extracted.length >= 5 && profile.includes(extracted))
  );
}

function identifiersMatch(profileValue, extractedValue) {
  const profile = normalizeIdentifier(profileValue);
  const extracted = normalizeIdentifier(extractedValue);

  return Boolean(profile && extracted && profile === extracted);
}

function getOwnershipErrors(user, extractedInfo) {
  const errors = [];

  if (!user.regno) {
    errors.push("Logged-in user profile does not have a registration number.");
  }

  if (!extractedInfo.regNo || extractedInfo.regNo === "UNKNOWN") {
    errors.push("Unable to read registration number from uploaded result.");
  } else if (!identifiersMatch(user.regno, extractedInfo.regNo)) {
    errors.push("Registration number mismatch.");
  }

  if (!extractedInfo.studentName || extractedInfo.studentName === "Unknown") {
    errors.push("Unable to read student name from uploaded result.");
  } else if (!namesMatch(user.name, extractedInfo.studentName)) {
    errors.push("Student name mismatch.");
  }

  if (
    extractedInfo.rollNo &&
    user.rollNo &&
    !identifiersMatch(user.rollNo, extractedInfo.rollNo)
  ) {
    errors.push("Roll number mismatch.");
  }

  return errors;
}

async function getAuthenticatedUser(req) {
  if (!req.user?.id) return null;
  return User.findById(req.user.id);
}

async function assignLegacyResultsToUser(user) {
  if (!user?.regno) return;

  await Result.updateMany(
    {
      $or: [{ user: { $exists: false } }, { user: null }],
      regNo: user.regno,
    },
    {
      $set: {
        user: user._id,
      },
    }
  );
}

async function recalculateCgpaForStudent(userId) {
  const results = await Result.find({ user: userId }).sort({
    semester: 1,
    createdAt: 1,
  });

  let totalCredits = 0;
  let weightedPoints = 0;

  for (const result of results) {
    const credits = Number(result.creditsEarned) || calculateCredits(result.subjects || []);
    const sgpa = Number(result.sgpa);

    result.creditsEarned = credits;

    if (Number.isFinite(credits) && credits > 0 && Number.isFinite(sgpa)) {
      totalCredits += credits;
      weightedPoints += sgpa * credits;
      result.cgpa = roundGpa(weightedPoints / totalCredits);
    }

    await result.save();
  }

  return results;
}

/* =========================
   UPLOAD RESULT
========================= */
exports.uploadResult = async (req, res) => {
  try {
    console.log("===== UPLOAD START =====");

    const currentUser = await getAuthenticatedUser(req);

    if (!currentUser) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    if (currentUser.role !== "student") {
      return res.status(403).json({
        success: false,
        message: "Only student accounts can upload result PDFs",
      });
    }

    // Check file uploaded
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No PDF file uploaded",
      });
    }

    let text = "";

    /* =========================
       PDF PARSE
    ========================= */
    try {
      const pdfData = await pdfParse(req.file.buffer);
      text = pdfData.text || "";

      console.log("PDF Parsed Successfully");
    } catch (err) {
      return res.status(500).json({
        success: false,
        message: "PDF parsing failed",
        error: err.message,
      });
    }

    /* =========================
       OCR FALLBACK
    ========================= */
    if (!text || text.trim().length < 100) {
      console.log("OCR Triggered...");
      text = await runOCR(req.file.buffer);
    }

    text = cleanText(text);

    console.log("\n========== PDF TEXT ==========\n");
    console.log(text);
    console.log("\n==============================\n");

    /* =========================
       SUBJECT EXTRACTION
    ========================= */
    const subjects = extractSubjects(text);

    console.log("Subjects:", subjects);
    console.log("Subjects Found:", subjects.length);

    /* =========================
       STUDENT INFO
    ========================= */
    const extractedInfo = extractStudentInfo(text);
    const ownershipErrors = getOwnershipErrors(currentUser, extractedInfo);

    if (ownershipErrors.length) {
      return res.status(403).json({
        success: false,
        message:
          "This result does not belong to the currently logged-in user. Please upload your own result.",
        details: ownershipErrors,
      });
    }

    const regNo = extractedInfo.regNo;
    const rollNo = extractedInfo.rollNo || currentUser.rollNo || "";
    const studentName = extractedInfo.studentName;

    /* =========================
       SEMESTER EXTRACTION
    ========================= */
    const semester = extractSemester(
      text,
      req.file.originalname,
      req.body?.semesterHint
    );

    console.log("Filename:", req.file.originalname);
    console.log("Semester Extracted:", semester);
    console.log("Detected Semester:", semester);

    if (semester === "N/A") {
      return res.status(422).json({
        success: false,
        message: "Unable to detect semester from PDF",
      });
    }

    if (!subjects.length) {
      return res.status(422).json({
        success: false,
        message: "Unable to extract subjects from PDF",
      });
    }

    /* =========================
       SGPA / CGPA EXTRACTION
    ========================= */
    const { sgpa, cgpa: pdfCgpa } = extractGradePoints(text, semester);

    console.log("Semester:", semester);
    console.log("SGPA:", sgpa);
    console.log("PDF CGPA:", pdfCgpa);

    if (sgpa === null || pdfCgpa === null) {
      return res.status(422).json({
        success: false,
        message: "Unable to extract SGPA/CGPA from PDF",
      });
    }

    /* =========================
       RESULT STATUS
    ========================= */
    const resultStatus = text
      .toLowerCase()
      .includes("fail")
      ? "FAIL"
      : "PASS";
    const creditsEarned = calculateCredits(subjects);

    /* =========================
       SAVE / UPDATE DATABASE
    ========================= */
    await assignLegacyResultsToUser(currentUser);

    const existingResult = await Result.findOne({
      user: currentUser._id,
      semester,
    });

    const resultPayload = {
      user: currentUser._id,
      regNo,
      rollNo,
      studentName,
      semester,
      sgpa,
      cgpa: pdfCgpa,
      creditsEarned,
      resultStatus,
      subjects,
    };

    let savedResult;
    let message = "Result uploaded successfully";

    if (existingResult) {
      Object.assign(existingResult, resultPayload);
      savedResult = await existingResult.save();
      message = "Result updated successfully";
    } else {
      savedResult = await new Result(resultPayload).save();
    }

    const recalculatedResults = await recalculateCgpaForStudent(currentUser._id);
    const currentResult =
      recalculatedResults.find((result) => String(result.semester) === semester) ||
      savedResult;

    console.log("Result Saved Successfully");

    return res.status(200).json({
      success: true,
      message,
      data: currentResult,
    });

  } catch (error) {
    console.error(error);

    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "This semester result is already uploaded",
      });
    }

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/* =========================
   GET LATEST RESULT
========================= */
exports.getLatestResult = async (req, res) => {
  try {
    const currentUser = await getAuthenticatedUser(req);

    if (!currentUser) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    await assignLegacyResultsToUser(currentUser);

    const result = await Result.findOne({ user: currentUser._id }).sort({
      createdAt: -1,
    });

    return res.json({
      success: true,
      data: result,
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Error fetching latest result",
    });
  }
};

/* =========================
   GET ALL RESULTS
========================= */
exports.getAllResults = async (req, res) => {
  try {
    const currentUser = await getAuthenticatedUser(req);

    if (!currentUser) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    await assignLegacyResultsToUser(currentUser);

    const results = await Result.find({ user: currentUser._id }).sort({
      createdAt: -1,
    });

    return res.json({
      success: true,
      data: results,
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Error fetching results",
    });
  }
};

/* =========================
   GET SEMESTER RESULT
========================= */
exports.getSemesterResult = async (req, res) => {
  try {
    const { regNo, semester } = req.params;
    const currentUser = await getAuthenticatedUser(req);

    if (!currentUser) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    if (
      regNo &&
      currentUser.regno &&
      !identifiersMatch(currentUser.regno, regNo)
    ) {
      return res.status(403).json({
        success: false,
        message: "You can only access your own semester results",
      });
    }

    await assignLegacyResultsToUser(currentUser);

    const result = await Result.findOne({
      user: currentUser._id,
      semester,
    }).sort({
      createdAt: -1,
    });

    if (!result) {
      return res.json({
        success: false,
        message: "N/A",
      });
    }

    return res.json({
      success: true,
      data: result,
    });

  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

exports._private = {
  cleanText,
  extractSubjects,
  extractSemester,
  extractStudentInfo,
  getOwnershipErrors,
  extractGradePoints,
  splitMarks,
  normalizeSemester,
};
