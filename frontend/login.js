/* PASSWORD SHOW / HIDE */

const togglePassword = document.getElementById("togglePassword");
const passwordInput = document.getElementById("password");

if (togglePassword && passwordInput) {
  togglePassword.addEventListener("click", () => {

    const isPassword = passwordInput.type === "password";
    passwordInput.type = isPassword ? "text" : "password";

    togglePassword.classList.toggle("fa-eye");
    togglePassword.classList.toggle("fa-eye-slash");

  });
}


/* ROLE SWITCHER */

let selectedRole = "student";

function setRole(role, event) {

  selectedRole = role;

  const userLabel = document.getElementById("userLabel");
  const tabs = document.querySelectorAll(".tab");

  tabs.forEach(tab => tab.classList.remove("active"));

  if (event) event.currentTarget.classList.add("active");

  const roleLabels = {
    student: "Student E-mail",
    faculty: "Faculty E-mail",
    admin: "Admin E-mail"
  };

  if (userLabel) {
    userLabel.innerText = roleLabels[role];
  }

}


/* LOGIN FUNCTION */

async function login() {

  const email = document.getElementById("username").value.trim();
  const password = document.getElementById("password").value;

  if (!email || !password) {
    alert("Please fill all fields");
    return;
  }

  try {

    const response = await fetch("http://localhost:5000/api/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        email,
        password,
        role: selectedRole
      })
    });

    const data = await response.json();

    console.log("Login response:", data);

    if (!response.ok) {
      alert(data.message || "Login failed");
      return;
    }

    alert("Login Successful 🎉");

    /* ROLE BASED REDIRECT */

    const dashboardRoutes = {
      student: "student-dashboard.html",
      faculty: "faculty-dashboard.html",
      admin: "admin-dashboard.html"
    };

    const redirectPage = dashboardRoutes[data.role];

    if (redirectPage) {
      window.location.href = redirectPage;
    } else {
      alert("Unknown role");
    }

  } catch (error) {

    console.error("Login error:", error);
    alert("Server Error. Please try again later.");

  }

}


/* FORM SUBMIT */

const loginForm = document.getElementById("loginForm");

if (loginForm) {

  loginForm.addEventListener("submit", function (e) {

    e.preventDefault();
    login();

  });

}