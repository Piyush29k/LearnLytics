const modalData = {
    "Performance Analytics": "Comprehensive dashboard to track student GPA, daily attendance, and subject-specific performance. Generate instant heatmaps to see where your class is excelling or struggling.",
    "AI-Powered Insights": "Analyze historical data patterns to forecast likely outcomes and flag students who may need early intervention.",
    "Multi-Role Access": "Dedicated portals for Administrators to see campus-wide data, Teachers to manage gradebooks, and Students to track their personal learning journey.",
    "Trend Analysis": "Visualize progress over months or years. Track how specific teaching methods or curriculum changes impact student outcomes across different semesters.",
    "Smart Recommendations": "Automated study plans tailored to each student's weak points. The system suggests relevant resources, videos, and practice tests to bridge the learning gap.",
    "Report Generation": "One-click export for professional, branded report cards and administrative summaries in PDF or Excel formats, ready for parent meetings."
};

const modal = document.getElementById("featureModal");
const cards = document.querySelectorAll(".card");
const closeBtn = document.querySelector(".close-btn");

// Open Modal logic
cards.forEach(card => {
    card.addEventListener("click", () => {
        const title = card.querySelector("h3").innerText;
        const iconClass = card.querySelector("i").className.replace(" icon", "");
        
        document.getElementById("modalTitle").innerText = title;
        document.getElementById("modalDescription").innerText = modalData[title];
        document.getElementById("modalIcon").className = iconClass;
        
        modal.classList.add("is-open");
        modal.setAttribute("aria-hidden", "false");
    });
});

// Close logic
function closeModal() {
    modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden", "true");
}

closeBtn.onclick = closeModal;

window.onclick = (event) => {
    if (event.target === modal) {
        closeModal();
    }
};

window.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && modal.classList.contains("is-open")) {
        closeModal();
    }
});

// Function to handle scroll animations
function reveal() {
    const reveals = document.querySelectorAll(".reveal");

    reveals.forEach((element) => {
        const windowHeight = window.innerHeight;
        const elementTop = element.getBoundingClientRect().top;
        const elementVisible = 150; // Distance in px before triggering

        if (elementTop < windowHeight - elementVisible) {
            element.classList.add("active");
        }
    });
}

// Run on scroll
window.addEventListener("scroll", reveal);

// Run once on load to catch elements already in view
window.addEventListener("load", reveal);
