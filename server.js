require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

const userRoutes = require("./api/routes/userRoutes");
const authRoutes = require("./api/routes/authRoutes");
const postRoutes=require("./api/routes/postRoutes");
const leadRoutes=require("./api/routes/leadRoutes");
const appointmentRoutes=require("./api/routes/appointmentRoutes");
const favoriteRoutes=require("./api/routes/favoriteRoutes");
const reviewRoutes=require("./api/routes/reviewRoutes");
const adminRoutes = require("./api/routes/adminRoutes");
const reportRoutes = require("./api/routes/reportRoutes");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api/users", userRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/posts",postRoutes);
app.use("/api/leads",leadRoutes);
app.use("/api/appointments",appointmentRoutes);
app.use("/api/favorites",favoriteRoutes);
app.use("/api/reviews",reviewRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/reports", reportRoutes);


mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log("✅ MongoDB connected successfully");
    app.listen(PORT, () => {
      console.log(`🚀 Server running at http://localhost:${PORT}`);
    });
  })
 
