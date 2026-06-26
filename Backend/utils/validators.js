function isValidString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function isValidNumber(value) {
  return typeof value === "number" && !isNaN(value);
}

function isValidRegNo(regNo) {
  // BEU-like registration number check (adjust if needed)
  return typeof regNo === "string" && /^\d{8,15}$/.test(regNo);
}

function isValidSGPA(value) {
  return isValidNumber(value) && value >= 0 && value <= 10;
}

function isValidCGPA(value) {
  return isValidNumber(value) && value >= 0 && value <= 10;
}

function isValidSubject(subject) {
  if (!subject || typeof subject !== "object") return false;

  return (
    isValidString(subject.subjectCode) &&
    isValidString(subject.subjectName) &&
    isValidNumber(subject.total) &&
    isValidString(subject.grade)
  );
}

function validateSubjects(subjects) {
  if (!Array.isArray(subjects)) return [];

  return subjects.filter(isValidSubject);
}

/* =========================
   FINAL RESULT VALIDATION
========================= */
function validateResult(data) {
  if (!data || typeof data !== "object") {
    return { valid: false, message: "Invalid data object" };
  }

  if (!isValidRegNo(data.regNo)) {
    return { valid: false, message: "Invalid registration number" };
  }

  if (!isValidString(data.studentName)) {
    return { valid: false, message: "Invalid student name" };
  }

  if (!Array.isArray(data.subjects)) {
    return { valid: false, message: "Subjects must be an array" };
  }

  return { valid: true };
}

module.exports = {
  isValidString,
  isValidNumber,
  isValidRegNo,
  isValidSGPA,
  isValidCGPA,
  isValidSubject,
  validateSubjects,
  validateResult
};