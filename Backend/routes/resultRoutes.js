const express = require("express");
const router = express.Router();

const upload = require("../middleware/upload");

const {
  uploadResult,
  getLatestResult,
  getAllResults
} = require("../controllers/resultController");

/* =========================
   ROUTES
========================= */

// Upload PDF result
router.post("/upload", upload.single("pdf"), uploadResult);

// Get latest result
router.get("/latest", getLatestResult);

// Get all results
router.get("/", getAllResults);

module.exports = router;