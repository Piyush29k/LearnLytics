const pdfParse = require("pdf-parse");

/* =========================
   PDF TEXT EXTRACTION SERVICE
========================= */

async function extractTextFromPDF(buffer) {
  try {
    if (!buffer) {
      throw new Error("No PDF buffer provided");
    }

    const data = await pdfParse(buffer);
    
      console.log("========== PDF TEXT ==========");
        console.log(data.text);
      console.log("========== END PDF TEXT =======");

    return {
      success: true,
      text: data.text || "",
      info: data.info || {},
      numPages: data.numpages || 0
    };

  } catch (error) {
    console.error("PDF Parse Error:", error.message);

    return {
      success: false,
      text: "",
      error: error.message
    };
  }
}

module.exports = {
  extractTextFromPDF
};
