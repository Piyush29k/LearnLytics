const Tesseract = require("tesseract.js");

/* =========================
   OCR SERVICE (SCANNED PDF → TEXT)
========================= */

async function extractTextFromImage(buffer) {
  try {
    if (!buffer) {
      throw new Error("No file buffer provided for OCR");
    }

    console.log("⚡ OCR started... processing image");

    const result = await Tesseract.recognize(
      buffer,
      "eng",
      {
        logger: (m) => {
          // optional progress logs
          if (m.status === "recognizing text") {
            console.log(`OCR Progress: ${Math.round(m.progress * 100)}%`);
          }
        }
      }
    );

    const text = result?.data?.text || "";

    console.log("✅ OCR completed");

    return {
      success: true,
      text
    };

  } catch (error) {
    console.error("❌ OCR Error:", error.message);

    return {
      success: false,
      text: "",
      error: error.message
    };
  }
}

module.exports = {
  extractTextFromImage
};
