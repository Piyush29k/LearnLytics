const API_BASE_URL = "http://localhost:5000/api/results";

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

/* =========================
   SIDEBAR
========================= */
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

/* =========================
   LOGOUT
========================= */
if (logoutBtn) {
  logoutBtn.addEventListener("click", () => {
    if (confirm("Logout from dashboard?")) {
      window.location.href = "../login.html";
    }
  });
}

/* =========================
   LOADER
========================= */
window.addEventListener("load", () => {
  const loader = document.getElementById("loader");
  if (loader) setTimeout(() => loader.classList.add("hide"), 800);

  loadLatestResult();
});

/* =========================
   SEARCH
========================= */
if (searchInput) {
  searchInput.addEventListener("input", filterSubjects);
}

/* =========================
   UPLOAD
========================= */
if (uploadBtn) {
  uploadBtn.addEventListener("click", uploadResult);
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

function escapeHtml(value) {
  return String(formatValue(value))
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

/* =========================
   SUBJECT FILTER
========================= */
function getSubjects() {
  return Array.from(document.querySelectorAll("#subjectTableBody tr")).filter(
    (row) => row.cells.length >= 9 && !row.classList.contains("empty-row")
  );
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
   API CALLS
========================= */
async function loadLatestResult() {
  try {
    const res = await fetch(`${API_BASE_URL}/latest`);
    if (!res.ok) return;

    const data = await res.json();
    if (data.success) updateDashboard(data.data);
  } catch (err) {
    console.log("Latest load error:", err.message);
  }
}

async function uploadResult() {
  const file = pdfFile?.files?.[0];

  if (!file) return alert("Please select a PDF");

  if (file.type !== "application/pdf") {
    return alert("Only PDF allowed");
  }

  const formData = new FormData();
  formData.append("pdf", file);

  uploadBtn.disabled = true;
  uploadBtn.textContent = "Uploading...";

  try {
    const res = await fetch(`${API_BASE_URL}/upload`, {
      method: "POST",
      body: formData
    });

    const data = await res.json();

    if (!res.ok || !data.success) {
      return alert(data.message || "Upload failed");
    }

    updateDashboard(data.data);
    alert("Uploaded successfully");
  } catch (err) {
    console.log(err);
    alert("Server error");
  } finally {
    uploadBtn.disabled = false;
    uploadBtn.textContent = "Upload Result";
  }
}

/* =========================
   DASHBOARD UPDATE
========================= */
function updateDashboard(result) {
  if (!result) return;

  setText("studentName", result.studentName);
  setText("regNo", result.regNo);
  setText("semester", result.semester);

  setText("sgpa", result.sgpa);
  setText("cgpa", result.cgpa);

  const subjects = Array.isArray(result.subjects)
    ? result.subjects
    : [];

  renderSubjects(subjects);
  calculatePerformance(subjects);
  calculateCredits(subjects);
  updateResultStatus(result.resultStatus);

  filterSubjects();
}

/* =========================
   RENDER TABLE
========================= */
function renderSubjects(subjects) {
  const tableBody = document.getElementById("subjectTableBody");
  if (!tableBody) return;

  if (!subjects.length) {
    tableBody.innerHTML = `
      <tr class="empty-row">
        <td colspan="9">No subjects found</td>
      </tr>
    `;
    return;
  }

  tableBody.innerHTML = subjects
    .map(
      (s, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${escapeHtml(s.subjectCode)}</td>
        <td>${escapeHtml(s.subjectName)}</td>
        <td>${formatValue(s.ese)}</td>
        <td>${formatValue(s.ia)}</td>
        <td>${formatValue(s.total)}</td>
        <td>${formatValue(s.credit)}</td>
        <td>${escapeHtml(s.grade)}</td>
        <td>
          <span class="badge ${String(s.type).toLowerCase()}">
            ${escapeHtml(s.type)}
          </span>
        </td>
      </tr>
    `
    )
    .join("");
}

/* =========================
   PERFORMANCE
========================= */
function calculatePerformance(subjects) {
  if (!subjects.length) return;

  let highest = -Infinity;
  let lowest = Infinity;
  let highSub = "--";
  let lowSub = "--";

  subjects.forEach((s) => {
    const total = Number(s.total);

    if (isNaN(total)) return;

    if (total > highest) {
      highest = total;
      highSub = `${s.subjectName} (${total})`;
    }

    if (total < lowest) {
      lowest = total;
      lowSub = `${s.subjectName} (${total})`;
    }
  });

  setText("highestSubject", highSub);
  setText("lowestSubject", lowSub);
}

/* =========================
   CREDITS
========================= */
function calculateCredits(subjects) {
  const total = subjects.reduce((sum, s) => {
    const c = Number(s.credit);
    return sum + (isNaN(c) ? 0 : c);
  }, 0);

  setText("credits", total);
}

/* =========================
   RESULT STATUS
========================= */
function updateResultStatus(status) {
  const el = document.getElementById("resultStatus");
  if (!el) return;

  let final = status || "PASS";

  if (!status) {
    const rows = getSubjects();
    const fail = Array.from(rows).some(
      (r) => r.cells[8].textContent.toLowerCase() === "fail"
    );
    final = fail ? "FAIL" : "PASS";
  }

  el.innerHTML = `<span class="badge ${final.toLowerCase()}">${final}</span>`;
}

async function uploadResult() {
  const file = pdfFile && pdfFile.files ? pdfFile.files[0] : null;
  const semester = document.getElementById("semesterSelect").value;

  if (!file) {
    alert("Please select a PDF first");
    return;
  }

  if (!semester) {
    alert("Please select semester");
    return;
  }

  const formData = new FormData();
  formData.append("pdf", file);
  formData.append("semester", semester); // ✅ ADD THIS

  uploadBtn.disabled = true;
  uploadBtn.textContent = "Uploading...";

  try {
    const response = await fetch(`${API_BASE_URL}/upload`, {
      method: "POST",
      body: formData
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      alert(data.message || "Upload failed");
      return;
    }

    updateDashboard(data.data);
    alert("Result uploaded successfully");

  } catch (error) {
    console.error(error);
    alert("Server error. Please make sure backend is running.");
  } finally {
    uploadBtn.disabled = false;
    uploadBtn.textContent = "Upload Result";
  }
}