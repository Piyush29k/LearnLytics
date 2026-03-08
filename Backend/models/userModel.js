const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
name: {
type: String,
required: true
},

branch: String,

session: String,

regno: String,

email: {
type: String,
required: true,
unique: true
},

password: {
type: String,
required: true
},

role: {
type: String,
enum: ["student", "faculty"],
default: "student"
}

});


module.exports = mongoose.model("User", userSchema);