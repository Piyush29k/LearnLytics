const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const User = require("../models/userModel");
const { JWT_SECRET, requireAuth } = require("../middleware/auth");

function buildUserPayload(user) {
  return {
    id: user._id,
    name: user.name,
    branch: user.branch || "",
    session: user.session || "",
    regno: user.regno || "",
    rollNo: user.rollNo || "",
    email: user.email,
    role: user.role,
  };
}

function createToken(user) {
  return jwt.sign(
    {
      id: user._id,
      role: user.role,
    },
    JWT_SECRET,
    { expiresIn: "7d" }
  );
}


// ================== SIGNUP ==================
router.post("/signup", async (req, res) => {

  try {

    const { name, branch, session, regno, rollNo, email, password, role } = req.body;
    const normalizedEmail = String(email || "").trim().toLowerCase();
    const normalizedRole = role || "student";
    const normalizedRegNo = String(regno || "").trim();

    if (!name || !normalizedEmail || !password) {
      return res.status(400).json({ message: "Name, email and password are required" });
    }

    if (normalizedRole === "student" && !normalizedRegNo) {
      return res.status(400).json({
        message: "Registration number is required for student accounts"
      });
    }

    // check if user already exists
    const existingUser = await User.findOne({ email: normalizedEmail });

    if (existingUser) {
      return res.status(409).json({ message: "User already exists" });
    }

    if (normalizedRole === "student") {
      const existingRegNo = await User.findOne({
        role: "student",
        regno: normalizedRegNo,
      });

      if (existingRegNo) {
        return res.status(409).json({
          message: "A student account already exists for this registration number"
        });
      }
    }

    // hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // create new user
    const newUser = new User({
      name: String(name).trim(),
      branch: String(branch || "").trim(),
      session: String(session || "").trim(),
      regno: normalizedRegNo,
      rollNo: String(rollNo || "").trim(),
      email: normalizedEmail,
      password: hashedPassword,
      role: normalizedRole
    });

    await newUser.save();

    res.json({
      message: "User Registered Successfully",
      token: createToken(newUser),
      user: buildUserPayload(newUser)
    });

  } catch (error) {

    console.error(error);
    res.status(500).json({ message: "Server Error" });

  }

});


// ================== LOGIN ==================
router.post("/login", async (req, res) => {

  try {

    const { email, password, role } = req.body;
    const normalizedEmail = String(email || "").trim().toLowerCase();

    // find user with role
    const user = await User.findOne({ email: normalizedEmail, role });

    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }

    // compare password
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(401).json({ message: "Incorrect password" });
    }

    res.json({
      message: "Login successful",
      role: user.role,
      token: createToken(user),
      user: buildUserPayload(user)
    });

  } catch (error) {

    console.error(error);
    res.status(500).json({ message: "Server Error" });

  }

});

// ================== CURRENT USER ==================
router.get("/me", requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    return res.json({
      success: true,
      user: buildUserPayload(user),
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: "Server Error",
    });
  }
});


// ===== VERY IMPORTANT (EXPORT ROUTER) =====
module.exports = router;
