// ==============================
// PAGE SWITCHING
// ==============================

const menuItems = document.querySelectorAll(".menu-item");
const pages = document.querySelectorAll(".page");

menuItems.forEach((item) => {
  item.addEventListener("click", () => {
    menuItems.forEach((menu) => menu.classList.remove("active"));
    pages.forEach((page) => page.classList.remove("active-page"));

    item.classList.add("active");

    const pageId = item.dataset.page;
    const page = document.getElementById(pageId);

    if (page) {
      page.classList.add("active-page");
    }
  });
});

// ==============================
// MODAL
// ==============================

const modal = document.getElementById("studentModal");
const openModalBtn = document.getElementById("openModalBtn");
const closeModalBtn = document.getElementById("closeModalBtn");
const cancelModalBtn = document.getElementById("cancelModalBtn");

function closeModal() {
  modal.style.display = "none";
}

openModalBtn.addEventListener("click", () => {
  modal.style.display = "flex";
});

closeModalBtn.addEventListener("click", closeModal);
cancelModalBtn.addEventListener("click", closeModal);

window.addEventListener("click", (event) => {
  if (event.target === modal) {
    closeModal();
  }
});

// ==============================
// SLIDER VALUES
// ==============================

const attendanceSlider = document.getElementById("attendanceSlider");
const assignmentSlider = document.getElementById("assignmentSlider");
const quizSlider = document.getElementById("quizSlider");
const internalSlider = document.getElementById("internalSlider");

const attendanceValue = document.getElementById("attendanceValue");
const assignmentValue = document.getElementById("assignmentValue");
const quizValue = document.getElementById("quizValue");
const internalValue = document.getElementById("internalValue");

attendanceSlider.addEventListener("input", () => {
  attendanceValue.textContent = attendanceSlider.value;
  updatePrediction();
});

assignmentSlider.addEventListener("input", () => {
  assignmentValue.textContent = assignmentSlider.value;
  updatePrediction();
});

quizSlider.addEventListener("input", () => {
  quizValue.textContent = quizSlider.value;
  updatePrediction();
});

internalSlider.addEventListener("input", () => {
  internalValue.textContent = internalSlider.value;
  updatePrediction();
});

// ==============================
// AI PREDICTION
// ==============================

const predictedGrade = document.getElementById("predictedGrade");
const riskLevel = document.getElementById("riskLevel");

function updatePrediction() {
  const attendance = Number(attendanceSlider.value);
  const assignment = Number(assignmentSlider.value);
  const quiz = Number(quizSlider.value);
  const internal = Number(internalSlider.value);
  const average = (attendance + assignment + quiz + internal) / 4;

  let grade = "F";
  let risk = "High";

  if (average >= 85) {
    grade = "A";
    risk = "Low";
  } else if (average >= 70) {
    grade = "B";
    risk = "Medium";
  } else if (average >= 55) {
    grade = "C";
    risk = "Medium";
  }

  predictedGrade.textContent = `Grade : ${grade}`;
  riskLevel.textContent = risk;

  if (risk === "Low") {
    riskLevel.style.background = "#dcfce7";
    riskLevel.style.color = "#166534";
  }

  if (risk === "Medium") {
    riskLevel.style.background = "#fef3c7";
    riskLevel.style.color = "#92400e";
  }

  if (risk === "High") {
    riskLevel.style.background = "#fee2e2";
    riskLevel.style.color = "#991b1b";
  }
}

updatePrediction();

// ==============================
// SAVE STUDENT
// ==============================

const saveStudentBtn = document.getElementById("saveStudentBtn");
const tableBody = document.getElementById("studentTableBody");

saveStudentBtn.addEventListener("click", () => {
  const name = document.getElementById("studentName").value.trim();
  const regNo = document.getElementById("registrationNumber").value.trim();
  const branch = document.getElementById("studentBranch").value;

  if (!name || !regNo) {
    alert("Please fill all fields.");
    return;
  }

  const grade = predictedGrade.textContent.replace("Grade : ", "");
  const risk = riskLevel.textContent;
  const row = document.createElement("tr");

  row.innerHTML = `
    <td>${name}</td>
    <td>${regNo}</td>
    <td>${branch}</td>
    <td>${grade}</td>
    <td>${risk}</td>
    <td>
      <button class="delete-btn">
        Delete
      </button>
    </td>
  `;

  tableBody.appendChild(row);
  closeModal();

  document.getElementById("studentName").value = "";
  document.getElementById("registrationNumber").value = "";
});

// ==============================
// DELETE STUDENT
// ==============================

tableBody.addEventListener("click", (event) => {
  if (event.target.classList.contains("delete-btn")) {
    event.target.closest("tr").remove();
  }
});

// ==============================
// SEARCH STUDENT
// ==============================

const searchInput = document.querySelector(".search-input");

searchInput.addEventListener("keyup", () => {
  const value = searchInput.value.toLowerCase();
  const rows = tableBody.querySelectorAll("tr");

  rows.forEach((row) => {
    const text = row.textContent.toLowerCase();
    row.style.display = text.includes(value) ? "" : "none";
  });
});

// ==============================
// RESET STUDENTS
// ==============================

const resetBtn = document.querySelector(".reset-btn");

resetBtn.addEventListener("click", () => {
  tableBody.innerHTML = "";
  searchInput.value = "";
});

// ==============================
// LOGOUT
// ==============================

document.getElementById("logoutBtn").addEventListener("click", () => {
  const confirmLogout = confirm("Logout from dashboard?");

  if (confirmLogout) {
    alert("Logged out successfully");
    window.location.href = "login.html";
  }
});
