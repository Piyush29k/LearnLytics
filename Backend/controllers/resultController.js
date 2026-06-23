const pdfParse = require("pdf-parse");
const Tesseract = require("tesseract.js");
const Result = require("../models/Result");

/* =========================
   CLEAN TEXT
========================= */
function cleanText(text) {
  return text
    .replace(/\r/g, "")
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

  // BEU Result Regex
  const regex =
    /(\d{6}P?)([A-Za-z0-9&()\-+.\s]+?)(\d{2})(\d{2})(\d{2})(A\+|A|B|C|D|P|F)(\d+\.\d{2})/g;

  let match;

  while ((match = regex.exec(text)) !== null) {
    subjects.push({
      subjectCode: match[1],
      subjectName: match[2].trim(),
      type: match[1].includes("P") ? "PRACTICAL" : "THEORY",
      ese: Number(match[3]),
      ia: Number(match[4]),
      total: Number(match[5]),
      grade: match[6],
      credit: Number(match[7]),
    });
  }

  return subjects;
}

/* =========================
   UPLOAD RESULT
========================= */
exports.uploadResult = async (req, res) => {
  try {
    console.log("===== UPLOAD START =====");

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
    const regNo =
      text.match(/Registration No:\s*(\d+)/i)?.[1] ||
      text.match(/\d{10,}/)?.[0] ||
      "UNKNOWN";

    const studentName =
      text.match(/Student Name:\s*(.+)/i)?.[1]?.trim() ||
      "Unknown";

    const semester = req.body.semester || "N/A";

    /* =========================
       SGPA / CGPA
    ========================= */
    let sgpa = 0;
    let cgpa = 0;

    const decimalValues = text.match(/\d+\.\d+/g) || [];

    console.log("Decimal Values:", decimalValues);

    const semIndex = Number(semester) - 1;

    if (semIndex >= 0 && semIndex < decimalValues.length) {
      sgpa = Number(decimalValues[semIndex]);
    }

    if (decimalValues.length > 0) {
      cgpa = Number(decimalValues[decimalValues.length - 1]);
    }

    console.log("Semester:", semester);
    console.log("SGPA:", sgpa);
    console.log("CGPA:", cgpa);

    /* =========================
       RESULT STATUS
    ========================= */
    const resultStatus = text
      .toLowerCase()
      .includes("fail")
      ? "FAIL"
      : "PASS";

    /* =========================
       SAVE TO DATABASE
    ========================= */
    const newResult = new Result({
      regNo,
      studentName,
      semester,
      sgpa,
      cgpa,
      creditsEarned: subjects.reduce(
        (sum, s) => sum + (s.credit || 0),
        0
      ),
      resultStatus,
      subjects,
    });

    await newResult.save();

    console.log("Result Saved Successfully");

    return res.status(200).json({
      success: true,
      message: "Result uploaded successfully",
      data: newResult,
    });

  } catch (error) {
    console.error(error);

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
    const result = await Result.findOne().sort({
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
    const results = await Result.find().sort({
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

    const result = await Result.findOne({
      regNo,
      semester,
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
