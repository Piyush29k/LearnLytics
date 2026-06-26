function cleanText(text) {
  if (!text) return "";

  return text
    .replace(/\r/g, "")              // remove carriage returns
    .replace(/\t/g, " ")             // replace tabs with space
    .replace(/[ ]{2,}/g, " ")        // multiple spaces → single space
    .replace(/\n{2,}/g, "\n")        // multiple new lines → single
    .replace(/\f/g, "")              // remove form feed (PDF noise)
    .trim();
}

module.exports = cleanText;