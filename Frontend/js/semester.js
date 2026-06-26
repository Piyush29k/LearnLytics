const API_BASE_URL = "http://localhost:5000/api/results";

const state = {
  currentRegNo: null,
  results: [],
  selectedSemester: null,
  uploadSemesterHint: null,
};

/* =========================
   ELEMENTS
========================= */
const sidebar = document.querySelector(".sidebar");
const toggleSidebar = document.getElementById("toggleSidebar");
const menuItems = document.querySelectorAll(".menu-item");
const logoutBtn = document.getElementById("logoutBtn");
const searchInput = document.querySelector('#subjects input[type="text"]');
const uploadBtn = document.getElementById("uploadBtn");
const pdfFile = document.getElementById("pdfFile");
const dropZone = document.getElementById("dropZone");
const fileName = document.getElementById("fileName");

document.addEventListener("DOMContentLoaded", initSemesterPage);

window.addEventListener("load", () => {
  const loader = document.getElementById("loader");
  if (loader) {
    setTimeout(() => loader.classList.add("hide"), 800);
  }
});

async function initSemesterPage() {
  const session = window.LearnLyticsAuth?.requireSession("student");
  if (!session) {
    return;
  }

  state.currentRegNo = session.user.regno || null;
  window.LearnLyticsAuth.syncUserDisplay();

  if (window.lucide) {
    lucide.createIcons();
  }

  setupSidebar();
  setupLogout();
  setupSearch();
  setupUpload();
  setupDropZone();

  await loadLatestResult();
  await loadSemesters();
}

/* =========================
   SETUP
========================= */
function setupSidebar() {
  if (sidebar && window.matchMedia("(max-width: 640px)").matches) {
    sidebar.classList.add("collapsed");
  }

  if (toggleSidebar && sidebar) {
    toggleSidebar.addEventListener("click", () => {
      sidebar.classList.toggle("collapsed");
    });
  }

  menuItems.forEach((item) => {
    item.addEventListener("click", () => {
      menuItems.forEach((menu) => menu.classList.remove("active"));
      item.classList.add("active");
    });
  });
}

function setupLogout() {
  if (!logoutBtn) return;

  logoutBtn.addEventListener("click", () => {
    if (confirm("Logout from dashboard?")) {
      window.LearnLyticsAuth?.clearSession();
      window.location.href = "login.html";
    }
  });
}

function setupSearch() {
  if (searchInput) {
    searchInput.addEventListener("input", filterSubjects);
  }
}

function setupUpload() {
  if (uploadBtn) {
    uploadBtn.addEventListener("click", uploadResult);
  }
}

function setupDropZone() {
  if (!dropZone || !pdfFile || !fileName) return;

  dropZone.addEventListener("dragover", (event) => {
    event.preventDefault();
    dropZone.classList.add("dragover");
  });

  dropZone.addEventListener("dragleave", () => {
    dropZone.classList.remove("dragover");
  });

  dropZone.addEventListener("drop", (event) => {
    event.preventDefault();
    dropZone.classList.remove("dragover");

    const file = event.dataTransfer.files[0];
    if (!isPdfFile(file)) {
      alert("Please upload PDF files only.");
      return;
    }

    pdfFile.files = event.dataTransfer.files;
    fileName.textContent = file.name;
  });

  pdfFile.addEventListener("change", () => {
    const file = pdfFile.files[0];
    fileName.textContent = file ? file.name : "No file selected";
  });
}

/* =========================
   HELPERS
========================= */
function setText(id, value) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent =
    value === undefined || value === null || value === "" ? "--" : value;
}

function formatValue(value) {
  return value === undefined || value === null || value === "" ? "--" : value;
}

function formatGpa(value) {
  if (value === undefined || value === null || value === "" || value === "N/A") {
    return "N/A";
  }

  const number = Number(value);
  return Number.isFinite(number) ? number.toFixed(2) : String(value);
}

function escapeHtml(value) {
  return String(formatValue(value))
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function isPdfFile(file) {
  return Boolean(
    file &&
      (file.type === "application/pdf" ||
        file.name.toLowerCase().endsWith(".pdf"))
  );
}

function getSubjectCredits(subjects) {
  return subjects.reduce((sum, subject) => {
    const credit = Number(subject.credit);
    return sum + (Number.isFinite(credit) ? credit : 0);
  }, 0);
}

function getResultCredits(result) {
  const creditsEarned = Number(result?.creditsEarned);
  if (Number.isFinite(creditsEarned) && creditsEarned > 0) {
    return creditsEarned;
  }

  return getSubjectCredits(Array.isArray(result?.subjects) ? result.subjects : []);
}

function getCumulativeCgpa(result) {
  const regNo = result?.regNo || state.currentRegNo;
  const semester = Number(result?.semester);

  if (!regNo || !Number.isFinite(semester)) {
    return result?.cgpa;
  }

  const resultsBySemester = new Map();

  state.results
    .filter(
      (item) =>
        item.regNo === regNo &&
        Number.isFinite(Number(item.semester)) &&
        Number(item.semester) <= semester
    )
    .forEach((item) => {
      resultsBySemester.set(Number(item.semester), item);
    });

  resultsBySemester.set(semester, result);

  const completedResults = Array.from(resultsBySemester.values()).sort(
    (a, b) => Number(a.semester) - Number(b.semester)
  );

  let totalCredits = 0;
  let weightedPoints = 0;

  completedResults.forEach((item) => {
    const sgpa = Number(item.sgpa);
    const credits = getResultCredits(item);

    if (!Number.isFinite(sgpa) || !Number.isFinite(credits) || credits <= 0) {
      return;
    }

    totalCredits += credits;
    weightedPoints += sgpa * credits;
  });

  return totalCredits > 0 ? weightedPoints / totalCredits : result?.cgpa;
}

function normalizeSubjects(subjects) {
  const theoryNamesByCode = new Map();

  subjects.forEach((subject) => {
    const subjectCode = String(subject.subjectCode || "").trim().toUpperCase();
    const code = subjectCode.replace(/P$/i, "");
    const name = String(subject.subjectName || "").trim().toUpperCase();
    const type = String(subject.type || "").toUpperCase();

    if (!code || !name || /P$/i.test(subjectCode) || type !== "THEORY") {
      return;
    }

    theoryNamesByCode.set(code, String(subject.subjectName || "").trim());
  });

  return subjects.map((subject) => {
    const subjectCode = String(subject.subjectCode || "").trim().toUpperCase();
    const baseCode = subjectCode.replace(/P$/i, "");
    const rawType = String(subject.type || "").toUpperCase();
    let subjectName = repairLeadingPSubjectName(
      String(subject.subjectName || "").trim(),
      theoryNamesByCode.get(baseCode)
    );
    const type = getSubjectType(subjectCode, rawType, subjectName);

    return {
      ...subject,
      subjectCode,
      subjectName,
      type,
    };
  });
}

function repairLeadingPSubjectName(subjectName, theoryName) {
  if (!subjectName || !theoryName) {
    return subjectName;
  }

  const normalizedSubjectName = subjectName.toUpperCase();
  const normalizedTheoryName = theoryName.toUpperCase();

  if (
    normalizedTheoryName.startsWith("P") &&
    normalizedTheoryName.slice(1) === normalizedSubjectName
  ) {
    return theoryName;
  }

  return subjectName;
}

function getSubjectType(subjectCode, rawType, subjectName) {
  if (/P$/i.test(subjectCode)) {
    return "PRACTICAL";
  }

  if (rawType === "THEORY" || rawType === "PRACTICAL") {
    return rawType;
  }

  return /LAB|PRACTICAL|WORKSHOP|INTERNSHIP/i.test(subjectName)
    ? "PRACTICAL"
    : "THEORY";
}

function getSubjects() {
  return Array.from(document.querySelectorAll("#subjectTableBody tr")).filter(
    (row) => row.cells.length >= 8 && !row.classList.contains("empty-row")
  );
}

function getResultsForCurrentStudent() {
  if (!state.currentRegNo) return state.results;
  return state.results.filter((result) => result.regNo === state.currentRegNo);
}

function getLatestSemesterResult(semester) {
  return getResultsForCurrentStudent().find(
    (result) => Number(result.semester) === Number(semester)
  );
}

function setSelectedSemester(semester, useAsUploadHint = false) {
  state.selectedSemester = Number(semester);
  if (useAsUploadHint) {
    state.uploadSemesterHint = state.selectedSemester;
  }

  document.querySelectorAll(".semester-card").forEach((card) => {
    card.classList.toggle(
      "active",
      Number(card.dataset.semester) === state.selectedSemester
    );
  });
}

/* =========================
   API CALLS
========================= */
async function loadLatestResult() {
  try {
    const res = await window.LearnLyticsAuth.authFetch(`${API_BASE_URL}/latest`);
    if (!res.ok) return;

    const data = await res.json();
    if (data.success && data.data) {
      updateDashboard(data.data);
      state.currentRegNo = data.data.regNo;
    }
  } catch (err) {
    console.log("Latest load error:", err.message);
  }
}

async function loadSemesters() {
  try {
    const res = await window.LearnLyticsAuth.authFetch(API_BASE_URL);
    if (!res.ok) return;

    const response = await res.json();
    if (!response.success || !Array.isArray(response.data)) return;

    state.results = response.data;
    renderSemesterCards();
  } catch (err) {
    console.error("Semester card error:", err.message);
  }
}

async function uploadResult() {
  const file = pdfFile?.files?.[0];

  if (!isPdfFile(file)) {
    alert("Please select a PDF");
    return;
  }

  const formData = new FormData();
  formData.append("pdf", file);
  if (state.uploadSemesterHint) {
    formData.append("semesterHint", String(state.uploadSemesterHint));
  }

  uploadBtn.disabled = true;
  uploadBtn.textContent = "Uploading...";

  try {
    const res = await window.LearnLyticsAuth.authFetch(`${API_BASE_URL}/upload`, {
      method: "POST",
      body: formData,
    });

    const data = await res.json();

    if (!res.ok || !data.success) {
      alert(data.message || "Upload failed");
      return;
    }

    updateDashboard(data.data);
    state.currentRegNo = data.data.regNo;
    await loadSemesters();
    setSelectedSemester(data.data.semester);

    if (pdfFile) pdfFile.value = "";
    if (fileName) fileName.textContent = "No file selected";

    alert(`Semester ${data.data.semester} result uploaded successfully`);
  } catch (err) {
    console.error(err);
    alert("Upload failed");
  } finally {
    uploadBtn.disabled = false;
    uploadBtn.textContent = "Upload Result";
  }
}

async function openSemester(semester) {
  setSelectedSemester(semester, true);
  clearSemesterView(semester, "Loading semester result...");

  try {
    const regNo = state.currentRegNo || getLatestSemesterResult(semester)?.regNo;
    const endpoint = regNo
      ? `${API_BASE_URL}/semester/${encodeURIComponent(regNo)}/${semester}`
      : `${API_BASE_URL}/semester/${semester}`;

    const res = await window.LearnLyticsAuth.authFetch(endpoint);
    const data = await res.json();

    if (!res.ok || !data.success || !data.data) {
      clearSemesterView(semester, "Result Not Uploaded (N/A)");
      return;
    }

    updateDashboard(data.data);
  } catch (err) {
    console.error("Semester error:", err.message);
    clearSemesterView(semester, "Unable to load semester result");
  }
}

/* =========================
   DASHBOARD
========================= */
function updateDashboard(result) {
  if (!result) return;

  state.currentRegNo = result.regNo || state.currentRegNo;
  const subjects = normalizeSubjects(
    Array.isArray(result.subjects) ? result.subjects : []
  );
  const cumulativeCgpa = getCumulativeCgpa({
    ...result,
    subjects,
  });

  setText("studentName", result.studentName);
  setText("regNo", result.regNo);
  setText("semester", result.semester);
  setText("sgpaOverview", formatGpa(result.sgpa));
  setText("cgpaOverview", formatGpa(cumulativeCgpa));
  setText("sgpaInfo", formatGpa(result.sgpa));
  setText("cgpaInfo", formatGpa(cumulativeCgpa));

  renderSubjects(subjects);
  calculatePerformance(subjects);
  calculateCredits(subjects);
  updateResultStatus(result.resultStatus, subjects);
  setSelectedSemester(result.semester);
  filterSubjects();
}

function clearSemesterView(semester, message) {
  setText("semester", semester);
  setText("sgpaOverview", "N/A");
  setText("cgpaOverview", "N/A");
  setText("sgpaInfo", "N/A");
  setText("cgpaInfo", "N/A");
  setText("credits", "N/A");
  setText("highestSubject", "N/A");
  setText("lowestSubject", "N/A");
  updateResultStatus("N/A", []);
  renderSubjects([], message);
}

function renderSemesterCards() {
  const container = document.querySelector(".semester-container");
  if (!container) return;

  container.innerHTML = "";

  for (let sem = 1; sem <= 8; sem++) {
    const found = getLatestSemesterResult(sem);
    const card = document.createElement("button");
    card.type = "button";
    card.className = `semester-card ${found ? "uploaded" : "missing"}`;
    card.dataset.semester = String(sem);

    card.innerHTML = `
      <h3>Semester ${sem}</h3>
      <p>${found ? `SGPA: ${formatGpa(found.sgpa)}` : "N/A"}</p>
    `;

    card.addEventListener("click", () => openSemester(sem));
    container.appendChild(card);
  }

  if (state.selectedSemester) {
    setSelectedSemester(state.selectedSemester);
  }
}

/* =========================
   SUBJECTS
========================= */
function renderSubjects(subjects, emptyMessage = "No subjects found") {
  const tableBody = document.getElementById("subjectTableBody");
  if (!tableBody) return;

  tableBody.innerHTML = "";

  if (!subjects.length) {
    tableBody.innerHTML = `
      <tr class="empty-row">
        <td colspan="8">${escapeHtml(emptyMessage)}</td>
      </tr>
    `;
    return;
  }

  const groupedSubjects = [
    {
      label: "Theory Subjects",
      subjects: subjects.filter((subject) => subject.type === "THEORY"),
    },
    {
      label: "Practical Subjects",
      subjects: subjects.filter((subject) => subject.type === "PRACTICAL"),
    },
  ].filter((group) => group.subjects.length);

  tableBody.innerHTML = groupedSubjects
    .map(
      (group) => `
      <tr class="subject-group-row">
        <td colspan="8">${group.label}</td>
      </tr>
      ${group.subjects.map(renderSubjectRow).join("")}
    `
    )
    .join("");
}

function renderSubjectRow(subject) {
  return `
      <tr>
        <td>${escapeHtml(subject.subjectCode)}</td>
        <td>${escapeHtml(subject.subjectName)}</td>
        <td>${formatValue(subject.ese)}</td>
        <td>${formatValue(subject.ia)}</td>
        <td>${formatValue(subject.total)}</td>
        <td>${formatValue(subject.credit)}</td>
        <td>${escapeHtml(subject.grade)}</td>
        <td>
          <span class="badge ${String(subject.type).toLowerCase()}">
            ${escapeHtml(subject.type)}
          </span>
        </td>
      </tr>
    `;
}

function filterSubjects() {
  const value = searchInput?.value?.toLowerCase() || "";

  getSubjects().forEach((row) => {
    row.style.display = row.textContent.toLowerCase().includes(value)
      ? ""
      : "none";
  });
}

/* =========================
   METRICS
========================= */
function calculatePerformance(subjects) {
  if (!subjects.length) {
    setText("highestSubject", "N/A");
    setText("lowestSubject", "N/A");
    return;
  }

  let highest = -Infinity;
  let lowest = Infinity;
  let highSub = "N/A";
  let lowSub = "N/A";

  subjects.forEach((subject) => {
    const total = Number(subject.total);
    if (Number.isNaN(total)) return;

    if (total > highest) {
      highest = total;
      highSub = `${subject.subjectName} (${total})`;
    }

    if (total < lowest) {
      lowest = total;
      lowSub = `${subject.subjectName} (${total})`;
    }
  });

  setText("highestSubject", highSub);
  setText("lowestSubject", lowSub);
}

function calculateCredits(subjects) {
  setText("credits", getSubjectCredits(subjects));
}

function updateResultStatus(status, subjects = []) {
  const el = document.getElementById("resultStatus");
  if (!el) return;

  if (!status || status === "N/A") {
    el.textContent = "N/A";
    return;
  }

  const finalStatus = subjects.some((subject) => subject.grade === "F")
    ? "FAIL"
    : status;

  el.innerHTML = `<span class="badge ${finalStatus.toLowerCase()}">${finalStatus}</span>`;
}
