# 🎓 AI-Based Student Performance Analysis System

An intelligent web-based platform that analyzes student academic performance using Artificial Intelligence. The system extracts data from uploaded result PDFs, stores it in a database, and generates personalized insights, performance reports, and recommendations to help students improve their academic outcomes.

---

## 📌 Project Overview

The **AI-Based Student Performance Analysis System** aims to automate the process of evaluating student performance. Instead of manually reviewing marksheets and calculating trends, the system uses AI to identify strengths, weaknesses, and performance patterns.

Students can upload their result PDFs, while faculty members can monitor overall class performance through an interactive dashboard.

---

## 🚀 Features

### 👨‍🎓 Student Module

* Student Registration & Login
* Personal Dashboard
* Upload Result PDF
* Semester-wise Performance Tracking
* Subject-wise Marks Analysis
* SGPA & CGPA Visualization
* AI-Based Performance Suggestions
* Academic Progress Monitoring

### 👨‍🏫 Faculty Module

* Faculty Login
* Student Performance Monitoring
* Class Analytics Dashboard
* Weak Subject Identification
* Student Comparison Reports
* Downloadable Performance Reports

### 🔐 Admin Module

* Manage Students
* Manage Faculty
* Dashboard Analytics
* Database Monitoring
* System Administration

---

## 🤖 AI Functionality

The AI engine analyzes academic records and provides:

* Performance Analysis
* Strength & Weakness Detection
* Subject-wise Insights
* Improvement Recommendations
* Trend Analysis Across Semesters
* Future Performance Prediction (Future Scope)

---

## ⚙️ System Workflow

```text
Student Uploads Result PDF
            │
            ▼
PDF Text Extraction
(pdf-parse / OCR)
            │
            ▼
Data Cleaning & Processing
            │
            ▼
Structured JSON Creation
            │
            ▼
MongoDB Database Storage
            │
            ▼
AI Analysis Engine
            │
            ▼
Dashboard Visualization
            │
            ▼
Recommendations & Reports
```

---

## 🛠️ Technology Stack

### Frontend

* HTML5
* CSS3
* JavaScript
* Chart.js

### Backend

* Node.js
* Express.js

### Database

* MongoDB Atlas

### AI & Data Processing

* PDF-Parse
* Tesseract OCR
* OpenAI API
* Custom Analysis Algorithms

### Development Tools

* VS Code
* Git
* GitHub
* Postman

---

## 📂 Project Structure

```bash
AI-Based-Student-Performance-Analysis-System/
│
├── frontend/
│   ├── student-dashboard/
│   ├── faculty-dashboard/
│   ├── admin-dashboard/
│   ├── assets/
│   └── styles/
│
├── backend/
│   ├── controllers/
│   ├── middleware/
│   ├── models/
│   ├── routes/
│   ├── services/
│   └── server.js
│
├── uploads/
├── reports/
├── database/
├── .env
├── package.json
└── README.md
```

---

## 🗄️ Database Design

### Student Collection

```json
{
  "_id": "",
  "name": "",
  "registrationNumber": "",
  "email": "",
  "semester": "",
  "branch": ""
}
```

### Result Collection

```json
{
  "_id": "",
  "studentId": "",
  "semester": "",
  "subjects": [],
  "sgpa": "",
  "cgpa": "",
  "uploadDate": ""
}
```

---

## 🔧 Installation Guide

### 1. Clone Repository

```bash
git clone https://github.com/your-username/ai-student-performance-analysis.git
```

### 2. Move to Project Directory

```bash
cd ai-student-performance-analysis
```

### 3. Install Dependencies

```bash
npm install
```

### 4. Configure Environment Variables

Create a `.env` file in the root directory:

```env
PORT=5000
MONGO_URI=your_mongodb_connection_string
OPENAI_API_KEY=your_openai_api_key
```

### 5. Start the Server

```bash
npm start
```

### 6. Open Application

```text
http://localhost:5000
```

---

## 📊 Key Objectives

* Automate academic performance analysis.
* Reduce manual result evaluation.
* Provide AI-powered recommendations.
* Improve student learning outcomes.
* Assist faculty in monitoring class progress.
* Generate meaningful academic insights.

---

## 🔮 Future Enhancements

* Machine Learning Prediction Models
* Attendance Analysis
* Placement Readiness Score
* AI Academic Chatbot
* Automatic Result Fetching from University Portal
* Email Notifications
* Mobile Application
* Real-Time Performance Monitoring

---

## 👥 Team Contribution

### Member 1

**Frontend Development**

* UI/UX Design
* Student Dashboard
* Faculty Dashboard
* Data Visualization

### Member 2

**Backend & AI Development**

* API Development
* MongoDB Integration
* PDF Processing
* AI Analysis Engine
* Authentication System

---

## 📸 Screenshots

Add screenshots of:

* Login Page
* Student Dashboard
* Faculty Dashboard
* Result Upload Page
* Performance Analytics Page

---

## 📄 License

This project is developed for educational and academic purposes.

---

## ⭐ Acknowledgements

* Node.js
* Express.js
* MongoDB Atlas
* Chart.js
* OpenAI API
* Tesseract OCR

---

### Developed as a Final Year B.Tech Project 🚀
