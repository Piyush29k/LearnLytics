const API_BASE_URL = "http://localhost:5000/api/results";

const BEU_GRADES = [
  { grade: "A+", range: "90% and Above", min: 90, point: 10, color: "#2563eb" },
  { grade: "A", range: "80% - 89.99%", min: 80, point: 9, color: "#0891b2" },
  { grade: "B", range: "70% - 79.99%", min: 70, point: 8, color: "#059669" },
  { grade: "C", range: "60% - 69.99%", min: 60, point: 7, color: "#84cc16" },
  { grade: "D", range: "50% - 59.99%", min: 50, point: 6, color: "#f59e0b" },
  { grade: "P", range: "35% - 49.99%", min: 35, point: 5, color: "#ea580c" },
  { grade: "F", range: "Below 35%", min: 0, point: 0, color: "#dc2626" },
];

const GRADE_POINTS = BEU_GRADES.reduce((map, item) => {
  map[item.grade] = item.point;
  return map;
}, {});

const state = {
  currentRegNo: null,
  results: [],
  allSubjects: [],
  subjects: [],
  semesterSummaries: [],
  selectedSemester: null,
  charts: {},
};

document.addEventListener("DOMContentLoaded", initPerformancePage);

window.addEventListener("load", () => {
  const loader = document.getElementById("loader");
  if (loader) {
    setTimeout(() => loader.classList.add("hide"), 800);
  }
});

async function initPerformancePage() {
  if (!window.LearnLyticsAuth?.requireSession("student")) {
    return;
  }

  window.LearnLyticsAuth.syncUserDisplay();

  if (window.lucide) {
    lucide.createIcons();
  }

  setupSidebar();
  setupLogout();
  await loadPerformanceData();
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

async function loadPerformanceData() {
  try {
    const [latestResponse, allResponse] = await Promise.all([
      window.LearnLyticsAuth.authFetch(`${API_BASE_URL}/latest`),
      window.LearnLyticsAuth.authFetch(API_BASE_URL),
    ]);

    const latestData = latestResponse.ok ? await latestResponse.json() : null;
    const allData = allResponse.ok ? await allResponse.json() : null;
    const latestResult = latestData?.success ? latestData.data : null;
    const allResults =
      allData?.success && Array.isArray(allData.data) ? allData.data : [];

    state.currentRegNo =
      latestResult?.regNo ||
      window.LearnLyticsAuth?.getUser()?.regno ||
      state.currentRegNo;

    const studentResults = state.currentRegNo
      ? allResults.filter((result) => result.regNo === state.currentRegNo)
      : allResults;
    const mergedResults = [...studentResults];

    if (
      latestResult &&
      (!state.currentRegNo || latestResult.regNo === state.currentRegNo)
    ) {
      mergedResults.push(latestResult);
    }

    const sourceResults = mergedResults.length
      ? mergedResults
      : latestResult
        ? [latestResult]
        : [];

    state.results = getLatestResultPerSemester(sourceResults)
      .map(normalizeResult)
      .filter((result) => result.semester !== "N/A" && result.subjects.length)
      .sort(compareSemesters);

    state.allSubjects = state.results.flatMap((result) => result.subjects);
    state.semesterSummaries = buildSemesterSummaries(state.results);

    if (
      state.selectedSemester &&
      !state.results.some((result) => result.semester === state.selectedSemester)
    ) {
      state.selectedSemester = null;
    }

    if (!state.allSubjects.length) {
      renderEmptyState("No uploaded result data found.");
      return;
    }

    renderSemesterSelector();
    renderPerformance();
  } catch (error) {
    console.error("Performance load error:", error.message);
    renderEmptyState("Unable to load performance data from the database.");
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

function getTimestamp(result) {
  const value = new Date(result?.updatedAt || result?.createdAt || 0).getTime();
  return Number.isFinite(value) ? value : 0;
}

function normalizeResult(result) {
  const semester = normalizeSemester(result?.semester);
  const rawSubjects = Array.isArray(result?.subjects) ? result.subjects : [];
  const theoryNamesByCode = buildTheoryNameMap(rawSubjects);
  const subjects = rawSubjects.map((subject) =>
    normalizeSubject(subject, semester, theoryNamesByCode)
  );

  return {
    studentName: result?.studentName || "Student",
    regNo: result?.regNo || "",
    semester,
    sgpa: toNullableNumber(result?.sgpa),
    cgpa: toNullableNumber(result?.cgpa),
    creditsEarned: toNullableNumber(result?.creditsEarned),
    subjects,
  };
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
  const ese = toNullableNumber(subject.ese ?? subject.theory ?? subject.theoryMarks);
  const ia = toNullableNumber(subject.ia ?? subject.practical ?? subject.practicalMarks);
  const total = toNumber(subject.total, (ese ?? 0) + (ia ?? 0));
  const percentage = clamp(total, 0, 100);
  const credit = toNumber(subject.credit);
  const percentageGrade = getGradeFromPercentage(percentage);
  const passCondition = getPassCondition(type, percentage, ese);
  const officialGrade = normalizeGrade(subject.grade);
  const grade = officialGrade || (passCondition.isPassed ? percentageGrade : "F");
  const gradePoint = GRADE_POINTS[grade] ?? 0;

  return {
    semester,
    subjectCode,
    subjectName,
    type,
    ese,
    ia,
    percentage,
    credit,
    percentageGrade,
    grade,
    gradePoint,
    status: grade === "F" ? "FAIL" : "PASS",
    conditionReason: passCondition.reason,
    eseThreshold: passCondition.eseThreshold,
  };
}

function normalizeGrade(value) {
  const grade = String(value || "").trim().toUpperCase();
  return Object.prototype.hasOwnProperty.call(GRADE_POINTS, grade)
    ? grade
    : null;
}

function normalizeType(code, type, name) {
  const rawType = String(type || "").toUpperCase();
  if (/P$/i.test(code)) return "PRACTICAL";
  if (rawType === "PRACTICAL" || rawType === "THEORY") return rawType;

  return /LAB|PRACTICAL|WORKSHOP|INTERNSHIP/i.test(name)
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

function getGradeFromPercentage(percentage) {
  const score = Number(percentage);

  if (!Number.isFinite(score) || score < 35) return "F";
  if (score >= 90) return "A+";
  if (score >= 80) return "A";
  if (score >= 70) return "B";
  if (score >= 60) return "C";
  if (score >= 50) return "D";
  return "P";
}

function getPassCondition(type, percentage, ese) {
  const eseThreshold = type === "PRACTICAL" ? 10.5 : 24.5;
  const overallPassed = Number(percentage) >= 35;
  const esePassed = Number(ese) >= eseThreshold;
  const reasons = [];

  if (!overallPassed) {
    reasons.push("Overall below 35%");
  }

  if (!esePassed) {
    reasons.push(`ESE below ${formatNumber(eseThreshold)}`);
  }

  return {
    isPassed: overallPassed && esePassed,
    reason: reasons.length ? reasons.join(", ") : "Meets BEU pass condition",
    eseThreshold,
  };
}

function buildSemesterSummaries(results) {
  let cumulativeCredits = 0;
  let cumulativeWeightedPoints = 0;

  return results.map((result) => {
    const subjects = result.subjects;
    const subjectCredits = sum(subjects, (subject) => subject.credit);
    const credits =
      result.creditsEarned && result.creditsEarned > 0
        ? result.creditsEarned
        : subjectCredits;
    const subjectWeightedPoints = sum(
      subjects,
      (subject) => subject.credit * subject.gradePoint
    );
    const calculatedSgpa =
      subjectCredits > 0 ? subjectWeightedPoints / subjectCredits : null;
    const sgpa = result.sgpa ?? calculatedSgpa;
    const averagePercentage = average(subjects, (subject) => subject.percentage);
    const passed = subjects.filter((subject) => subject.status === "PASS").length;
    const failed = subjects.length - passed;
    const bestSubject = getBestSubject(subjects);
    const weakestSubject = getWeakestSubject(subjects);
    const weightedPoints =
      credits > 0 && Number.isFinite(sgpa)
        ? sgpa * credits
        : subjectWeightedPoints;

    if (credits > 0 && Number.isFinite(sgpa)) {
      cumulativeCredits += credits;
      cumulativeWeightedPoints += weightedPoints;
    }

    return {
      semester: result.semester,
      credits,
      weightedPoints,
      sgpa,
      cgpa:
        result.cgpa ??
        (cumulativeCredits > 0
          ? cumulativeWeightedPoints / cumulativeCredits
          : null),
      averagePercentage,
      passed,
      failed,
      passRate: subjects.length ? (passed / subjects.length) * 100 : 0,
      bestSubject,
      weakestSubject,
    };
  });
}

function renderSemesterSelector() {
  const select = document.getElementById("performanceSemesterSelect");
  const cards = document.getElementById("performanceSemesterCards");

  if (select) {
    select.innerHTML = [
      '<option value="">Select semester</option>',
      ...state.results.map(
        (result) =>
          `<option value="${escapeHtml(result.semester)}">Semester ${escapeHtml(result.semester)}</option>`
      ),
    ].join("");
    select.value = state.selectedSemester || "";
    select.onchange = () => {
      setSelectedSemester(select.value);
    };
  }

  if (cards) {
    if (!state.results.length) {
      cards.innerHTML = "";
    } else {
      cards.innerHTML = state.results
        .map((result) => {
          const summary = getSemesterSummary(result.semester);
          const isActive = state.selectedSemester === result.semester;

          return `
            <button
              class="performance-semester-card ${isActive ? "active" : ""}"
              type="button"
              data-semester="${escapeHtml(result.semester)}"
            >
              <span>Semester ${escapeHtml(result.semester)}</span>
              <strong>SGPA ${formatGpa(summary?.sgpa)}</strong>
            </button>
          `;
        })
        .join("");

      cards.querySelectorAll(".performance-semester-card").forEach((button) => {
        button.addEventListener("click", () => {
          setSelectedSemester(button.dataset.semester);
        });
      });
    }
  }
}

function setSelectedSemester(semester) {
  state.selectedSemester = semester || null;
  renderPerformance();
}

function getSelectedResult() {
  if (!state.selectedSemester) return null;
  return (
    state.results.find((result) => result.semester === state.selectedSemester) ||
    null
  );
}

function getSemesterSummary(semester) {
  return (
    state.semesterSummaries.find((summary) => summary.semester === semester) ||
    null
  );
}

function getSelectedSemesterSummary() {
  if (!state.selectedSemester) return null;
  return getSemesterSummary(state.selectedSemester);
}

function getVisibleSemesterSummaries() {
  const selectedSummary = getSelectedSemesterSummary();
  return selectedSummary ? [selectedSummary] : [];
}

function togglePerformanceContent(isVisible) {
  [
    ".metrics-grid",
    ".highlight-grid",
    ".chart-grid",
    ".detail-grid",
    '[aria-labelledby="semesterAnalysisTitle"]',
    '[aria-labelledby="subjectAnalysisTitle"]',
  ].forEach((selector) => {
    document.querySelectorAll(selector).forEach((element) => {
      element.hidden = !isVisible;
    });
  });
}

function renderSemesterSelectionMessage(message) {
  const element = document.getElementById("semesterSelectionMessage");
  if (!element) return;

  const text =
    message ||
    (state.selectedSemester
      ? ""
      : "Please select a semester to view performance details.");

  element.textContent = text;
  element.hidden = !text;
}

function destroyCharts() {
  Object.values(state.charts).forEach((chart) => chart?.destroy?.());
  state.charts = {};
}

function renderPerformance() {
  renderSemesterSelector();

  const selectedResult = getSelectedResult();
  const contextResult = selectedResult || state.results[state.results.length - 1];

  setText("studentContext", buildStudentContext(contextResult));
  setText("profileName", contextResult?.studentName || window.LearnLyticsAuth?.getDisplayName());
  setText("profileMeta", contextResult?.regNo || window.LearnLyticsAuth?.getAcademicMeta());

  if (!selectedResult) {
    state.subjects = [];
    togglePerformanceContent(false);
    renderSemesterSelectionMessage();
    renderBeuStatus(null);
    destroyCharts();

    if (window.lucide) {
      lucide.createIcons();
    }

    return;
  }

  state.subjects = selectedResult.subjects;
  const summary = buildOverallSummary();

  togglePerformanceContent(true);
  renderSemesterSelectionMessage("");
  renderBeuStatus(summary);
  renderMetricCards(summary);
  renderGradeCategoryTable(summary.gradeCounts);
  renderPassFailSummary(summary);
  renderSubjectLists(summary);
  renderSemesterAnalysis();
  renderSubjectPerformance();
  renderCharts(summary);

  if (window.lucide) {
    lucide.createIcons();
  }
}

function buildStudentContext(result) {
  if (!result) return "No uploaded result data";

  const semesterCount = state.results.length;
  const base = `${result.studentName} - ${result.regNo || "No registration number"}`;

  if (state.selectedSemester) {
    return `${base} - Semester ${state.selectedSemester} selected`;
  }

  return `${base} - ${semesterCount} uploaded semester${semesterCount === 1 ? "" : "s"}`;
}

function buildOverallSummary() {
  const subjects = state.subjects;
  const totalSubjects = subjects.length;
  const passedSubjects = subjects.filter((subject) => subject.status === "PASS");
  const failedSubjects = subjects.filter((subject) => subject.status === "FAIL");
  const gradeCounts = BEU_GRADES.reduce((counts, item) => {
    counts[item.grade] = 0;
    return counts;
  }, {});

  subjects.forEach((subject) => {
    gradeCounts[subject.grade] = (gradeCounts[subject.grade] || 0) + 1;
  });

  const totalCredits = sum(subjects, (subject) => subject.credit);
  const weightedPoints = sum(
    subjects,
    (subject) => subject.credit * subject.gradePoint
  );
  const selectedSummary = getSelectedSemesterSummary();
  const highestGrade = BEU_GRADES.find((item) => gradeCounts[item.grade] > 0)?.grade;
  const lowestGrade = [...BEU_GRADES]
    .reverse()
    .find((item) => gradeCounts[item.grade] > 0)?.grade;

  return {
    totalSubjects,
    passedSubjects,
    failedSubjects,
    passPercentage: totalSubjects ? (passedSubjects.length / totalSubjects) * 100 : 0,
    gradeCounts,
    totalCredits,
    calculatedSgpa: selectedSummary?.sgpa ?? (totalCredits > 0 ? weightedPoints / totalCredits : null),
    calculatedCgpa: selectedSummary?.cgpa ?? null,
    highestGrade: highestGrade || "--",
    lowestGrade: lowestGrade || "--",
    bestSubject: getBestSubject(subjects),
    weakestSubject: getWeakestSubject(subjects),
  };
}

function renderBeuStatus(summary) {
  const chip = document.getElementById("beuStatus");
  if (!chip) return;

  if (!summary || !summary.totalSubjects) {
    const pendingText = state.results.length
      ? state.selectedSemester
        ? "No Subjects"
        : "Select Semester"
      : "No Results";

    chip.className = "result-chip pending";
    chip.innerHTML = `
      <i data-lucide="activity"></i>
      <span>${pendingText}</span>
    `;
    return;
  }

  const hasFailures = summary.failedSubjects.length > 0;
  chip.className = `result-chip ${hasFailures ? "fail" : "pass"}`;
  chip.innerHTML = `
    <i data-lucide="${hasFailures ? "circle-x" : "circle-check"}"></i>
    <span>${hasFailures ? "BEU Status: Fail" : "BEU Status: Pass"}</span>
  `;
}

function renderMetricCards(summary) {
  setText("metricTotalSubjects", summary.totalSubjects);
  setText("metricPassedSubjects", summary.passedSubjects.length);
  setText("metricFailedSubjects", summary.failedSubjects.length);
  setText("metricPassPercentage", formatPercent(summary.passPercentage));
  setText("metricCalculatedSgpa", formatGpa(summary.calculatedSgpa));
  setText("metricCalculatedCgpa", formatGpa(summary.calculatedCgpa));
  setText("metricHighestGrade", summary.highestGrade);
  setText("metricLowestGrade", summary.lowestGrade);
  setText("metricCreditsEvaluated", formatNumber(summary.totalCredits));

  renderSubjectHighlight(
    "metricBestSubject",
    "metricBestSubjectMeta",
    summary.bestSubject
  );
  renderSubjectHighlight(
    "metricWeakestSubject",
    "metricWeakestSubjectMeta",
    summary.weakestSubject
  );
}

function renderSubjectHighlight(titleId, metaId, subject) {
  if (!subject) {
    setText(titleId, "--");
    setText(metaId, "--");
    return;
  }

  setText(titleId, subject.subjectName);
  setText(
    metaId,
    `Semester ${subject.semester} - ${subject.subjectCode} - ${formatPercent(subject.percentage)} - Grade ${subject.grade}`
  );
}

function renderGradeCategoryTable(gradeCounts) {
  const body = document.getElementById("gradeCategoryTable");
  if (!body) return;

  body.innerHTML = BEU_GRADES.map(
    (item) => `
      <tr>
        <td><span class="grade-badge grade-${escapeClass(item.grade)}">${escapeHtml(item.grade)}</span></td>
        <td>${escapeHtml(item.range)}</td>
        <td>${item.point}</td>
        <td>${gradeCounts[item.grade] || 0}</td>
      </tr>
    `
  ).join("");
}

function renderPassFailSummary(summary) {
  setText("summaryPassedSubjects", summary.passedSubjects.length);
  setText("summaryFailedSubjects", summary.failedSubjects.length);
  setText("summaryPassPercentage", formatPercent(summary.passPercentage));
}

function renderSubjectLists(summary) {
  renderSubjectChipList(
    "passSubjectList",
    summary.passedSubjects,
    "No passed subjects found."
  );
  renderSubjectChipList(
    "failSubjectList",
    summary.failedSubjects,
    "No failed subjects found."
  );
}

function renderSubjectChipList(id, subjects, emptyText) {
  const container = document.getElementById(id);
  if (!container) return;

  if (!subjects.length) {
    container.innerHTML = `<span class="empty-note">${escapeHtml(emptyText)}</span>`;
    return;
  }

  container.innerHTML = subjects
    .map(
      (subject) => `
        <span class="subject-chip ${subject.status.toLowerCase()}">
          S${escapeHtml(subject.semester)} ${escapeHtml(subject.subjectCode)}
          <strong>${escapeHtml(subject.grade)}</strong>
        </span>
      `
    )
    .join("");
}

function renderSemesterAnalysis() {
  const body = document.getElementById("semesterPerformanceBody");
  if (!body) return;

  const summaries = getVisibleSemesterSummaries();

  if (!summaries.length) {
    body.innerHTML = `
      <tr class="empty-row">
        <td colspan="7">No semester data available.</td>
      </tr>
    `;
    return;
  }

  body.innerHTML = summaries
    .map(
      (summary) => `
        <tr>
          <td>Semester ${escapeHtml(summary.semester)}</td>
          <td>${formatPercent(summary.averagePercentage)}</td>
          <td>${formatGpa(summary.sgpa)}</td>
          <td>${formatGpa(summary.cgpa)}</td>
          <td>${formatCompactSubject(summary.bestSubject)}</td>
          <td>${formatCompactSubject(summary.weakestSubject)}</td>
          <td>${formatPercent(summary.passRate)}</td>
        </tr>
      `
    )
    .join("");
}

function renderSubjectPerformance() {
  const body = document.getElementById("subjectPerformanceBody");
  if (!body) return;

  if (!state.subjects.length) {
    body.innerHTML = `
      <tr class="empty-row">
        <td colspan="10">No result data available.</td>
      </tr>
    `;
    return;
  }

  body.innerHTML = state.subjects
    .map(
      (subject) => `
        <tr class="${subject.status === "FAIL" ? "failed-row" : ""}">
          <td>Semester ${escapeHtml(subject.semester)}</td>
          <td>${escapeHtml(subject.subjectCode)}</td>
          <td class="subject-name">${escapeHtml(subject.subjectName)}</td>
          <td><span class="type-badge ${subject.type.toLowerCase()}">${escapeHtml(subject.type)}</span></td>
          <td>${formatPercent(subject.percentage)}</td>
          <td>${formatNumber(subject.ese)} / ${formatNumber(subject.eseThreshold)}</td>
          <td><span class="grade-badge grade-${escapeClass(subject.grade)}">${escapeHtml(subject.grade)}</span></td>
          <td>${formatNumber(subject.gradePoint)}</td>
          <td>${formatNumber(subject.credit)}</td>
          <td>
            <span class="status-badge ${subject.status.toLowerCase()}">${escapeHtml(subject.status)}</span>
            <small>${escapeHtml(subject.conditionReason)}</small>
          </td>
        </tr>
      `
    )
    .join("");
}

function renderCharts(summary) {
  if (!window.Chart) return;

  const gradeLabels = BEU_GRADES.map((item) => item.grade);
  const gradeColors = BEU_GRADES.map((item) => item.color);
  const gradeValues = BEU_GRADES.map((item) => summary.gradeCounts[item.grade] || 0);
  const semesterSummaries = getVisibleSemesterSummaries();
  const semesterLabels = semesterSummaries.map(
    (item) => `Sem ${item.semester}`
  );

  renderChart("gradeDistributionChart", "bar", {
    labels: gradeLabels,
    datasets: [
      {
        label: "Subjects",
        data: gradeValues,
        backgroundColor: gradeColors,
        borderRadius: 6,
      },
    ],
  });

  renderChart(
    "gradePieChart",
    "doughnut",
    {
      labels: gradeLabels,
      datasets: [
        {
          data: gradeValues,
          backgroundColor: gradeColors,
          borderColor: "#ffffff",
          borderWidth: 3,
        },
      ],
    },
    { cutout: "58%" }
  );

  renderChart(
    "sgpaTrendChart",
    "line",
    {
      labels: semesterLabels,
      datasets: [
        {
          label: "SGPA",
          data: semesterSummaries.map((item) => round(item.sgpa)),
          borderColor: "#2563eb",
          backgroundColor: "rgba(37, 99, 235, 0.12)",
          pointBackgroundColor: "#2563eb",
          borderWidth: 3,
          tension: 0.35,
          fill: true,
        },
      ],
    },
    { yMax: 10 }
  );

  renderChart(
    "cgpaProgressChart",
    "line",
    {
      labels: semesterLabels,
      datasets: [
        {
          label: "CGPA",
          data: semesterSummaries.map((item) => round(item.cgpa)),
          borderColor: "#059669",
          backgroundColor: "rgba(5, 150, 105, 0.12)",
          pointBackgroundColor: "#059669",
          borderWidth: 3,
          tension: 0.35,
          fill: true,
        },
      ],
    },
    { yMax: 10 }
  );

  renderChart(
    "semesterPercentageChart",
    "bar",
    {
      labels: semesterLabels,
      datasets: [
        {
          label: "Average Percentage",
          data: semesterSummaries.map((item) =>
            round(item.averagePercentage)
          ),
          backgroundColor: "#7c3aed",
          borderRadius: 6,
        },
      ],
    },
    { yMax: 100 }
  );
}

function renderChart(id, type, data, overrides = {}) {
  const canvas = document.getElementById(id);
  if (!canvas) return;

  if (state.charts[id]) {
    state.charts[id].destroy();
  }

  const isCircular = type === "pie" || type === "doughnut";
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: overrides.cutout,
    plugins: {
      legend: {
        position: isCircular ? "bottom" : "top",
        labels: {
          color: "#374151",
          boxWidth: 12,
          font: {
            family: "Inter",
            weight: "700",
          },
        },
      },
    },
  };

  if (!isCircular) {
    options.scales = {
      y: {
        beginAtZero: true,
        max: overrides.yMax,
        grid: {
          color: "#eef2f7",
        },
        ticks: {
          color: "#64748b",
          precision: 0,
        },
      },
      x: {
        grid: {
          display: false,
        },
        ticks: {
          color: "#64748b",
        },
      },
    };
  }

  state.charts[id] = new Chart(canvas, {
    type,
    data,
    options,
  });
}

function renderEmptyState(message) {
  const user = window.LearnLyticsAuth?.getUser();

  setText("studentContext", message);
  setText("profileName", window.LearnLyticsAuth?.getDisplayName(user));
  setText("profileMeta", user ? window.LearnLyticsAuth?.getAcademicMeta(user, "No results") : "No results");

  const emptySummary = {
    totalSubjects: 0,
    passedSubjects: [],
    failedSubjects: [],
    passPercentage: 0,
    gradeCounts: BEU_GRADES.reduce((counts, item) => {
      counts[item.grade] = 0;
      return counts;
    }, {}),
    totalCredits: 0,
    calculatedSgpa: null,
    calculatedCgpa: null,
    highestGrade: "--",
    lowestGrade: "--",
    bestSubject: null,
    weakestSubject: null,
  };

  state.subjects = [];
  state.allSubjects = [];
  state.semesterSummaries = [];
  state.selectedSemester = null;

  renderSemesterSelector();
  togglePerformanceContent(false);
  renderSemesterSelectionMessage(message);
  renderBeuStatus(emptySummary);
  renderMetricCards(emptySummary);
  renderGradeCategoryTable(emptySummary.gradeCounts);
  renderPassFailSummary(emptySummary);
  renderSubjectLists(emptySummary);
  renderSemesterAnalysis();
  renderSubjectPerformance();
  destroyCharts();

  if (window.lucide) {
    lucide.createIcons();
  }
}

function getBestSubject(subjects) {
  return [...subjects].sort((a, b) => b.percentage - a.percentage)[0] || null;
}

function getWeakestSubject(subjects) {
  return [...subjects].sort((a, b) => a.percentage - b.percentage)[0] || null;
}

function formatCompactSubject(subject) {
  if (!subject) return "--";
  return `${escapeHtml(subject.subjectCode)} (${formatPercent(subject.percentage)})`;
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

function sum(items, selector) {
  return items.reduce((total, item) => {
    const value = Number(selector(item));
    return Number.isFinite(value) ? total + value : total;
  }, 0);
}

function average(items, selector) {
  if (!items.length) return 0;
  return sum(items, selector) / items.length;
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

function clamp(value, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) return min;
  return Math.min(Math.max(number, min), max);
}

function round(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.round(number * 100) / 100 : null;
}

function formatGpa(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number.toFixed(2) : "N/A";
}

function formatPercent(value) {
  const number = Number(value);
  return Number.isFinite(number) ? `${number.toFixed(1)}%` : "N/A";
}

function formatNumber(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "--";
  return Number.isInteger(number) ? String(number) : number.toFixed(1);
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (!el) return;

  el.textContent =
    value === undefined || value === null || value === "" ? "--" : value;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeClass(value) {
  return String(value || "empty")
    .toLowerCase()
    .replace("+", "plus")
    .replace(/[^a-z0-9_-]/g, "");
}
