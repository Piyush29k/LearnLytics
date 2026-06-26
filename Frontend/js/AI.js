const API_BASE_URL = "http://localhost:5000/api/results";
const HISTORY_KEY_PREFIX = "learnlytics_ai_chat_history";

const GRADE_POINTS = {
  "A+": 10,
  A: 9,
  B: 8,
  C: 7,
  D: 6,
  P: 5,
  F: 0,
};

const GRADE_ORDER = ["A+", "A", "B", "C", "D", "P", "F"];

const state = {
  currentRegNo: null,
  results: [],
  subjects: [],
  summary: null,
  history: [],
  selectedPdf: null,
  recognition: null,
  charts: {},
};

document.addEventListener("DOMContentLoaded", initAiAssistant);

window.addEventListener("load", () => {
  const loader = document.getElementById("loader");
  if (loader) {
    setTimeout(() => loader.classList.add("hide"), 700);
  }
});

async function initAiAssistant() {
  if (!window.LearnLyticsAuth?.requireSession("student")) {
    return;
  }

  window.LearnLyticsAuth.syncUserDisplay();

  setupSidebar();
  setupEvents();
  loadHistory();
  renderChatHistory();
  renderHistoryList();
  await loadAcademicData();
  ensureWelcomeMessage();
  refreshIcons();
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

function setupEvents() {
  const chatForm = document.getElementById("chatForm");
  const chatInput = document.getElementById("chatInput");
  const refreshDataBtn = document.getElementById("refreshDataBtn");
  const clearChatBtn = document.getElementById("clearChatBtn");
  const compareA = document.getElementById("compareSemesterA");
  const compareB = document.getElementById("compareSemesterB");
  const aiPdfUpload = document.getElementById("aiPdfUpload");
  const explainPdfBtn = document.getElementById("explainPdfBtn");
  const voiceBtn = document.getElementById("voiceBtn");

  chatForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    const question = chatInput?.value.trim();
    if (!question) return;

    submitQuestion(question);
    chatInput.value = "";
  });

  document.querySelectorAll(".quick-actions button").forEach((button) => {
    button.addEventListener("click", () => {
      submitQuestion(button.dataset.query || button.textContent.trim());
    });
  });

  refreshDataBtn?.addEventListener("click", async () => {
    await loadAcademicData();
    addMessage("assistant", "Academic data refreshed. I am using the latest uploaded semester records.");
  });

  clearChatBtn?.addEventListener("click", () => {
    state.history = [];
    saveHistory();
    renderChatHistory();
    renderHistoryList();
    ensureWelcomeMessage();
  });

  compareA?.addEventListener("change", renderComparison);
  compareB?.addEventListener("change", renderComparison);

  aiPdfUpload?.addEventListener("change", () => {
    state.selectedPdf = aiPdfUpload.files?.[0] || null;
    setText("uploadLabel", state.selectedPdf ? state.selectedPdf.name : "Upload Result PDF");
  });

  explainPdfBtn?.addEventListener("click", explainSelectedPdf);
  voiceBtn?.addEventListener("click", startVoiceInput);

  document.getElementById("historyList")?.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-query]");
    if (!button) return;
    if (chatInput) {
      chatInput.value = button.dataset.query;
      chatInput.focus();
    }
  });
}

async function loadAcademicData() {
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

    const sourceResults = latestResult
      ? [...studentResults, latestResult]
      : studentResults;

    state.results = getLatestResultPerSemester(sourceResults)
      .map(normalizeResult)
      .filter((result) => result.semester !== "N/A" && result.subjects.length)
      .sort(compareSemesters);

    state.subjects = state.results.flatMap((result) => result.subjects);
    state.summary = buildAcademicSummary();

    renderDashboard();
    renderInsightPanels();
    renderComparisonControls();
    renderComparison();
    renderCharts();
  } catch (error) {
    console.error("AI assistant data load error:", error.message);
    state.results = [];
    state.subjects = [];
    state.summary = buildAcademicSummary();
    renderDashboard();
    renderInsightPanels();
    renderComparisonControls();
    renderComparison();
    destroyCharts();
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
  const semester = normalizeSemester(result?.semester);
  const rawSubjects = Array.isArray(result?.subjects) ? result.subjects : [];
  const subjects = rawSubjects.map((subject) => normalizeSubject(subject, semester));
  const creditsEarned =
    toNullableNumber(result?.creditsEarned) ?? sum(subjects, (subject) => subject.credit);

  return {
    studentName: result?.studentName || "Student",
    regNo: result?.regNo || "",
    semester,
    sgpa: toNullableNumber(result?.sgpa),
    cgpa: toNullableNumber(result?.cgpa),
    creditsEarned,
    resultStatus: normalizeResultStatus(result?.resultStatus, subjects),
    subjects,
  };
}

function normalizeSubject(subject, semester) {
  const subjectCode = String(subject?.subjectCode || "").trim().toUpperCase();
  const subjectName = String(subject?.subjectName || "Untitled Subject").trim();
  const type = normalizeType(subjectCode, subject?.type, subjectName);
  const ese = toNullableNumber(subject?.ese ?? subject?.theory ?? subject?.theoryMarks);
  const ia = toNullableNumber(subject?.ia ?? subject?.practical ?? subject?.practicalMarks);
  const total = toNumber(subject?.total, (ese ?? 0) + (ia ?? 0));
  const maxMarks = getMaxMarks(type, total);
  const percentage = maxMarks > 0 ? clamp((total / maxMarks) * 100, 0, 100) : 0;
  const grade = normalizeGrade(subject?.grade) || inferGrade(percentage);
  const status = normalizeSubjectStatus(subject?.status, grade);

  return {
    semester,
    subjectCode,
    subjectName,
    type,
    ese,
    ia,
    total,
    maxMarks,
    percentage,
    credit: toNumber(subject?.credit),
    grade,
    gradePoint: GRADE_POINTS[grade] ?? 0,
    status,
    baseCode: subjectCode.replace(/P$/i, ""),
  };
}

function buildAcademicSummary() {
  const results = state.results;
  const subjects = state.subjects;

  if (!results.length) {
    return {
      hasData: false,
      studentName: "Student",
      regNo: "",
      currentResult: null,
      currentCgpa: null,
      averageSgpa: null,
      highestSemester: null,
      lowestSemester: null,
      totalCredits: 0,
      passedSubjects: [],
      failedSubjects: [],
      gradeDistribution: buildGradeDistribution([]),
      bestSubject: null,
      weakestSubject: null,
      highestMarksSubject: null,
      lowestMarksSubject: null,
      theoryAverage: null,
      practicalAverage: null,
      semesterSummaries: [],
      insights: ["No uploaded semester records were found."],
      recommendations: ["Upload result PDFs from the Semester page or use the PDF upload here."],
      prediction: null,
    };
  }

  const semesterSummaries = buildSemesterSummaries(results);
  const currentResult = results[results.length - 1];
  const sgpaValues = semesterSummaries
    .map((summary) => summary.sgpa)
    .filter((value) => Number.isFinite(value));
  const totalCredits = sum(results, (result) => result.creditsEarned);
  const weightedCgpaPoints = sum(results, (result) =>
    Number.isFinite(result.sgpa) ? result.sgpa * result.creditsEarned : 0
  );
  const currentCgpa =
    currentResult.cgpa ??
    (totalCredits > 0 ? weightedCgpaPoints / totalCredits : null);

  const passedSubjects = subjects.filter((subject) => subject.status === "PASS");
  const failedSubjects = subjects.filter((subject) => subject.status === "FAIL");
  const highestSemester = maxBy(semesterSummaries, (summary) => summary.sgpa);
  const lowestSemester = minBy(semesterSummaries, (summary) => summary.sgpa);
  const bestSubject = maxBy(subjects, (subject) => subject.percentage);
  const weakestSubject = minBy(subjects, (subject) => subject.percentage);
  const highestMarksSubject = maxBy(subjects, (subject) => subject.total);
  const lowestMarksSubject = minBy(subjects, (subject) => subject.total);
  const theorySubjects = subjects.filter((subject) => subject.type === "THEORY");
  const practicalSubjects = subjects.filter((subject) => subject.type === "PRACTICAL");
  const summary = {
    hasData: true,
    studentName: currentResult.studentName,
    regNo: currentResult.regNo,
    currentResult,
    currentCgpa,
    averageSgpa: average(sgpaValues, (value) => value),
    highestSemester,
    lowestSemester,
    totalCredits,
    passedSubjects,
    failedSubjects,
    gradeDistribution: buildGradeDistribution(subjects),
    bestSubject,
    weakestSubject,
    highestMarksSubject,
    lowestMarksSubject,
    theoryAverage: average(theorySubjects, (subject) => subject.percentage),
    practicalAverage: average(practicalSubjects, (subject) => subject.percentage),
    semesterSummaries,
    prediction: null,
    insights: [],
    recommendations: [],
  };

  summary.prediction = buildPrediction(summary);
  summary.insights = buildInsights(summary);
  summary.recommendations = buildRecommendations(summary);

  return summary;
}

function buildSemesterSummaries(results) {
  let cumulativeCredits = 0;
  let cumulativeWeightedPoints = 0;

  return results.map((result) => {
    const averagePercentage = average(result.subjects, (subject) => subject.percentage);
    const credits = result.creditsEarned || sum(result.subjects, (subject) => subject.credit);
    const subjectCredits = sum(result.subjects, (subject) => subject.credit);
    const calculatedSgpa =
      subjectCredits > 0
        ? sum(result.subjects, (subject) => subject.gradePoint * subject.credit) /
          subjectCredits
        : null;
    const sgpa = result.sgpa ?? calculatedSgpa;

    if (credits > 0 && Number.isFinite(sgpa)) {
      cumulativeCredits += credits;
      cumulativeWeightedPoints += sgpa * credits;
    }

    return {
      semester: result.semester,
      sgpa,
      cgpa:
        result.cgpa ??
        (cumulativeCredits > 0
          ? cumulativeWeightedPoints / cumulativeCredits
          : null),
      credits,
      averagePercentage,
      passed: result.subjects.filter((subject) => subject.status === "PASS").length,
      failed: result.subjects.filter((subject) => subject.status === "FAIL").length,
      bestSubject: maxBy(result.subjects, (subject) => subject.percentage),
      weakestSubject: minBy(result.subjects, (subject) => subject.percentage),
    };
  });
}

function buildGradeDistribution(subjects) {
  const distribution = GRADE_ORDER.reduce((counts, grade) => {
    counts[grade] = 0;
    return counts;
  }, {});

  subjects.forEach((subject) => {
    if (distribution[subject.grade] !== undefined) {
      distribution[subject.grade] += 1;
    }
  });

  return distribution;
}

function buildInsights(summary) {
  if (!summary.hasData) return summary.insights;

  const insights = [];
  const semesters = summary.semesterSummaries;
  const sgpas = semesters.map((semester) => semester.sgpa).filter(Number.isFinite);

  if (sgpas.length >= 2) {
    const latest = sgpas[sgpas.length - 1];
    const previous = sgpas[sgpas.length - 2];
    const consistentlyImproved = sgpas.every(
      (value, index) => index === 0 || value >= sgpas[index - 1]
    );

    if (consistentlyImproved) {
      insights.push("Your SGPA has improved consistently across uploaded semesters.");
    } else if (latest < previous) {
      insights.push(
        `Your performance declined by ${formatGpa(previous - latest)} SGPA points in the latest semester.`
      );
    } else {
      insights.push(
        `Your latest semester improved by ${formatGpa(latest - previous)} SGPA points.`
      );
    }
  }

  if (summary.highestSemester) {
    insights.push(
      `Semester ${summary.highestSemester.semester} is your best semester with SGPA ${formatGpa(summary.highestSemester.sgpa)}.`
    );
  }

  if (
    Number.isFinite(summary.practicalAverage) &&
    Number.isFinite(summary.theoryAverage)
  ) {
    if (summary.practicalAverage - summary.theoryAverage >= 6) {
      insights.push("Practical subjects are stronger than theory subjects.");
    } else if (summary.theoryAverage - summary.practicalAverage >= 6) {
      insights.push("Theory subjects are currently stronger than practical subjects.");
    } else {
      insights.push("Theory and practical performance are closely balanced.");
    }
  }

  const mathSubjects = state.subjects.filter((subject) =>
    /MATH|MATHEMATICS/i.test(subject.subjectName)
  );

  if (mathSubjects.length) {
    const mathAverage = average(mathSubjects, (subject) => subject.percentage);
    if (mathAverage < average(state.subjects, (subject) => subject.percentage)) {
      insights.push("Mathematics needs extra attention compared with your overall subject average.");
    }
  }

  if (!summary.failedSubjects.length) {
    insights.push("All uploaded subjects are currently passing.");
  } else {
    insights.push(`${summary.failedSubjects.length} subject needs urgent recovery planning.`);
  }

  return insights.slice(0, 6);
}

function buildRecommendations(summary) {
  if (!summary.hasData) return summary.recommendations;

  const recommendations = [];
  const weakSubjects = getWeakSubjects().slice(0, 3);

  if (weakSubjects.length) {
    recommendations.push(
      `Prioritize ${weakSubjects.map((subject) => subject.subjectName).join(", ")} for the next study cycle.`
    );
  }

  if (
    Number.isFinite(summary.theoryAverage) &&
    Number.isFinite(summary.practicalAverage) &&
    summary.theoryAverage < summary.practicalAverage
  ) {
    recommendations.push("Use more written practice for theory papers and revise previous exam questions weekly.");
  }

  const target = 8.5;
  const targetPlan = calculateRequiredSgpa(target);
  if (targetPlan && targetPlan.requiredSgpa > 0) {
    recommendations.push(
      `To target ${formatGpa(target)} CGPA after one more semester, aim near SGPA ${formatGpa(targetPlan.requiredSgpa)}.`
    );
  }

  recommendations.push("Reserve fixed weekly slots for the two lowest-scoring subjects before revising stronger areas.");

  if (summary.bestSubject) {
    recommendations.push(
      `Keep your strength in ${summary.bestSubject.subjectName} active with short revision sessions.`
    );
  }

  return recommendations.slice(0, 5);
}

function buildPrediction(summary) {
  const sgpas = summary.semesterSummaries
    .map((semester) => semester.sgpa)
    .filter(Number.isFinite);

  if (!sgpas.length || !Number.isFinite(summary.currentCgpa)) {
    return null;
  }

  const recentSgpas = sgpas.slice(-3);
  const averageRecentSgpa = average(recentSgpas, (value) => value);
  const averageChange =
    sgpas.length > 1
      ? average(
          sgpas.slice(1).map((value, index) => value - sgpas[index]),
          (value) => value
        )
      : 0;
  const expectedSgpa = clamp(averageRecentSgpa + averageChange * 0.5, 0, 10);
  const nextCredits =
    average(summary.semesterSummaries, (semester) => semester.credits) || 24;
  const expectedCgpa =
    summary.totalCredits > 0
      ? (summary.currentCgpa * summary.totalCredits + expectedSgpa * nextCredits) /
        (summary.totalCredits + nextCredits)
      : expectedSgpa;

  return {
    expectedSgpa,
    expectedCgpa,
    nextCredits,
    trend:
      averageChange > 0.1
        ? "upward"
        : averageChange < -0.1
          ? "downward"
          : "steady",
  };
}

function renderDashboard() {
  const summary = state.summary;

  if (!summary?.hasData) {
    const user = window.LearnLyticsAuth?.getUser();

    setText("studentContext", "No uploaded result data found");
    setText("profileName", window.LearnLyticsAuth?.getDisplayName(user));
    setText("profileMeta", user ? window.LearnLyticsAuth?.getAcademicMeta(user, "Academic profile") : "Academic profile");
    setText("sidebarCgpa", "CGPA --");
    setText("sidebarStatus", "Waiting for uploaded result data");
    setText("statCgpa", "--");
    setText("statCgpaMeta", "No result loaded");
    setText("statAverageSgpa", "--");
    setText("statSgpaRange", "Range --");
    setText("statCredits", "--");
    setText("statPassFail", "Pass -- / Fail --");
    setText("statBestSemester", "--");
    setText("statBestSemesterMeta", "SGPA --");
    setText("statBestSubject", "--");
    setText("statBestSubjectMeta", "--");
    setText("statTopGrade", "--");
    setText("statGradeMeta", "No grades found");
    return;
  }

  const topGrade = getTopGrade(summary.gradeDistribution);
  const latest = summary.currentResult;

  setText(
    "studentContext",
    `${summary.studentName} - ${summary.regNo || "No registration number"} - ${state.results.length} uploaded semester${state.results.length === 1 ? "" : "s"}`
  );
  setText("profileName", summary.studentName);
  setText("profileMeta", summary.regNo || "Student");
  setText("sidebarCgpa", `CGPA ${formatGpa(summary.currentCgpa)}`);
  setText("sidebarStatus", `Latest semester ${latest.semester} - SGPA ${formatGpa(latest.sgpa)}`);
  setText("statCgpa", formatGpa(summary.currentCgpa));
  setText("statCgpaMeta", `Latest SGPA ${formatGpa(latest.sgpa)}`);
  setText("statAverageSgpa", formatGpa(summary.averageSgpa));
  setText(
    "statSgpaRange",
    `High ${formatGpa(summary.highestSemester?.sgpa)} / Low ${formatGpa(summary.lowestSemester?.sgpa)}`
  );
  setText("statCredits", formatNumber(summary.totalCredits));
  setText(
    "statPassFail",
    `Pass ${summary.passedSubjects.length} / Fail ${summary.failedSubjects.length}`
  );
  setText(
    "statBestSemester",
    summary.highestSemester ? `Semester ${summary.highestSemester.semester}` : "--"
  );
  setText(
    "statBestSemesterMeta",
    summary.highestSemester ? `SGPA ${formatGpa(summary.highestSemester.sgpa)}` : "SGPA --"
  );
  setText("statBestSubject", summary.bestSubject?.subjectName || "--");
  setText(
    "statBestSubjectMeta",
    summary.bestSubject
      ? `Semester ${summary.bestSubject.semester} - ${formatPercent(summary.bestSubject.percentage)}`
      : "--"
  );
  setText("statTopGrade", topGrade ? topGrade.grade : "--");
  setText(
    "statGradeMeta",
    topGrade ? `${topGrade.count} subject${topGrade.count === 1 ? "" : "s"}` : "No grades found"
  );
}

function renderInsightPanels() {
  renderList("insightList", state.summary?.insights || []);
  renderList("recommendationList", state.summary?.recommendations || []);
  setText("predictionText", buildPredictionText());
}

function renderComparisonControls() {
  const compareA = document.getElementById("compareSemesterA");
  const compareB = document.getElementById("compareSemesterB");
  if (!compareA || !compareB) return;

  const options = state.results
    .map(
      (result) =>
        `<option value="${escapeHtml(result.semester)}">Semester ${escapeHtml(result.semester)}</option>`
    )
    .join("");

  compareA.innerHTML = options || '<option value="">No semester</option>';
  compareB.innerHTML = options || '<option value="">No semester</option>';

  if (state.results.length) {
    compareA.value = state.results[0].semester;
    compareB.value = state.results[state.results.length - 1].semester;
  }
}

function renderComparison() {
  const compareA = document.getElementById("compareSemesterA");
  const compareB = document.getElementById("compareSemesterB");
  const summaryEl = document.getElementById("comparisonSummary");
  const body = document.getElementById("subjectComparisonBody");
  const headerA = document.getElementById("subjectCompareA");
  const headerB = document.getElementById("subjectCompareB");

  if (!summaryEl || !body || !compareA || !compareB) return;

  const first = getResultBySemester(compareA.value);
  const second = getResultBySemester(compareB.value);

  if (headerA) setText("subjectCompareA", first ? `Semester ${first.semester}` : "Semester A");
  if (headerB) setText("subjectCompareB", second ? `Semester ${second.semester}` : "Semester B");

  if (!first || !second) {
    summaryEl.innerHTML = '<div class="empty-state">Upload at least one semester result to compare.</div>';
    body.innerHTML = '<tr><td colspan="4">No comparison data available.</td></tr>';
    return;
  }

  const firstCredits = first.creditsEarned || sum(first.subjects, (subject) => subject.credit);
  const secondCredits = second.creditsEarned || sum(second.subjects, (subject) => subject.credit);
  const sgpaDifference = (second.sgpa ?? 0) - (first.sgpa ?? 0);
  const creditDifference = secondCredits - firstCredits;
  const improvement =
    Number.isFinite(first.sgpa) && first.sgpa > 0
      ? (sgpaDifference / first.sgpa) * 100
      : null;

  summaryEl.innerHTML = `
    <div class="compare-metric">
      <span>SGPA Difference</span>
      <strong>${formatSignedGpa(sgpaDifference)}</strong>
    </div>
    <div class="compare-metric">
      <span>Credit Difference</span>
      <strong>${formatSignedNumber(creditDifference)}</strong>
    </div>
    <div class="compare-metric">
      <span>Improvement</span>
      <strong>${formatSignedPercent(improvement)}</strong>
    </div>
    <div class="compare-metric">
      <span>Result</span>
      <strong>${sgpaDifference >= 0 ? "Improved" : "Declined"}</strong>
    </div>
  `;

  body.innerHTML = buildSubjectComparisonRows(first, second);
}

function buildSubjectComparisonRows(first, second) {
  const rows = [];
  const firstMap = buildSubjectCompareMap(first.subjects);
  const secondMap = buildSubjectCompareMap(second.subjects);
  const keys = Array.from(new Set([...firstMap.keys(), ...secondMap.keys()]));

  keys.forEach((key) => {
    const firstSubject = firstMap.get(key);
    const secondSubject = secondMap.get(key);
    const label = secondSubject?.subjectName || firstSubject?.subjectName || key;
    const difference =
      firstSubject && secondSubject
        ? secondSubject.percentage - firstSubject.percentage
        : null;

    rows.push(`
      <tr>
        <td>${escapeHtml(label)}</td>
        <td>${firstSubject ? `${formatPercent(firstSubject.percentage)} (${escapeHtml(firstSubject.grade)})` : "--"}</td>
        <td>${secondSubject ? `${formatPercent(secondSubject.percentage)} (${escapeHtml(secondSubject.grade)})` : "--"}</td>
        <td>${difference === null ? "--" : formatSignedPercent(difference)}</td>
      </tr>
    `);
  });

  return rows.length
    ? rows.join("")
    : '<tr><td colspan="4">No subject data available.</td></tr>';
}

function buildSubjectCompareMap(subjects) {
  const map = new Map();

  subjects.forEach((subject) => {
    const key = normalizeSubjectKey(subject);
    map.set(key, subject);
  });

  return map;
}

function normalizeSubjectKey(subject) {
  const codeKey = subject.baseCode || subject.subjectCode;
  if (codeKey) return codeKey;

  return subject.subjectName.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

function renderCharts() {
  if (!window.Chart || !state.summary?.hasData) {
    destroyCharts();
    return;
  }

  renderChart("sgpaTrendChart", "line", {
    labels: state.summary.semesterSummaries.map((summary) => `Sem ${summary.semester}`),
    datasets: [
      {
        label: "SGPA",
        data: state.summary.semesterSummaries.map((summary) => round(summary.sgpa)),
        borderColor: "#2563eb",
        backgroundColor: "rgba(37, 99, 235, 0.12)",
        pointBackgroundColor: "#2563eb",
        tension: 0.32,
        fill: true,
      },
      {
        label: "CGPA",
        data: state.summary.semesterSummaries.map((summary) => round(summary.cgpa)),
        borderColor: "#059669",
        backgroundColor: "rgba(5, 150, 105, 0.1)",
        pointBackgroundColor: "#059669",
        tension: 0.32,
        fill: false,
      },
    ],
  });

  renderChart("gradeDistributionChart", "bar", {
    labels: GRADE_ORDER,
    datasets: [
      {
        label: "Subjects",
        data: GRADE_ORDER.map((grade) => state.summary.gradeDistribution[grade] || 0),
        backgroundColor: [
          "#2563eb",
          "#0891b2",
          "#059669",
          "#84cc16",
          "#f59e0b",
          "#ea580c",
          "#dc2626",
        ],
        borderRadius: 6,
      },
    ],
  });
}

function renderChart(id, type, data) {
  const canvas = document.getElementById(id);
  if (!canvas) return;

  state.charts[id]?.destroy?.();
  state.charts[id] = new Chart(canvas, {
    type,
    data,
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales:
        type === "bar" || type === "line"
          ? {
              y: {
                beginAtZero: true,
                max: id === "sgpaTrendChart" ? 10 : undefined,
                grid: { color: "#edf2f7" },
                ticks: { color: "#64748b", precision: 0 },
              },
              x: {
                grid: { display: false },
                ticks: { color: "#64748b" },
              },
            }
          : undefined,
      plugins: {
        legend: {
          position: "bottom",
          labels: {
            color: "#334155",
            boxWidth: 12,
            font: { family: "Inter", weight: "700" },
          },
        },
      },
    },
  });
}

function destroyCharts() {
  Object.values(state.charts).forEach((chart) => chart?.destroy?.());
  state.charts = {};
}

function submitQuestion(question) {
  addMessage("user", question);
  const answer = answerQuestion(question);
  addMessage("assistant", answer);
}

function answerQuestion(question) {
  const query = question.toLowerCase();

  if (!state.summary?.hasData) {
    return "I could not find uploaded result data yet. Upload a result PDF here or add semester results from the Semester page, then ask again.";
  }

  if (/reach|target|need.*cgpa|grade.*need|what grade/.test(query)) {
    return buildTargetAnswer(question);
  }

  if (/predict|future|expected|next semester/.test(query)) {
    return buildPredictionAnswer();
  }

  if (/compare|semester .*vs|vs semester/.test(query)) {
    return buildComparisonAnswer(question);
  }

  if (/current cgpa|my cgpa|what is.*cgpa/.test(query)) {
    return `Your current CGPA is ${formatGpa(state.summary.currentCgpa)}. Latest uploaded semester: Semester ${state.summary.currentResult.semester}, SGPA ${formatGpa(state.summary.currentResult.sgpa)}.`;
  }

  if (/best semester|highest sgpa/.test(query)) {
    return state.summary.highestSemester
      ? `Your best semester is Semester ${state.summary.highestSemester.semester} with SGPA ${formatGpa(state.summary.highestSemester.sgpa)}.`
      : "I could not identify a best semester yet.";
  }

  if (/lowest sgpa|worst semester|declined/.test(query)) {
    return state.summary.lowestSemester
      ? `Your lowest SGPA is Semester ${state.summary.lowestSemester.semester} with SGPA ${formatGpa(state.summary.lowestSemester.sgpa)}.`
      : "I could not identify a lowest semester yet.";
  }

  if (/lowest marks|weak subject|weakest|find weak/.test(query)) {
    return buildWeakSubjectAnswer();
  }

  if (/best subject|highest marks|strong subject/.test(query)) {
    return buildBestSubjectAnswer();
  }

  if (/credit|credits earned/.test(query)) {
    return `You have earned ${formatNumber(state.summary.totalCredits)} credits across ${state.results.length} uploaded semester${state.results.length === 1 ? "" : "s"}.`;
  }

  if (/progress|trend|growth|show cgpa trend/.test(query)) {
    return buildProgressAnswer();
  }

  if (/improve|suggestion|study|recommend/.test(query)) {
    return buildImprovementAnswer();
  }

  if (/pass|fail|failed/.test(query)) {
    return buildPassFailAnswer();
  }

  if (/grade distribution|grades/.test(query)) {
    return buildGradeDistributionAnswer();
  }

  if (/theory|practical/.test(query)) {
    return buildTheoryPracticalAnswer();
  }

  if (/analyze|analysis|explain|calculate sgpa|result/.test(query)) {
    return buildResultAnalysisAnswer();
  }

  return buildResultAnalysisAnswer();
}

function buildResultAnalysisAnswer() {
  const summary = state.summary;
  return [
    `Current CGPA: ${formatGpa(summary.currentCgpa)}`,
    `Average SGPA: ${formatGpa(summary.averageSgpa)}`,
    `Highest SGPA: ${formatGpa(summary.highestSemester?.sgpa)} in Semester ${summary.highestSemester?.semester || "--"}`,
    `Lowest SGPA: ${formatGpa(summary.lowestSemester?.sgpa)} in Semester ${summary.lowestSemester?.semester || "--"}`,
    `Credits earned: ${formatNumber(summary.totalCredits)}`,
    `Pass/Fail: ${summary.passedSubjects.length} passed, ${summary.failedSubjects.length} failed`,
    `Best subject: ${formatSubject(summary.bestSubject)}`,
    `Weakest subject: ${formatSubject(summary.weakestSubject)}`,
  ].join("\n");
}

function buildProgressAnswer() {
  const trend = state.summary.semesterSummaries
    .map(
      (semester) =>
        `Semester ${semester.semester}: SGPA ${formatGpa(semester.sgpa)}, CGPA ${formatGpa(semester.cgpa)}`
    )
    .join("\n");

  return `${trend}\n\n${state.summary.insights[0] || "Your academic trend is available from the uploaded semesters."}`;
}

function buildWeakSubjectAnswer() {
  const weakSubjects = getWeakSubjects().slice(0, 5);

  if (!weakSubjects.length) {
    return "No weak subject stands out from the uploaded records. Keep maintaining your current study rhythm.";
  }

  return [
    "Subjects needing attention:",
    ...weakSubjects.map(
      (subject) =>
        `${subject.subjectName} - Semester ${subject.semester}, ${formatPercent(subject.percentage)}, Grade ${subject.grade}`
    ),
  ].join("\n");
}

function buildBestSubjectAnswer() {
  const subject = state.summary.bestSubject;

  if (!subject) {
    return "I could not identify a best subject yet.";
  }

  return `Your best subject is ${subject.subjectName} from Semester ${subject.semester}, with ${formatPercent(subject.percentage)} and Grade ${subject.grade}.`;
}

function buildImprovementAnswer() {
  return [
    "Personalized improvement plan:",
    ...state.summary.recommendations,
  ].join("\n");
}

function buildPassFailAnswer() {
  if (!state.summary.failedSubjects.length) {
    return `All uploaded subjects are marked as passing. Passed subjects: ${state.summary.passedSubjects.length}.`;
  }

  return [
    `${state.summary.failedSubjects.length} failed subject${state.summary.failedSubjects.length === 1 ? "" : "s"} found:`,
    ...state.summary.failedSubjects.map(
      (subject) => `${subject.subjectName} - Semester ${subject.semester}, Grade ${subject.grade}`
    ),
  ].join("\n");
}

function buildGradeDistributionAnswer() {
  return GRADE_ORDER.map(
    (grade) => `${grade}: ${state.summary.gradeDistribution[grade] || 0}`
  ).join("\n");
}

function buildTheoryPracticalAnswer() {
  const theory = state.summary.theoryAverage;
  const practical = state.summary.practicalAverage;
  const difference = practical - theory;

  return [
    `Theory average: ${formatPercent(theory)}`,
    `Practical average: ${formatPercent(practical)}`,
    Number.isFinite(difference)
      ? difference >= 0
        ? `Practical subjects are ahead by ${formatPercent(difference)}.`
        : `Theory subjects are ahead by ${formatPercent(Math.abs(difference))}.`
      : "Theory/practical comparison is unavailable.",
  ].join("\n");
}

function buildPredictionAnswer() {
  const prediction = state.summary.prediction;
  if (!prediction) return "I need at least one valid SGPA and credit record to predict CGPA.";

  return `Expected next SGPA: ${formatGpa(prediction.expectedSgpa)}\nExpected CGPA after next semester: ${formatGpa(prediction.expectedCgpa)}\nTrend: ${prediction.trend}\nIf you maintain SGPA above 8.5 next semester, your CGPA may reach approximately ${formatGpa(calculateCgpaWithNextSgpa(8.5))}.`;
}

function buildTargetAnswer(question) {
  const target = extractTargetCgpa(question) ?? 8.5;
  const plan = calculateRequiredSgpa(target);

  if (!plan) {
    return "I need valid CGPA and credit data before calculating a target SGPA.";
  }

  if (plan.requiredSgpa <= 0) {
    return `You are already at or above the ${formatGpa(target)} CGPA target. Maintain steady SGPA performance to protect it.`;
  }

  const gradeBand = sgpaToGradeBand(plan.requiredSgpa);
  const feasibility =
    plan.requiredSgpa > 10
      ? "This is not reachable in one semester with a maximum SGPA of 10."
      : "This is reachable if your next semester performance is close to the target.";

  return `To reach ${formatGpa(target)} CGPA after the next semester, you need approximately SGPA ${formatGpa(plan.requiredSgpa)} assuming ${formatNumber(plan.nextCredits)} credits next semester.\nThat is around an average ${gradeBand} grade profile.\n${feasibility}`;
}

function buildComparisonAnswer(question) {
  const semesters = extractSemesterNumbers(question);
  const first =
    getResultBySemester(semesters[0]) ||
    getResultBySemester(document.getElementById("compareSemesterA")?.value);
  const second =
    getResultBySemester(semesters[1]) ||
    getResultBySemester(document.getElementById("compareSemesterB")?.value);

  if (!first || !second) {
    return "Select two uploaded semesters in the comparison panel first, or ask like: compare Semester 1 and Semester 2.";
  }

  const sgpaDifference = (second.sgpa ?? 0) - (first.sgpa ?? 0);
  const creditDifference =
    (second.creditsEarned || 0) - (first.creditsEarned || 0);
  const improvement =
    first.sgpa && first.sgpa > 0 ? (sgpaDifference / first.sgpa) * 100 : null;

  return [
    `Semester ${first.semester} vs Semester ${second.semester}`,
    `SGPA difference: ${formatSignedGpa(sgpaDifference)}`,
    `Credit difference: ${formatSignedNumber(creditDifference)}`,
    `Percentage improvement: ${formatSignedPercent(improvement)}`,
    `Semester ${second.semester} best subject: ${formatSubject(maxBy(second.subjects, (subject) => subject.percentage))}`,
    `Semester ${second.semester} weakest subject: ${formatSubject(minBy(second.subjects, (subject) => subject.percentage))}`,
  ].join("\n");
}

function buildPredictionText() {
  const prediction = state.summary?.prediction;
  if (!prediction) return "Prediction will appear after valid semester data is available.";

  return `Expected SGPA ${formatGpa(prediction.expectedSgpa)} may move CGPA to ${formatGpa(prediction.expectedCgpa)} after about ${formatNumber(prediction.nextCredits)} credits. Trend: ${prediction.trend}.`;
}

async function explainSelectedPdf() {
  const button = document.getElementById("explainPdfBtn");
  if (!state.selectedPdf) {
    addMessage("assistant", "Select a result PDF first, then I can upload it, read the parsed result, and explain it.");
    return;
  }

  const formData = new FormData();
  formData.append("pdf", state.selectedPdf);

  if (button) {
    button.disabled = true;
    button.classList.add("loading");
  }

  addMessage("user", `Explain this result PDF: ${state.selectedPdf.name}`);

  try {
    const response = await window.LearnLyticsAuth.authFetch(`${API_BASE_URL}/upload`, {
      method: "POST",
      body: formData,
    });
    const data = await response.json();

    if (!response.ok || !data.success) {
      addMessage("assistant", data.message || "I could not parse this PDF. Try uploading a clear result PDF.");
      return;
    }

    await loadAcademicData();
    const normalized = normalizeResult(data.data);
    addMessage("assistant", buildUploadedResultAnswer(normalized));
  } catch (error) {
    console.error("PDF explain error:", error.message);
    addMessage("assistant", "PDF upload failed. Please check that the backend is running and try again.");
  } finally {
    if (button) {
      button.disabled = false;
      button.classList.remove("loading");
    }
  }
}

function buildUploadedResultAnswer(result) {
  const best = maxBy(result.subjects, (subject) => subject.percentage);
  const weakest = minBy(result.subjects, (subject) => subject.percentage);
  const failed = result.subjects.filter((subject) => subject.status === "FAIL");

  return [
    `PDF result saved for Semester ${result.semester}.`,
    `SGPA: ${formatGpa(result.sgpa)}`,
    `CGPA: ${formatGpa(result.cgpa)}`,
    `Credits: ${formatNumber(result.creditsEarned)}`,
    `Best subject: ${formatSubject(best)}`,
    `Weakest subject: ${formatSubject(weakest)}`,
    failed.length
      ? `Failed subjects: ${failed.map((subject) => subject.subjectName).join(", ")}`
      : "No failed subjects found in this result.",
  ].join("\n");
}

function startVoiceInput() {
  const SpeechRecognition =
    window.SpeechRecognition || window.webkitSpeechRecognition;
  const voiceBtn = document.getElementById("voiceBtn");
  const chatInput = document.getElementById("chatInput");

  if (!SpeechRecognition) {
    addMessage("assistant", "Voice input is not supported in this browser.");
    return;
  }

  if (!state.recognition) {
    state.recognition = new SpeechRecognition();
    state.recognition.lang = "en-IN";
    state.recognition.interimResults = false;

    state.recognition.addEventListener("result", (event) => {
      const transcript = event.results?.[0]?.[0]?.transcript || "";
      if (chatInput) {
        chatInput.value = transcript;
        chatInput.focus();
      }
    });

    state.recognition.addEventListener("end", () => {
      voiceBtn?.classList.remove("listening");
    });
  }

  voiceBtn?.classList.add("listening");
  state.recognition.start();
}

function addMessage(role, content, persist = true) {
  const message = {
    role,
    content,
    timestamp: new Date().toISOString(),
  };

  if (persist) {
    state.history.push(message);
    state.history = state.history.slice(-80);
    saveHistory();
  }

  renderMessage(message);
  renderHistoryList();
}

function renderChatHistory() {
  const chatMessages = document.getElementById("chatMessages");
  if (!chatMessages) return;

  chatMessages.innerHTML = "";
  state.history.forEach(renderMessage);
}

function renderMessage(message) {
  const chatMessages = document.getElementById("chatMessages");
  if (!chatMessages) return;

  const row = document.createElement("div");
  row.className = `message-row ${message.role}`;
  row.innerHTML = `
    <div class="message-avatar">
      <i data-lucide="${message.role === "user" ? "user" : "brain-circuit"}"></i>
    </div>
    <div class="message-bubble">
      <span>${message.role === "user" ? "You" : "Advisor"}</span>
      ${formatMessageContent(message.content)}
    </div>
  `;

  chatMessages.appendChild(row);
  chatMessages.scrollTop = chatMessages.scrollHeight;
  refreshIcons();
}

function formatMessageContent(content) {
  const lines = String(content || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  if (!lines.length) {
    return "<p>--</p>";
  }

  return lines.map((line) => `<p>${escapeHtml(line)}</p>`).join("");
}

function ensureWelcomeMessage() {
  if (state.history.length) return;

  addMessage(
    "assistant",
    state.summary?.hasData
      ? `I analyzed ${state.results.length} uploaded semester${state.results.length === 1 ? "" : "s"}. Current CGPA is ${formatGpa(state.summary.currentCgpa)}.`
      : "I am ready to analyze results once semester data is available."
  );
}

function loadHistory() {
  try {
    const parsed = JSON.parse(localStorage.getItem(getHistoryKey() || HISTORY_KEY_PREFIX) || "[]");
    state.history = Array.isArray(parsed)
      ? parsed.filter((item) => item?.role && item?.content)
      : [];
  } catch {
    state.history = [];
  }
}

function saveHistory() {
  localStorage.setItem(getHistoryKey(), JSON.stringify(state.history));
}

function getHistoryKey() {
  const userId = window.LearnLyticsAuth?.getUser()?.id;
  return userId ? `${HISTORY_KEY_PREFIX}_${userId}` : HISTORY_KEY_PREFIX;
}

function renderHistoryList() {
  const historyList = document.getElementById("historyList");
  if (!historyList) return;

  const questions = state.history
    .filter((message) => message.role === "user")
    .slice(-6)
    .reverse();

  if (!questions.length) {
    historyList.innerHTML = '<div class="empty-state">No previous questions yet.</div>';
    return;
  }

  historyList.innerHTML = questions
    .map(
      (message) => `
        <button type="button" data-query="${escapeHtml(message.content)}">
          <i data-lucide="message-square-text"></i>
          <span>${escapeHtml(message.content)}</span>
        </button>
      `
    )
    .join("");

  refreshIcons();
}

function getWeakSubjects() {
  return state.subjects
    .filter(
      (subject) =>
        subject.status === "FAIL" ||
        ["F", "P", "D"].includes(subject.grade) ||
        subject.percentage < 60
    )
    .sort((a, b) => a.percentage - b.percentage);
}

function calculateRequiredSgpa(targetCgpa) {
  const summary = state.summary;
  if (!summary?.hasData || !Number.isFinite(summary.currentCgpa)) return null;

  const nextCredits =
    average(summary.semesterSummaries, (semester) => semester.credits) || 24;
  const requiredSgpa =
    (targetCgpa * (summary.totalCredits + nextCredits) -
      summary.currentCgpa * summary.totalCredits) /
    nextCredits;

  return { requiredSgpa, nextCredits };
}

function calculateCgpaWithNextSgpa(nextSgpa) {
  const summary = state.summary;
  if (!summary?.hasData || !Number.isFinite(summary.currentCgpa)) return null;

  const nextCredits =
    average(summary.semesterSummaries, (semester) => semester.credits) || 24;
  return (
    (summary.currentCgpa * summary.totalCredits + nextSgpa * nextCredits) /
    (summary.totalCredits + nextCredits)
  );
}

function extractTargetCgpa(question) {
  const matches = String(question).match(/\b([0-9](?:\.[0-9]+)?)\b/g) || [];
  const values = matches.map(Number).filter((value) => value > 0 && value <= 10);
  return values.length ? values[values.length - 1] : null;
}

function extractSemesterNumbers(question) {
  return Array.from(String(question).matchAll(/semester\s*([1-8])/gi)).map(
    (match) => match[1]
  );
}

function sgpaToGradeBand(sgpa) {
  if (sgpa >= 9.5) return "A+";
  if (sgpa >= 8.5) return "A";
  if (sgpa >= 7.5) return "B";
  if (sgpa >= 6.5) return "C";
  if (sgpa >= 5.5) return "D";
  return "P or better";
}

function getResultBySemester(semester) {
  return state.results.find((result) => result.semester === String(semester)) || null;
}

function getTopGrade(distribution) {
  return GRADE_ORDER.map((grade) => ({
    grade,
    count: distribution[grade] || 0,
  }))
    .filter((item) => item.count > 0)
    .sort((a, b) => b.count - a.count || GRADE_ORDER.indexOf(a.grade) - GRADE_ORDER.indexOf(b.grade))[0];
}

function renderList(id, items) {
  const element = document.getElementById(id);
  if (!element) return;

  if (!items.length) {
    element.innerHTML = '<li>No data available.</li>';
    return;
  }

  element.innerHTML = items.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
}

function normalizeSemester(value) {
  const semester = String(value || "N/A")
    .trim()
    .replace(/(?:st|nd|rd|th)$/i, "");

  return semester || "N/A";
}

function normalizeType(code, type, name) {
  const rawType = String(type || "").toUpperCase();
  if (/P$/i.test(code)) return "PRACTICAL";
  if (rawType === "THEORY" || rawType === "PRACTICAL") return rawType;
  return /LAB|PRACTICAL|WORKSHOP|INTERNSHIP/i.test(name)
    ? "PRACTICAL"
    : "THEORY";
}

function normalizeGrade(value) {
  const grade = String(value || "").trim().toUpperCase();
  return Object.prototype.hasOwnProperty.call(GRADE_POINTS, grade)
    ? grade
    : null;
}

function normalizeSubjectStatus(value, grade) {
  const rawStatus = String(value || "").trim().toUpperCase();
  if (rawStatus === "PASS" || rawStatus === "FAIL") return rawStatus;
  return grade === "F" ? "FAIL" : "PASS";
}

function normalizeResultStatus(value, subjects) {
  const rawStatus = String(value || "").trim().toUpperCase();
  if (subjects.some((subject) => subject.status === "FAIL")) return "FAIL";
  return rawStatus === "FAIL" ? "FAIL" : "PASS";
}

function inferGrade(percentage) {
  const score = Number(percentage);
  if (!Number.isFinite(score) || score < 35) return "F";
  if (score >= 90) return "A+";
  if (score >= 80) return "A";
  if (score >= 70) return "B";
  if (score >= 60) return "C";
  if (score >= 50) return "D";
  return "P";
}

function getMaxMarks(type, total) {
  if (type === "PRACTICAL" && Number(total) <= 50) return 50;
  return 100;
}

function getTimestamp(result) {
  const value = new Date(result?.updatedAt || result?.createdAt || 0).getTime();
  return Number.isFinite(value) ? value : 0;
}

function compareSemesters(a, b) {
  return Number(a.semester) - Number(b.semester);
}

function maxBy(items, selector) {
  return items.reduce((best, item) => {
    if (!best) return item;
    return Number(selector(item)) > Number(selector(best)) ? item : best;
  }, null);
}

function minBy(items, selector) {
  return items.reduce((best, item) => {
    if (!best) return item;
    return Number(selector(item)) < Number(selector(best)) ? item : best;
  }, null);
}

function sum(items, selector) {
  return items.reduce((total, item) => {
    const value = Number(selector(item));
    return Number.isFinite(value) ? total + value : total;
  }, 0);
}

function average(items, selector) {
  if (!items.length) return null;
  const values = items.map(selector).map(Number).filter(Number.isFinite);
  return values.length ? sum(values, (value) => value) / values.length : null;
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
  return Number.isFinite(number)
    ? (Math.round((number + Number.EPSILON) * 100) / 100).toFixed(2)
    : "N/A";
}

function formatNumber(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "--";
  return Number.isInteger(number) ? String(number) : number.toFixed(1);
}

function formatPercent(value) {
  const number = Number(value);
  return Number.isFinite(number) ? `${number.toFixed(1)}%` : "N/A";
}

function formatSignedGpa(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "N/A";
  return `${number >= 0 ? "+" : ""}${number.toFixed(2)}`;
}

function formatSignedNumber(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "N/A";
  return `${number >= 0 ? "+" : ""}${formatNumber(number)}`;
}

function formatSignedPercent(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "N/A";
  return `${number >= 0 ? "+" : ""}${number.toFixed(1)}%`;
}

function formatSubject(subject) {
  if (!subject) return "--";
  return `${subject.subjectName} - Semester ${subject.semester}, ${formatPercent(subject.percentage)}, Grade ${subject.grade}`;
}

function setText(id, value) {
  const element = document.getElementById(id);
  if (!element) return;
  element.textContent =
    value === undefined || value === null || value === "" ? "--" : value;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function refreshIcons() {
  if (window.lucide) {
    lucide.createIcons();
  }
}
