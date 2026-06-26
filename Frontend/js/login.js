/* PASSWORD SHOW HIDE */
const togglePassword = document.getElementById("togglePassword");
const password = document.getElementById("password");
const togglePasswordButton = togglePassword?.closest("button") || togglePassword;

togglePasswordButton?.addEventListener("click", function () {
    const type = password.type === "password" ? "text" : "password";
    password.type = type;

    togglePassword.classList.toggle("fa-eye");
    togglePassword.classList.toggle("fa-eye-slash");
});


/* ROLE SWITCHER */
let selectedRole = "student";

function setRole(role, event) {
    selectedRole = role;
    const userLabel = document.getElementById("userLabel");
    const tabs = document.querySelectorAll(".tab");

    tabs.forEach(tab => {
        tab.classList.remove("active");
    });

    event.currentTarget.classList.add("active");

    if (role === "student") {
        userLabel.innerText = "Student E-mail";
    } else if (role === "faculty") {
        userLabel.innerText = "Faculty E-mail";
    } else if (role === "admin") {
        userLabel.innerText = "Admin E-mail";
    }
}


/* LOGIN FUNCTION */
async function login() {
    // Falls back to "email" ID if "username" doesn't exist in your HTML
    const emailInput = document.getElementById("username") || document.getElementById("email");
    
    if (!emailInput) {
        alert("Frontend Error: Email input field not found.");
        return;
    }

    const email = emailInput.value;
    const passwordValue = document.getElementById("password").value;

    try {
        const response = await fetch("http://localhost:5000/api/login", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                email,
                password: passwordValue,
                role: selectedRole
            })
        });

        const data = await response.json();
        console.log(data);

        if (response.ok) {
            try {
                window.LearnLyticsAuth?.saveSession({
                    token: data.token,
                    user: data.user
                });
            } catch (error) {
                alert("Login succeeded, but the browser could not save your session.");
                return;
            }

            alert("Login Successful");

            const dashboardRoutes = {
                student: "student_dashboard.html",
                faculty: "faculty.html"
            };

            const role = data.user?.role || data.role;

            if (dashboardRoutes[role]) {
                window.location.href = dashboardRoutes[role];
            } else {
                alert("Admin dashboard page is not available yet.");
            }
        } else {
            alert(data.message || "Invalid credentials");
        }
    } catch (error) {
        console.error("Login Error:", error);
        alert("Server Error. Please try again later.");
    }
}


/* FORM SUBMIT */
document.getElementById("loginForm").addEventListener("submit", function (e) {
    e.preventDefault();
    login();
});
