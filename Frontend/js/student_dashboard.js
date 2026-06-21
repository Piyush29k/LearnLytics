const sidebar = document.querySelector(".sidebar");
const toggleSidebar = document.getElementById("toggleSidebar");
const menuItems = document.querySelectorAll(".menu-item");
const logoutBtn = document.getElementById("logoutBtn");

if (toggleSidebar && sidebar) {
  toggleSidebar.addEventListener("click", () => {
    sidebar.classList.toggle("collapsed");
  });
}

menuItems.forEach((item) => {
  item.addEventListener("click", () => {
    const label = item.textContent.trim().toLowerCase();
    const currentPage = window.location.pathname.split("/").pop();

    if (label === "dashboard" && currentPage !== "student_dashboard.html") {
      window.location.href = "student_dashboard.html";
      return;
    }

    if (label === "performance" && currentPage !== "performance.html") {
      window.location.href = "performance.html";
      return;
    }

    menuItems.forEach((menu) => menu.classList.remove("active"));
    item.classList.add("active");
  });
});

if (logoutBtn) {
  logoutBtn.addEventListener("click", () => {
    const confirmLogout = confirm("Logout from dashboard?");

    if (confirmLogout) {
      alert("Logged out successfully");
      window.location.href = "../login.html";
    }
  });
}

if (window.lucide) {
  lucide.createIcons();
}

if (window.Chart) {
  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        labels: {
          color: "#374151",
          font: {
            family: "Inter",
            weight: "600"
          }
        }
      }
    }
  };

  const lineCtx = document.getElementById("lineChart");

  if (lineCtx) {
    new Chart(lineCtx, {
      type: "line",
      data: {
        labels: ["Jan", "Feb", "Mar", "Apr", "May", "Jun"],
        datasets: [
          {
            label: "Performance",
            data: [68, 71, 70, 75, 78, 82],
            borderColor: "#4f46e5",
            backgroundColor: "rgba(79, 70, 229, 0.14)",
            tension: 0.4,
            fill: true,
            borderWidth: 4,
            pointRadius: 5
          },
          {
            label: "Attendance",
            data: [86, 88, 87, 89, 90, 92],
            borderColor: "#14b8a6",
            backgroundColor: "rgba(20, 184, 166, 0.10)",
            tension: 0.4,
            fill: true,
            borderWidth: 3,
            pointRadius: 4
          }
        ]
      },
      options: {
        ...chartOptions,
        scales: {
          y: {
            beginAtZero: true,
            max: 100,
            grid: {
              color: "#eef2f7"
            }
          },
          x: {
            grid: {
              display: false
            }
          }
        }
      }
    });
  }

  const radarCtx = document.getElementById("radarChart");

  if (radarCtx) {
    new Chart(radarCtx, {
      type: "radar",
      data: {
        labels: ["Attendance", "Assignments", "Quiz", "Coding", "Participation"],
        datasets: [
          {
            label: "Student Skills",
            data: [90, 81, 61, 67, 78],
            borderColor: "#4f46e5",
            backgroundColor: "rgba(79, 70, 229, 0.22)",
            borderWidth: 3
          }
        ]
      },
      options: {
        ...chartOptions,
        scales: {
          r: {
            min: 0,
            max: 100,
            ticks: {
              stepSize: 20
            },
            grid: {
              color: "#e5e7eb"
            }
          }
        }
      }
    });
  }

  const barCtx = document.getElementById("barChart");

  if (barCtx) {
    new Chart(barCtx, {
      type: "bar",
      data: {
        labels: ["DSA", "DBMS", "OS", "Maths", "CN"],
        datasets: [
          {
            label: "Current Average",
            data: [72, 76, 69, 64, 70],
            backgroundColor: "#4f46e5",
            borderRadius: 8
          },
          {
            label: "AI Prediction",
            data: [78, 80, 73, 70, 74],
            backgroundColor: "#14b8a6",
            borderRadius: 8
          }
        ]
      },
      options: {
        ...chartOptions,
        scales: {
          y: {
            beginAtZero: true,
            max: 100,
            grid: {
              color: "#eef2f7"
            }
          },
          x: {
            grid: {
              display: false
            }
          }
        }
      }
    });
  }

  const doughnutCtx = document.getElementById("doughnutChart");

  if (doughnutCtx) {
    new Chart(doughnutCtx, {
      type: "doughnut",
      data: {
        labels: ["Low Risk", "Medium Risk", "Needs Focus"],
        datasets: [
          {
            data: [58, 29, 13],
            backgroundColor: ["#22c55e", "#f59e0b", "#ef4444"],
            borderWidth: 0
          }
        ]
      },
      options: {
        ...chartOptions,
        cutout: "68%"
      }
    });
  }
}
window.addEventListener("load", () => {

    const loader = document.getElementById("loader");

    setTimeout(() => {
        loader.classList.add("hide");
    }, 1200);

});