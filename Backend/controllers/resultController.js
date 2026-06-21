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
   SUBJECT EXTRACTION
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
        type: "THEORY",
      });
    }
  });

  return subjects;
}

/* =========================
   UPLOAD RESULT
========================= */
exports.uploadResult = async (req, res) => {
  try {
    console.log("===== UPLOAD START =====");

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No PDF file uploaded",
      });
    }

    console.log("File Name:", req.file.originalname);
    console.log("Buffer Exists:", !!req.file.buffer);
    console.log("Body:", req.body);

    let text = "";

    /* PDF PARSE */
    try {
      const pdfData = await pdfParse(req.file.buffer);
      text = pdfData.text || "";
      console.log("PDF Parsed Successfully");
    } catch (err) {
      console.error("PDF Parse Error:", err.message);
      return res.status(500).json({
        success: false,
        message: "PDF parsing failed",
        error: err.message,
      });
    }

    console.log("Text Length:", text.length);

    /* OCR FALLBACK */
    if (!text || text.trim().length < 100) {
      console.log("OCR Triggered...");
      text = await runOCR(req.file.buffer);
    }

    text = cleanText(text);

    const subjects = extractSubjects(text);

    console.log("Subjects Found:", subjects.length);

    const regNo = text.match(/\d{10,}/)?.[0] || "UNKNOWN";

    const studentNameMatch = text.match(/Name\s*[:\-]?\s*(.+)/i);
    const studentName = studentNameMatch
      ? studentNameMatch[1].split("\n")[0].trim()
      : "Unknown";

const sgpaMatch = text.match(/SGPA\s*[:\-]?\s*([0-9.]+)/i);
const cgpaMatch = text.match(/CGPA\s*[:\-]?\s*([0-9.]+)/i);

const sgpaValue = sgpaMatch ? parseFloat(sgpaMatch[1]) : 0;
const cgpaValue = cgpaMatch ? parseFloat(cgpaMatch[1]) : 0;

const sgpa = isNaN(sgpaValue) ? 0 : sgpaValue;
const cgpa = isNaN(cgpaValue) ? 0 : cgpaValue;

console.log("SGPA:", sgpa);
console.log("CGPA:", cgpa);

    const resultStatus = text.toLowerCase().includes("fail")
      ? "FAIL"
      : "PASS";

    const semester = req.body.semester || "N/A";

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

    console.log("Saving Result...");
    await newResult.save();

    console.log("Result Saved Successfully");

    return res.status(200).json({
      success: true,
      message: "Result uploaded successfully",
      data: newResult,
    });

  } catch (error) {
    console.error("===== UPLOAD ERROR =====");
    console.error(error);
    console.error(error.stack);

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
