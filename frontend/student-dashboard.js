// student_dashboard.js

// Load student data when page opens
window.onload = function () {

    const studentData = JSON.parse(localStorage.getItem("student"));

    if (!studentData) {
        alert("Please login first");
        window.location.href = "index.html";
        return;
    }

    // Display student information
    document.getElementById("name").innerText = studentData.name;
    document.getElementById("email").innerText = studentData.email;
    document.getElementById("branch").innerText = studentData.branch;
    document.getElementById("session").innerText = studentData.session;
    document.getElementById("regno").innerText = studentData.regno;

};


// Logout function
function logout() {

    localStorage.removeItem("student");

    alert("Logged out successfully");

    window.location.href = "home.html";

}