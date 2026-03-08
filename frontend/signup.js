// Default role
let role = "student";

// Function to switch role
function setRole(r) {

    role = r;

    const orgLabel = document.getElementById("orgLabel");
    const orgInput = document.getElementById("orgInput");
    const studentFields = document.getElementById("studentFields");

    const sTab = document.getElementById("studentTab");
    const fTab = document.getElementById("facultyTab");

    if (role === "faculty") {

        orgLabel.innerText = "Department";
        orgInput.placeholder = "e.g. Department of Physics";

        studentFields.style.display = "none";

        fTab.classList.add("active");
        sTab.classList.remove("active");

    } else {

        orgLabel.innerText = "Branch";
        orgInput.placeholder = "e.g. Computer Science";

        studentFields.style.display = "block";

        sTab.classList.add("active");
        fTab.classList.remove("active");

    }
}


// Form submit
document.getElementById("authForm").addEventListener("submit", async function (e) {

    e.preventDefault();

    const name = document.getElementById("name").value;
    const branch = document.getElementById("orgInput").value;
    const session = document.getElementById("session")?.value || "";
    const regno = document.getElementById("regno")?.value || "";
    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;

    try {

        const response = await fetch("http://localhost:5000/api/signup", {

            method: "POST",

            headers: {
                "Content-Type": "application/json"
            },

            body: JSON.stringify({
                name,
                branch,
                session,
                regno,
                email,
                password,
                role
            })

        });

        const data = await response.json();

        alert(data.message);

        // Redirect after successful signup
        if (data.message === "User Registered Successfully") {

            if (role === "student") {
                window.location.href = "student-dashboard.html";
            } else {
                window.location.href = "faculty-dashboard.html";
            }

        }

        // Reset form
        document.getElementById("authForm").reset();

    } catch (error) {

        console.error("Signup error:", error);

        alert("Something went wrong. Please try again.");

    }

});