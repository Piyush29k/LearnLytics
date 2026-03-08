const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");

const User = require("../models/userModel");


// ================== SIGNUP ==================
router.post("/signup", async (req, res) => {

try {

const { name, branch, session, regno, email, password, role } = req.body;

// check if user already exists
const existingUser = await User.findOne({ email });

if (existingUser) {
return res.json({ message: "User already exists" });
}

// hash password
const hashedPassword = await bcrypt.hash(password, 10);

// create new user
const newUser = new User({
name,
branch,
session,
regno,
email,
password: hashedPassword,
role
});

await newUser.save();

res.json({
message: "User Registered Successfully"
});

} catch (error) {

console.error(error);
res.status(500).json({ message: "Server Error" });

}

});


// ================== LOGIN ==================
router.post("/login", async (req, res) => {

try {

const { email, password } = req.body;

// find user
const user = await User.findOne({ email });

if (!user) {
return res.status(401).json({ message: "User not found" });
}

// compare password
const isMatch = await bcrypt.compare(password, user.password);

if (!isMatch) {
return res.status(401).json({ message: "Incorrect password" });
}

// success
res.json({
message: "Login successful",
role: user.role,
user: user.name
});

} catch (error) {

console.error(error);
res.status(500).json({ message: "Server Error" });

}

});

module.exports = router;