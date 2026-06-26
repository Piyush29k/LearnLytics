const API_BASE_URL = "http://localhost:5000/api/results";

const state = {
  results: [],
  charts: {},
};

document.addEventListener("DOMContentLoaded", initDashboard);

window.addEventListener("load", () => {
  const loader = document.getElementById("loader");
  if (loader) {
    setTimeout(() => loader.classList.add("hide"), 800);
  }
});

async function initDashboard() {
  if (!window.LearnLyticsAuth?.requireSession("student")) {
    return;
  }

  window.LearnLyticsAuth.syncUserDisplay();
  setupSidebar();
  setupLogout();
  await loadDashboardData();
  refreshIcons();
}

function setupSidebar() {
  const sidebar = document.querySelector(".sidebar");
  const toggleSidebar = document.getElementById("toggleSidebar");

  if (sidebar && window.matchMedia("(max-width: 640px)").matches) {
    sidebar.classList.add("collapsed");
  }

  toggleSidebar?.addEventListener("click", () => {
    sidebar?.classList.toggle("collapsed");
  });
}

function setupLogout() {
  document.getElementById("logoutBtn")?.addEventListener("click", () => {
    if (confirm("Logout from dashboard?")) {
      window.LearnLyticsAuth.clearSession();
      alert("Logged out successfully");
      window.location.href = "login.html";
    }
  });
}

async function loadDashboardData() {
  try {
    const response = await window.LearnLyticsAuth.authFetch(API_BASE_URL);
    const payload = response.ok ? await response.json() : null;
    const results =
      payload?.success && Array.isArray(payload.data) ? payload.data : [];

    state.results = getLatestResultPerSemester(results)
      .map(normalizeResult)
      .filter((result) => result.semester !== "N/A")
      .sort((a, b) => Number(a.semester) - Number(b.semester));

    renderDashboard();
  } catch (error) {
    console.error("Dashboard data load error:", error.message);
    state.results = [];
    renderDashboard("Unable to load your private result data.");
  }
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

function normalizeResult(result) {
  const subjects = Array.isArray(result?.subjects) ? result.subjects : [];

  return {
    studentName: result?.studentName || window.LearnLyticsAuth.getDisplayName(),
    regNo: result?.regNo || window.LearnLyticsAuth.getUser()?.regno || "",
    semester: normalizeSemester(result?.semester),
    sgpa: toNullableNumber(result?.sgpa),
    cgpa: toNullableNumber(result?.cgpa),
    creditsEarned:
      toNullableNumber(result?.creditsEarned) ?? sum(subjects, (subject) => subject.credit),
    resultStatus: result?.resultStatus || "PASS",
    subjects: subjects.map(normalizeSubject),
    createdAt: result?.createdAt,
    updatedAt: result?.updatedAt,
  };
}

function normalizeSubject(subject) {
  const total = toNumber(subject?.total);
  const grade = String(subject?.grade || inferGrade(total)).trim().toUpperCase();

  return {
    subjectCode: String(subject?.subjectCode || "").trim().toUpperCase(),
    subjectName: String(subject?.subjectName || "Untitled Subject").trim(),
    type: String(subject?.type || "THEORY").trim().toUpperCase(),
    total,
    credit: toNumber(subject?.credit),
    grade,
    status: grade === "F" ? "FAIL" : "PASS",
  };
}

function renderDashboard(errorMessage = "") {
  const user = window.LearnLyticsAuth.getUser();
  const name = window.LearnLyticsAuth.getDisplayName(user);
  const latest = state.results[state.results.length - 1] || null;
  const subjects = latest?.subjects || [];
  const totalCredits = sum(state.results, (result) => result.creditsEarned);
  const currentCgpa = latest?.cgpa ?? calculateCgpa(state.results);
  const gradeBand = getGradeBand(latest?.sgpa ?? currentCgpa);

  setText("profileName", name);
  setText("profileMeta", window.LearnLyticsAuth.getAcademicMeta(user));
  setText("dashboardGreeting", `Hi ${name}`);
  setText(
    "dashboardSummary",
    errorMessage ||
      (latest
        ? `${state.results.length} uploaded semester${state.results.length === 1 ? "" : "s"}. Latest result: Semester ${latest.semester}.`
        : "No uploaded result data yet. Upload your own result PDF from the Semester page.")
  );
  setText("predictedGrade", gradeBand);
  setText(
    "predictedScore",
    latest ? `Latest SGPA ${formatGpa(latest.sgpa)}` : "No result loaded"
  );
  setText("statSemesters", state.results.length);
  setText("statLatestSgpa", formatGpa(latest?.sgpa));
  setText("statCurrentCgpa", formatGpa(currentCgpa));
  setText("statCredits", formatNumber(totalCredits));

  renderCharts(latest, subjects, currentCgpa);
  refreshIcons();
}

function renderCharts(latest, subjects, currentCgpa) {
  if (!window.Chart) return;

  const labels = state.results.map((result) => `Sem ${result.semester}`);
  const sgpaValues = state.results.map((result) => round(result.sgpa));
  const cgpaValues = state.results.map((result) =>
    round(result.cgpa ?? calculateCgpaUpTo(result.semester))
  );
  const passed = subjects.filter((subject) => subject.status === "PASS").length;
  const failed = subjects.filter((subject) => subject.status === "FAIL").length;
  const practicalCount = subjects.filter((subject) => subject.type === "PRACTICAL").length;
  const theoryCount = subjects.length - practicalCount;
  const passRate = subjects.length ? (passed / subjects.length) * 100 : 0;
  const creditProgress = latest?.creditsEarned ? Math.min((latest.creditsEarned / 30) * 100, 100) : 0;

  renderChart("lineChart", "line", {
    labels,
    datasets: [
      {
        label: "SGPA",
        data: sgpaValues,
        borderColor: "#4f46e5",
        backgroundColor: "rgba(79, 70, 229, 0.14)",
        tension: 0.35,
        fill: true,
      },
      {
        label: "CGPA",
        data: cgpaValues,
        borderColor: "#14b8a6",
        backgroundColor: "rgba(20, 184, 166, 0.10)",
        tension: 0.35,
        fill: true,
      },
    ],
  }, { yMax: 10 });

  renderChart("radarChart", "radar", {
    labels: ["Pass Rate", "Theory", "Practical", "Credit Load", "CGPA"],
    datasets: [
      {
        label: "Academic Profile",
        data: [
          passRate,
          subjects.length ? (theoryCount / subjects.length) * 100 : 0,
          subjects.length ? (practicalCount / subjects.length) * 100 : 0,
          creditProgress,
          Number.isFinite(currentCgpa) ? currentCgpa * 10 : 0,
        ],
        borderColor: "#4f46e5",
        backgroundColor: "rgba(79, 70, 229, 0.22)",
      },
    ],
  }, { yMax: 100 });

  renderChart("barChart", "bar", {
    labels: subjects.slice(0, 8).map((subject) => subject.subjectCode || subject.subjectName),
    datasets: [
      {
        label: "Total Marks",
        data: subjects.slice(0, 8).map((subject) => subject.total),
        backgroundColor: "#4f46e5",
        borderRadius: 8,
      },
    ],
  }, { yMax: 100 });

  renderChart("doughnutChart", "doughnut", {
    labels: ["Passed", "Failed"],
    datasets: [
      {
        data: [passed, failed],
        backgroundColor: ["#22c55e", "#ef4444"],
        borderWidth: 0,
      },
    ],
  });
}

function renderChart(id, type, data, options = {}) {
  const canvas = document.getElementById(id);
  if (!canvas || !window.Chart) return;

  state.charts[id]?.destroy();

  const isCircular = type === "doughnut" || type === "pie";
  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        labels: {
          color: "#374151",
          font: {
            family: "Inter",
            weight: "600",
          },
        },
      },
    },
  };

  if (!isCircular) {
    chartOptions.scales = {
      y: {
        beginAtZero: true,
        max: options.yMax,
        grid: {
          color: "#eef2f7",
        },
      },
      x: {
        grid: {
          display: false,
        },
      },
    };
  } else {
    chartOptions.cutout = "68%";
  }

  state.charts[id] = new Chart(canvas, {
    type,
    data,
    options: chartOptions,
  });
}

function calculateCgpa(results) {
  const totalCredits = sum(results, (result) => result.creditsEarned);
  const weighted = sum(results, (result) =>
    Number.isFinite(result.sgpa) ? result.sgpa * result.creditsEarned : 0
  );

  return totalCredits > 0 ? weighted / totalCredits : null;
}

function calculateCgpaUpTo(semester) {
  return calculateCgpa(
    state.results.filter((result) => Number(result.semester) <= Number(semester))
  );
}

function getGradeBand(value) {
  const score = Number(value);
  if (!Number.isFinite(score)) return "--";
  if (score >= 9) return "A+";
  if (score >= 8) return "A";
  if (score >= 7) return "B";
  if (score >= 6) return "C";
  if (score >= 5) return "D";
  return "P";
}

function inferGrade(total) {
  if (total >= 90) return "A+";
  if (total >= 80) return "A";
  if (total >= 70) return "B";
  if (total >= 60) return "C";
  if (total >= 50) return "D";
  if (total >= 35) return "P";
  return "F";
}

function normalizeSemester(value) {
  const semester = String(value || "N/A")
    .trim()
    .replace(/(?:st|nd|rd|th)$/i, "");

  return semester || "N/A";
}

function getTimestamp(result) {
  const value = new Date(result?.updatedAt || result?.createdAt || 0).getTime();
  return Number.isFinite(value) ? value : 0;
}

function sum(items, selector) {
  return items.reduce((total, item) => {
    const number = Number(selector(item));
    return Number.isFinite(number) ? total + number : total;
  }, 0);
}

function toNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function toNullableNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function round(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.round(number * 100) / 100 : null;
}

function formatGpa(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number.toFixed(2) : "--";
}

function formatNumber(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "--";
  return Number.isInteger(number) ? String(number) : number.toFixed(1);
}

function setText(id, value) {
  const element = document.getElementById(id);
  if (!element) return;
  element.textContent =
    value === undefined || value === null || value === "" ? "--" : value;
}

function refreshIcons() {
  if (window.lucide) {
    lucide.createIcons();
  }
}
