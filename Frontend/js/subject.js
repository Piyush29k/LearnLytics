const API_BASE_URL = "http://localhost:5000/api/results";
const AUTO_REFRESH_MS = 30000;

const state = {
  currentRegNo: null,
  results: [],
  selectedSemester: "ALL",
  subjects: [],
  filteredSubjects: [],
  charts: {},
  refreshTimer: null,
};

const gradeRank = {
  "A+": 1,
  A: 2,
  B: 3,
  C: 4,
  D: 5,
  P: 6,
  F: 7,
};

document.addEventListener("DOMContentLoaded", initSubjectPage);

window.addEventListener("load", () => {
  const loader = document.getElementById("loader");
  if (loader) {
    setTimeout(() => loader.classList.add("hide"), 800);
  }
});

async function initSubjectPage() {
  if (!window.LearnLyticsAuth?.requireSession("student")) {
    return;
  }

  window.LearnLyticsAuth.syncUserDisplay();

  if (window.lucide) {
    lucide.createIcons();
  }

  setupSidebar();
  setupLogout();
  setupControls();
  setupAutoRefresh();
  await loadResults();
}

function setupSidebar() {
  const sidebar = document.querySelector(".sidebar");
  const toggleSidebar = document.getElementById("toggleSidebar");

  if (sidebar && window.matchMedia("(max-width: 640px)").matches) {
    sidebar.classList.add("collapsed");
  }

  if (toggleSidebar && sidebar) {
    toggleSidebar.addEventListener("click", () => {
      sidebar.classList.toggle("collapsed");
    });
  }
}

function setupLogout() {
  const logoutBtn = document.getElementById("logoutBtn");
  if (!logoutBtn) return;

  logoutBtn.addEventListener("click", () => {
    if (confirm("Logout from dashboard?")) {
      window.LearnLyticsAuth?.clearSession();
      window.location.href = "login.html";
    }
  });
}

function setupControls() {
  [
    "subjectSearch",
    "typeFilter",
    "gradeFilter",
    "statusFilter",
    "sortSubjects",
  ].forEach((id) => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener("input", applySubjectFilters);
      el.addEventListener("change", applySubjectFilters);
    }
  });
}

function setupAutoRefresh() {
  state.refreshTimer = window.setInterval(() => {
    loadResults({ silent: true });
  }, AUTO_REFRESH_MS);

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
      loadResults({ silent: true });
    }
  });

  window.addEventListener("focus", () => {
    loadResults({ silent: true });
  });
}

async function loadResults({ silent = false } = {}) {
  let latestResult = null;
  let allResults = [];

  try {
    const [latestResponse, allResponse] = await Promise.all([
      window.LearnLyticsAuth.authFetch(`${API_BASE_URL}/latest`),
      window.LearnLyticsAuth.authFetch(API_BASE_URL),
    ]);

    if (latestResponse.ok) {
      const latestData = await latestResponse.json();
      latestResult = latestData?.success ? latestData.data : null;
    }

    if (allResponse.ok) {
      const allData = await allResponse.json();
      allResults = allData?.success && Array.isArray(allData.data)
        ? allData.data
        : [];
    }
  } catch (err) {
    if (!silent || !state.results.length) {
      renderLoadError();
    }
    return;
  }

  state.currentRegNo =
    latestResult?.regNo ||
    window.LearnLyticsAuth?.getUser()?.regno ||
    state.currentRegNo;

  const currentRegNo = state.currentRegNo;
  const studentResults = currentRegNo
    ? allResults.filter((result) => result.regNo === currentRegNo)
    : allResults;

  const sourceResults = studentResults.length
    ? studentResults
    : latestResult
      ? [latestResult]
      : [];

  state.results = getLatestResultPerSemester(sourceResults)
    .map(normalizeResult)
    .filter((result) => result.semester !== "N/A" && result.subjects.length)
    .sort(compareSemesters);

  if (
    state.selectedSemester !== "ALL" &&
    !state.results.some((result) => result.semester === state.selectedSemester)
  ) {
    state.selectedSemester = "ALL";
  }

  const contextResult = latestResult || state.results[state.results.length - 1];
  setStudentContext(contextResult);
  renderSemesterButtons();
  applySubjectFilters();
}

function renderLoadError() {
  state.results = [];
  state.subjects = [];
  state.filteredSubjects = [];

  setStudentContext(null);
  renderSemesterButtons();
  renderSemesterScope("Unable to load subject data");
  renderSummary();
  renderSemesterSubjectViews("Unable to load subject data from the database.");
  renderInsights();
  renderCharts();
}

function getLatestResultPerSemester(results) {
  const bySemester = new Map();

  results.forEach((result) => {
    const semester = normalizeSemester(result?.semester);
    if (semester === "N/A") return;

    const existing = bySemester.get(semester);
    if (!existing || getTimestamp(result) > getTimestamp(existing)) {
      bySemester.set(semester, result);
    }
  });

  return Array.from(bySemester.values());
}

function getTimestamp(result) {
  const value = new Date(result?.updatedAt || result?.createdAt || 0).getTime();
  return Number.isFinite(value) ? value : 0;
}

function normalizeResult(result) {
  const semester = normalizeSemester(result?.semester);
  const subjects = Array.isArray(result?.subjects) ? result.subjects : [];
  const theoryNamesByCode = buildTheoryNameMap(subjects);
  const normalizedSubjects = subjects.map((subject) =>
    normalizeSubject(subject, semester, theoryNamesByCode)
  );
  const creditsEarned = toNullableNumber(result?.creditsEarned);
  const subjectCredits = normalizedSubjects.reduce(
    (sum, subject) => sum + subject.credit,
    0
  );

  return {
    studentName: result?.studentName || "Student",
    regNo: result?.regNo || "",
    semester,
    sgpa: toNullableNumber(result?.sgpa),
    resultStatus: normalizeResultStatus(result?.resultStatus, normalizedSubjects),
    creditsEarned: creditsEarned ?? subjectCredits,
    subjects: normalizedSubjects,
  };
}

function normalizeSemester(value) {
  const semester = String(value || "N/A")
    .trim()
    .replace(/(?:st|nd|rd|th)$/i, "");

  return semester || "N/A";
}

function compareSemesters(a, b) {
  return Number(a.semester) - Number(b.semester);
}

function setStudentContext(result) {
  const uploadedCount = state.results.length;

  setText("studentName", result?.studentName || window.LearnLyticsAuth?.getDisplayName());
  setText(
    "studentMeta",
    uploadedCount
      ? `${uploadedCount} uploaded semester${uploadedCount === 1 ? "" : "s"}`
      : "No uploaded semesters"
  );
}

function renderSemesterButtons() {
  const container = document.getElementById("semesterButtons");
  if (!container) return;

  if (!state.results.length) {
    container.innerHTML = `
      <span class="no-semester-state">No uploaded semesters available</span>
    `;
    return;
  }

  const buttons = [
    { label: "All Semesters", value: "ALL" },
    ...state.results.map((result) => ({
      label: `Semester ${result.semester}`,
      value: result.semester,
    })),
  ];

  container.innerHTML = buttons
    .map(
      (button) => `
        <button
          class="semester-filter ${state.selectedSemester === button.value ? "active" : ""}"
          type="button"
          data-semester="${button.value}"
        >
          ${button.label}
        </button>
      `
    )
    .join("");

  container.querySelectorAll(".semester-filter").forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedSemester = button.dataset.semester;
      renderSemesterButtons();
      applySubjectFilters();
    });
  });
}

function buildTheoryNameMap(subjects) {
  const theoryNamesByCode = new Map();

  subjects.forEach((subject) => {
    const subjectCode = String(subject.subjectCode || "").trim().toUpperCase();
    const baseCode = subjectCode.replace(/P$/i, "");
    const subjectName = String(subject.subjectName || "").trim();
    const type = String(subject.type || "").toUpperCase();

    if (!baseCode || !subjectName || /P$/i.test(subjectCode) || type !== "THEORY") {
      return;
    }

    theoryNamesByCode.set(baseCode, subjectName);
  });

  return theoryNamesByCode;
}

function normalizeSubject(subject, semester, theoryNamesByCode) {
  const subjectCode = String(subject.subjectCode || "").trim().toUpperCase();
  const baseCode = subjectCode.replace(/P$/i, "");
  const subjectName = repairLeadingPSubjectName(
    String(subject.subjectName || "Untitled Subject").trim(),
    theoryNamesByCode.get(baseCode)
  );
  const type = normalizeType(subjectCode, subject.type, subjectName);
  const theory = toNullableNumber(
    subject.ese ?? subject.theory ?? subject.theoryMarks
  );
  const practical = toNullableNumber(
    subject.ia ?? subject.practical ?? subject.practicalMarks
  );
  const total = toNumber(
    subject.total,
    (theory ?? 0) + (practical ?? 0)
  );
  const credit = toNumber(subject.credit);
  const grade = String(subject.grade || inferGrade(total)).trim().toUpperCase();
  const attendance = toNullableNumber(
    subject.attendance ?? subject.attendancePercentage
  );
  const status = normalizeSubjectStatus(subject.status, grade);

  return {
    semester,
    subjectCode,
    subjectName,
    type,
    theory,
    practical,
    total,
    credit,
    grade,
    attendance,
    status,
  };
}

function normalizeType(code, type, name) {
  const rawType = String(type || "").toUpperCase();
  if (/P$/i.test(code)) return "PRACTICAL";
  if (rawType === "PRACTICAL" || rawType === "THEORY") return rawType;

  return /P$/i.test(code) || /LAB|PRACTICAL|WORKSHOP/i.test(name)
    ? "PRACTICAL"
    : "THEORY";
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

function normalizeSubjectStatus(status, grade) {
  const rawStatus = String(status || "").trim().toUpperCase();
  if (rawStatus === "PASS" || rawStatus === "FAIL") return rawStatus;

  return grade === "F" ? "FAIL" : "PASS";
}

function normalizeResultStatus(status, subjects) {
  if (subjects.some((subject) => subject.status === "FAIL")) {
    return "FAIL";
  }

  const rawStatus = String(status || "").trim().toUpperCase();
  return rawStatus === "FAIL" ? "FAIL" : "PASS";
}

function toNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function toNullableNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function inferGrade(total) {
  if (total >= 90) return "A+";
  if (total >= 75) return "A";
  if (total >= 65) return "B";
  if (total >= 55) return "C";
  if (total >= 40) return "D";
  return "F";
}

function getSelectedResults() {
  return state.selectedSemester === "ALL"
    ? state.results
    : state.results.filter((result) => result.semester === state.selectedSemester);
}

function getSelectedSubjects() {
  return getSelectedResults().flatMap((result) => result.subjects);
}

function applySubjectFilters() {
  const search = getValue("subjectSearch").toLowerCase();
  const type = getValue("typeFilter", "ALL");
  const grade = getValue("gradeFilter", "ALL");
  const status = getValue("statusFilter", "ALL");
  const sort = getValue("sortSubjects", "marksDesc");

  state.subjects = getSelectedSubjects();

  state.filteredSubjects = state.subjects.filter((subject) => {
    const matchesSearch =
      subject.subjectCode.toLowerCase().includes(search) ||
      subject.subjectName.toLowerCase().includes(search) ||
      `semester ${subject.semester}`.includes(search);
    const matchesType = type === "ALL" || subject.type === type;
    const matchesGrade = grade === "ALL" || subject.grade === grade;
    const matchesStatus = status === "ALL" || subject.status === status;

    return matchesSearch && matchesType && matchesGrade && matchesStatus;
  });

  state.filteredSubjects.sort(getSorter(sort));

  renderSemesterScope();
  renderSummary();
  renderSemesterSubjectViews();
  renderInsights();
  renderCharts();
}

function renderSemesterScope(overrideText) {
  if (overrideText) {
    setText("semesterScopeText", overrideText);
    setText("studentMeta", overrideText);
    return;
  }

  if (!state.results.length) {
    setText("semesterScopeText", "No uploaded semester data");
    return;
  }

  const uploadedCount = state.results.length;
  const text =
    state.selectedSemester === "ALL"
      ? `Showing ${uploadedCount} uploaded semester${uploadedCount === 1 ? "" : "s"}`
      : `Showing Semester ${state.selectedSemester}`;

  setText("semesterScopeText", text);
  setText(
    "studentMeta",
    state.selectedSemester === "ALL"
      ? `${uploadedCount} uploaded semester${uploadedCount === 1 ? "" : "s"}`
      : `Semester ${state.selectedSemester}`
  );
}

function getSorter(sort) {
  const sorters = {
    marksAsc: (a, b) => a.total - b.total,
    marksDesc: (a, b) => b.total - a.total,
    attendanceAsc: (a, b) =>
      (a.attendance ?? Number.POSITIVE_INFINITY) -
      (b.attendance ?? Number.POSITIVE_INFINITY),
    grade: (a, b) => (gradeRank[a.grade] || 99) - (gradeRank[b.grade] || 99),
    creditsDesc: (a, b) => b.credit - a.credit,
  };

  return sorters[sort] || sorters.marksDesc;
}

function renderSummary() {
  const subjects = state.filteredSubjects;
  const totalSubjects = subjects.length;
  const average =
    totalSubjects > 0
      ? subjects.reduce((sum, subject) => sum + subject.total, 0) / totalSubjects
      : 0;
  const passed = subjects.filter((subject) => subject.status === "PASS").length;
  const focus = [...subjects].sort((a, b) => a.total - b.total)[0];

  setText("totalSubjects", totalSubjects);
  setText("averageMarks", totalSubjects ? `${average.toFixed(1)}%` : "--");
  setText(
    "passRate",
    totalSubjects ? `${Math.round((passed / totalSubjects) * 100)}%` : "--"
  );
  setText("focusSubject", focus ? formatSubjectLabel(focus) : "--");
  setText("visibleCount", `${totalSubjects} shown`);
}

function renderSemesterSubjectViews(emptyMessage = "No subjects match the selected filters") {
  const container = document.getElementById("semesterSubjectViews");
  if (!container) return;

  if (!state.results.length) {
    container.innerHTML = `
      <div class="empty-state">No uploaded semester results found.</div>
    `;
    return;
  }

  if (!state.filteredSubjects.length) {
    container.innerHTML = `
      <div class="empty-state">${escapeHtml(emptyMessage)}</div>
    `;
    return;
  }

  const subjectsBySemester = groupSubjectsBySemester(state.filteredSubjects);
  const selectedResults = getSelectedResults().filter((result) =>
    subjectsBySemester.has(result.semester)
  );

  container.innerHTML = selectedResults
    .map((result) =>
      renderSemesterSubjectCard(result, subjectsBySemester.get(result.semester))
    )
    .join("");
}

function groupSubjectsBySemester(subjects) {
  return subjects.reduce((map, subject) => {
    if (!map.has(subject.semester)) {
      map.set(subject.semester, []);
    }

    map.get(subject.semester).push(subject);
    return map;
  }, new Map());
}

function renderSemesterSubjectCard(result, subjects) {
  const groups = [
    {
      title: "Theory Subjects",
      subjects: subjects.filter((subject) => subject.type === "THEORY"),
    },
    {
      title: "Practical Subjects",
      subjects: subjects.filter((subject) => subject.type === "PRACTICAL"),
    },
  ].filter((group) => group.subjects.length);

  return `
    <article class="semester-subject-card">
      <div class="semester-card-header">
        <div>
          <span class="eyebrow">Semester ${escapeHtml(result.semester)}</span>
          <h3>Subject Details</h3>
        </div>

        <div class="semester-stats" aria-label="Semester ${escapeHtml(result.semester)} result summary">
          <span class="stat-pill">SGPA <strong>${formatGpa(result.sgpa)}</strong></span>
          <span class="stat-pill">Credits <strong>${formatNumber(result.creditsEarned)}</strong></span>
          <span class="status-pill ${result.resultStatus.toLowerCase()}">${escapeHtml(result.resultStatus)}</span>
        </div>
      </div>

      ${groups.map(renderSubjectGroup).join("")}
    </article>
  `;
}

function renderSubjectGroup(group) {
  return `
    <section class="subject-group">
      <div class="subject-group-heading">
        <h4>${escapeHtml(group.title)}</h4>
        <span>${group.subjects.length} subject${group.subjects.length === 1 ? "" : "s"}</span>
      </div>

      <div class="table-wrap">
        <table class="semester-subject-table">
          <thead>
            <tr>
              <th>Subject Code</th>
              <th>Subject Name</th>
              <th>Theory Marks</th>
              <th>Practical / IA</th>
              <th>Total</th>
              <th>Credits</th>
              <th>Grade</th>
              <th>Status</th>
            </tr>
          </thead>

          <tbody>
            ${group.subjects.map(renderSubjectRow).join("")}
          </tbody>
        </table>
      </div>
    </section>
  `;
}

function renderSubjectRow(subject) {
  return `
    <tr>
      <td>${escapeHtml(subject.subjectCode)}</td>
      <td class="subject-name">${escapeHtml(subject.subjectName)}</td>
      <td>${formatNumber(subject.theory)}</td>
      <td>${formatNumber(subject.practical)}</td>
      <td><strong>${formatNumber(subject.total)}</strong></td>
      <td>${formatNumber(subject.credit)}</td>
      <td><span class="badge grade">${escapeHtml(subject.grade)}</span></td>
      <td><span class="badge ${subject.status.toLowerCase()}">${escapeHtml(subject.status)}</span></td>
    </tr>
  `;
}

function renderInsights() {
  renderInsightList(
    "strongSubjects",
    [...state.filteredSubjects].sort((a, b) => b.total - a.total).slice(0, 3),
    state.results.length ? "No strong subjects found" : "No uploaded subjects found"
  );

  renderInsightList(
    "weakSubjects",
    [...state.filteredSubjects].sort((a, b) => a.total - b.total).slice(0, 3),
    state.results.length ? "No weak subjects found" : "No uploaded subjects found"
  );

  renderRecommendations();
}

function renderInsightList(id, subjects, emptyMessage) {
  const container = document.getElementById(id);
  if (!container) return;

  if (!subjects.length) {
    container.innerHTML = `<div class="insight-item"><strong>${escapeHtml(emptyMessage)}</strong></div>`;
    return;
  }

  container.innerHTML = subjects
    .map(
      (subject) => `
        <div class="insight-item">
          <strong>${escapeHtml(subject.subjectName)}</strong>
          <span>${escapeHtml(formatSubjectLabel(subject))} - ${formatNumber(subject.total)} marks - Grade ${escapeHtml(subject.grade)}</span>
        </div>
      `
    )
    .join("");
}

function renderRecommendations() {
  const container = document.getElementById("aiRecommendations");
  if (!container) return;

  if (!state.filteredSubjects.length) {
    const title = state.results.length
      ? "No matching subjects"
      : "No uploaded subject data";

    container.innerHTML = `
      <div class="recommendation-item">
        <strong>${title}</strong>
        <span>Semester records will appear here after result data is available.</span>
      </div>
    `;
    return;
  }

  const recommendations = [];
  const lowMarks = state.filteredSubjects.filter((subject) => subject.total < 60);
  const lowAttendance = state.filteredSubjects.filter(
    (subject) => subject.attendance !== null && subject.attendance < 75
  );
  const failed = state.filteredSubjects.filter((subject) => subject.status === "FAIL");

  if (failed.length) {
    recommendations.push({
      title: "Recover failed subjects first",
      body: `${failed.map(formatSubjectLabel).join(", ")} need immediate revision and faculty support.`,
    });
  }

  if (lowMarks.length) {
    recommendations.push({
      title: "Target low scoring subjects",
      body: `${lowMarks.slice(0, 3).map(formatSubjectLabel).join(", ")} should get extra practice sessions this week.`,
    });
  }

  if (lowAttendance.length) {
    recommendations.push({
      title: "Raise attendance risk areas",
      body: `${lowAttendance.map(formatSubjectLabel).join(", ")} are below the 75% attendance threshold.`,
    });
  }

  if (!recommendations.length) {
    recommendations.push({
      title: "Maintain the current pace",
      body: "Scores are stable across the selected semester range. Keep revising high-credit subjects regularly.",
    });
  }

  container.innerHTML = recommendations
    .map(
      (item) => `
        <div class="recommendation-item">
          <strong>${escapeHtml(item.title)}</strong>
          <span>${escapeHtml(item.body)}</span>
        </div>
      `
    )
    .join("");
}

function renderCharts() {
  if (!window.Chart) return;

  const subjects = state.filteredSubjects;
  const labels = subjects.map(getChartLabel);

  renderChart("subjectComparisonChart", "bar", {
    labels,
    datasets: [
      {
        label: "Total Marks",
        data: subjects.map((subject) => subject.total),
        backgroundColor: "#2563eb",
        borderRadius: 6,
      },
    ],
  });

  renderChart("typeAnalysisChart", "bar", {
    labels,
    datasets: [
      {
        label: "Theory",
        data: subjects.map((subject) => subject.theory ?? 0),
        backgroundColor: "#4f46e5",
        borderRadius: 6,
      },
      {
        label: "Practical / IA",
        data: subjects.map((subject) => subject.practical ?? 0),
        backgroundColor: "#14b8a6",
        borderRadius: 6,
      },
    ],
  });

  renderChart("trendChart", "line", {
    labels,
    datasets: [
      {
        label: "Score",
        data: subjects.map((subject) => subject.total),
        borderColor: "#16a34a",
        backgroundColor: "rgba(22, 163, 74, 0.14)",
        borderWidth: 3,
        fill: true,
        tension: 0.35,
        pointRadius: 4,
      },
    ],
  });
}

function renderChart(id, type, data) {
  const canvas = document.getElementById(id);
  if (!canvas) return;

  if (state.charts[id]) {
    state.charts[id].destroy();
  }

  state.charts[id] = new Chart(canvas, {
    type,
    data,
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: {
            color: "#374151",
            font: {
              family: "Inter",
              weight: "700",
            },
          },
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          max: 100,
          grid: {
            color: "#eef2f7",
          },
        },
        x: {
          grid: {
            display: false,
          },
        },
      },
    },
  });
}

function getChartLabel(subject) {
  return state.selectedSemester === "ALL"
    ? `S${subject.semester} ${subject.subjectCode}`
    : subject.subjectCode;
}

function formatSubjectLabel(subject) {
  return state.selectedSemester === "ALL"
    ? `S${subject.semester} ${subject.subjectCode}`
    : subject.subjectCode;
}

function getValue(id, fallback = "") {
  const el = document.getElementById(id);
  return el?.value ?? fallback;
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent =
    value === undefined || value === null || value === "" ? "--" : value;
}

function formatGpa(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number.toFixed(2) : "N/A";
}

function formatNumber(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "--";
  return Number.isInteger(number) ? String(number) : number.toFixed(1);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
