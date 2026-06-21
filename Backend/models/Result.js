const mongoose = require("mongoose");

/* =========================
   SUBJECT SCHEMA
========================= */
const subjectSchema = new mongoose.Schema({
  subjectCode: { type: String, required: true },
  subjectName: { type: String, required: true },

  type: {
    type: String,
    enum: ["THEORY", "PRACTICAL"],
    required: true
  },

  ese: { type: Number, default: 0 },
  ia: { type: Number, default: 0 },
  total: { type: Number, default: 0 },

  grade: { type: String, default: "" },
  credit: { type: Number, default: 0 }
});

/* =========================
   RESULT SCHEMA
========================= */
const resultSchema = new mongoose.Schema({
  regNo: { type: String, required: true },
  studentName: { type: String, required: true },
  semester: { type: String },

  sgpa: { type: Number, default: 0 },
  cgpa: { type: Number, default: 0 },
  creditsEarned: { type: Number, default: 0 },

  resultStatus: { type: String, default: "PASS" },

  subjects: [subjectSchema],

  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Result", resultSchema);
