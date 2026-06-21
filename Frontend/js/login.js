/* PASSWORD SHOW HIDE */
const togglePassword = document.getElementById("togglePassword");
const password = document.getElementById("password");

togglePassword.addEventListener("click", function () {
    const type = password.type === "password" ? "text" : "password";
    password.type = type;

    this.classList.toggle("fa-eye");
    this.classList.toggle("fa-eye-slash");
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
            alert("Login Successful");

            // Redirect paths adjusted to match files sitting in the same frontend root directory
            if (data.role === "student") {
                window.location.href = "student_dashboard.html";
            } else if (data.role === "faculty") {
                window.location.href = "faculty.html";
            } else if (data.role === "admin") {
                window.location.href = "admin_dashboard.html"; // Ensure this matches your final file name
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