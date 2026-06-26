const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    branch: {
      type: String,
      trim: true,
      default: "",
    },

    session: {
      type: String,
      trim: true,
      default: "",
    },

    regno: {
      type: String,
      trim: true,
      default: "",
    },

    rollNo: {
      type: String,
      trim: true,
      default: "",
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    password: {
      type: String,
      required: true,
    },

    role: {
      type: String,
      enum: ["student", "faculty", "admin"],
      default: "student",
    },
  },
  { timestamps: true }
);


module.exports = mongoose.model("User", userSchema);
