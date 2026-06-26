const mongoose = require("mongoose");

const connectDB = async () => {
  try {
    const uri =
      process.env.MONGODB_URI ||
      "mongodb+srv://piyushk350m_db_user:dVWNXAXrT5wOysy9@cluster0.ajvzdtb.mongodb.net/myapp?retryWrites=true&w=majority";

    await mongoose.connect(uri);

    console.log("MongoDB Connected ✅");

  } catch (error) {
    console.error("Database connection failed:", error.message);
process.exit(1);
  }
};

module.exports = connectDB;
