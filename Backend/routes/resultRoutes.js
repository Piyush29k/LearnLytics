const express = require("express");
const router = express.Router();

const upload = require("../middleware/upload");
const { requireAuth } = require("../middleware/auth");

const {
  uploadResult,
  getLatestResult,
  getAllResults,
  getSemesterResult,
} = require("../controllers/resultController");

/* =========================
   ROUTES
========================= */
router.use(requireAuth);

router.post("/upload", upload.single("pdf"), uploadResult);
router.get("/latest", getLatestResult);
router.get("/semester/:regNo/:semester", getSemesterResult);
router.get("/semester/:semester", getSemesterResult);
router.get("/", getAllResults);

module.exports = router;
