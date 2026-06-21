const mongoose = require("mongoose");

const connectDB = async () => {
  try {

    await mongoose.connect(
      "mongodb+srv://piyushk350m_db_user:dVWNXAXrT5wOysy9@cluster0.ajvzdtb.mongodb.net/myapp?retryWrites=true&w=majority"
    );

    console.log("MongoDB Connected ✅");

  } catch (error) {
    console.error("Database connection failed:", error.message);
process.exit(1);
  }
};

module.exports = connectDB;