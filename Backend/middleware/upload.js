const multer = require("multer");

/* =========================
   MEMORY STORAGE (BEST FOR PDF PROCESSING)
========================= */
const storage = multer.memoryStorage();

/* =========================
   FILE FILTER (ONLY PDF)
========================= */
function fileFilter(req, file, cb) {
  if (file.mimetype === "application/pdf") {
    cb(null, true);
  } else {
    cb(new Error("Only PDF files are allowed!"), false);
  }
}

/* =========================
   MULTER CONFIG
========================= */
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
});

module.exports = upload;
