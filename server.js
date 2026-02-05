require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

const userRoutes = require("./api/routes/userRoutes");
const authRoutes = require("./api/routes/authRoutes");
const postRoutes = require("./api/routes/postRoutes");
const leadRoutes = require("./api/routes/leadRoutes");
const appointmentRoutes = require("./api/routes/appointmentRoutes");
const favoriteRoutes = require("./api/routes/favoriteRoutes");
const reviewRoutes = require("./api/routes/reviewRoutes");
const adminRoutes = require("./api/routes/adminRoutes");
const reportRoutes = require("./api/routes/reportRoutes");
const notificationRoutes = require("./api/routes/notificationRoutes");

const uploadRoutes = require("./api/routes/uploadRoutes");
const walletRoutes = require("./api/routes/walletRoutes");
const vipRoutes = require("./api/routes/vipRoutes");
const withdrawRoutes = require("./api/routes/withdrawRoutes");
const statsRoutes = require("./api/routes/statsRoutes");
const path = require("path");
const chatRoutes = require("./api/routes/chatRoutes");
require("./api/cron/withdrawCron"); // Start Cron Jobs
require("./api/cron/vipCron");
require("./api/cron/appointmentCron");

const cookieParser = require("cookie-parser");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({
  origin: ["http://localhost:5173", "http://localhost:5174", "http://localhost:5175", "http://127.0.0.1:5173"],
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.use("/api/users", userRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/posts", postRoutes);
app.use("/api/leads", leadRoutes);
app.use("/api/appointments", appointmentRoutes);
app.use("/api/favorites", favoriteRoutes);
app.use("/api/reviews", reviewRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/notifications", notificationRoutes);

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use("/api/chat", chatRoutes);
app.use("/api/upload", uploadRoutes);
app.use("/api/wallet", walletRoutes);
app.use("/api/vip", vipRoutes);
app.use("/api/withdraw", withdrawRoutes);
app.use("/api/stats", statsRoutes);
app.use("/api/comments", require("./api/routes/commentRoutes"));


mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log("✅ MongoDB connected successfully");
    app.listen(PORT, () => {
      console.log(`🚀 Server running at http://localhost:${PORT}`);
    });
  })

