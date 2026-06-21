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
window.addEventListener("load", () => {

    const loader = document.getElementById("loader");

    setTimeout(() => {
        loader.classList.add("hide");
    }, 1200);

});