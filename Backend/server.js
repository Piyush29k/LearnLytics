

const express = require("express");
const cors = require("cors");

const connectDB = require("./config/db");

const userRoutes = require("./routes/userRoutes");
const resultRoutes = require("./routes/resultRoutes");

const app = express();

/* =========================
   MIDDLEWARE
========================= */
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true })); // optional but useful

/* =========================
   DB CONNECTION
========================= */
connectDB();

/* =========================
   ROUTES
========================= */
app.use("/api", userRoutes);
app.use("/api/results", resultRoutes);

/* =========================
   HEALTH CHECK ROUTE
========================= */
app.get("/", (req, res) => {
  res.send("Server is running 🚀");
});

/* =========================
   ERROR HANDLING (IMPORTANT)
========================= */
app.use((err, req, res, next) => {
  console.error("Error:", err.message);

  res.status(500).json({
    success: false,
    message: "Internal Server Error"
  });
});

/* =========================
   START SERVER
========================= */
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

app.get("/", (req, res) => {
  res.send("LearnLytics Backend Running Successfully");
});
