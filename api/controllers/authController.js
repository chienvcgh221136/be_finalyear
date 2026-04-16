const User = require("../models/UserModel");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const calculatePasswordStrength = (password) => {
    if (!password) return 0;
    let score = 0;
    if (password.length >= 8) score += 25;
    if (/[A-Z]/.test(password)) score += 15;
    if (/[a-z]/.test(password)) score += 15;
    if (/[0-9]/.test(password)) score += 20;
    if (/[^A-Za-z0-9]/.test(password)) score += 25;
    return score;
};

exports.register = async (req, res) => {
    try {
        let { name, email, password, phone } = req.body;
        if (!name || !email || !password || !phone)
            return res.status(400).json({
                success: false,
                message: "Missing fields"
            });

        email = email.toLowerCase();

        const score = calculatePasswordStrength(password);
        if (score < 70) {
            return res.status(400).json({
                success: false,
                message: "Mật khẩu quá yếu. Cần đạt ít nhất 70% mức độ an toàn."
            });
        }

        const existEmail = await User.findOne({ email });
        if (existEmail) return res.status(400).json({
            success: false,
            message: "Email already exists"
        });

        const existPhone = await User.findOne({ phone });
        if (existPhone) return res.status(400).json({
            success: false,
            message: "Phone already exists"
        });

        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(password, salt);

        const user = await User.create({
            name, email, passwordHash, phone, isVerified: true
        });

        const token = jwt.sign({ userId: user._id, role: user.role },
            process.env.JWT_SECRET, { expiresIn: "1d" });

        res.status(201).json({
            success: true,
            token,
            data: { id: user._id, name: user.name, email: user.email, phone: user.phone, role: user.role }
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            message: "Register failed", error: err.message
        });
    }
};

exports.login = async (req, res) => {
    try {
        let { email, password } = req.body;
        if (!email || !password)
            return res.status(400).json({
                success: false,
                message: "Missing email or password"
            });

        email = email.toLowerCase();

        const user = await User.findOne({ email });
        if (!user)
            return res.status(401).json({
                success: false,
                message: "Invalid credentials"
            });

        if (user.isBanned)
            return res.status(403).json({
                success: false,
                message: "User is banned"
            });

        const isMatch = await bcrypt.compare(password, user.passwordHash);
        if (!isMatch)
            return res.status(401).json({
                success: false,
                message: "Invalid credentials"
            });

        const accessToken = jwt.sign(
            { userId: user._id, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: "1d" }
        );

        const refreshToken = jwt.sign(
            { userId: user._id },
            process.env.JWT_REFRESH_SECRET,
            { expiresIn: "7d" }
        );

        user.refreshToken = refreshToken;
        await user.save();

        // Define shared cookie options
        const cookieOptions = {
            httpOnly: true,
            secure: true, // Always true for cross-domain HTTPS (Render/Vercel)
            sameSite: 'none',
            maxAge: 1 * 24 * 60 * 60 * 1000 // 1 day
        };

        // If in development (localhost), use more relaxed settings
        if (process.env.NODE_ENV !== 'production') {
            cookieOptions.secure = false;
            cookieOptions.sameSite = 'lax';
        }

        res.cookie('accessToken', accessToken, cookieOptions);

        res.cookie('refreshToken', refreshToken, {
            ...cookieOptions,
            maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
        });

        // --- DAILY LOGIN POINTS ---
        try {
            const PointLog = require("../models/PointLogModel");
            const pointController = require("./pointController");

            const startOfDay = new Date();
            startOfDay.setHours(0, 0, 0, 0);

            const hasLoginPoints = await PointLog.findOne({
                userId: user._id,
                action: "DAILY_LOGIN",
                createdAt: { $gte: startOfDay }
            });

            if (!hasLoginPoints) {
                await pointController.addPoints(user._id, "DAILY_LOGIN", 10);
            }
        } catch (pointErr) {
            console.error("Daily login point error:", pointErr);
        }

        res.json({
            success: true,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                phone: user.phone,
                role: user.role,
                rating: user.rating,
                totalReviews: user.totalReviews
            }
        });

    } catch (err) {
        res.status(500).json({
            success: false,
            message: "Login error", error: err.message
        });
    }
};

exports.refreshToken = async (req, res) => {
    const refreshToken = req.cookies.refreshToken; // Read from cookie
    if (!refreshToken)
        return res.status(400).json({ success: false, message: "Refresh Token is required" });

    try {
        const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
        const user = await User.findById(decoded.userId);

        if (!user || user.refreshToken !== refreshToken)
            return res.status(403).json({ success: false, message: "Invalid Refresh Token" });

        const newAccessToken = jwt.sign(
            { userId: user._id, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: "1d" }
        );

        const cookieOptions = {
            httpOnly: true,
            secure: true,
            sameSite: 'none',
            maxAge: 1 * 24 * 60 * 60 * 1000
        };

        if (process.env.NODE_ENV !== 'production') {
            cookieOptions.secure = false;
            cookieOptions.sameSite = 'lax';
        }

        res.cookie('accessToken', newAccessToken, cookieOptions);

        res.json({ success: true, accessToken: newAccessToken });
    } catch (err) {
        res.status(403).json({ success: false, message: "Invalid or expired Refresh Token" });
    }
};

exports.logout = async (req, res) => {
    const refreshToken = req.cookies.refreshToken;
    if (refreshToken) {
        // Optional: clear from DB if needed
    }

    const cookieOptions = {
        httpOnly: true,
        secure: true,
        sameSite: 'none'
    };
    if (process.env.NODE_ENV !== 'production') {
        cookieOptions.secure = false;
        cookieOptions.sameSite = 'lax';
    }

    res.clearCookie('accessToken', cookieOptions);
    res.clearCookie('refreshToken', cookieOptions);
    res.json({ success: true, message: "Logged out successfully" });
};

const { OAuth2Client } = require('google-auth-library');
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

exports.googleLogin = async (req, res) => {
    try {
        const { token } = req.body;
        if (!token) return res.status(400).json({ success: false, message: "No token provided" });

        const ticket = await client.verifyIdToken({
            idToken: token,
            audience: process.env.GOOGLE_CLIENT_ID,
        });
        const payload = ticket.getPayload();
        const { sub: googleId, name, picture } = payload;
        const email = payload.email.toLowerCase();

        let user = await User.findOne({
            $or: [{ googleId }, { email }]
        });

        if (user) {
            if (!user.googleId) {
                user.googleId = googleId;
                if (!user.avatar) user.avatar = picture;
                if (user.isVerified === false) user.isVerified = true;
                await user.save();
            }
            if (user.isBanned) {
                return res.status(403).json({ success: false, message: "User is banned" });
            }
        } else {
            user = await User.create({
                name,
                email,
                googleId,
                avatar: picture,
                isVerified: true,
                role: "USER"
            });
        }

        const accessToken = jwt.sign(
            { userId: user._id, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: "1d" }
        );

        const refreshToken = jwt.sign(
            { userId: user._id },
            process.env.JWT_REFRESH_SECRET,
            { expiresIn: "7d" }
        );

        user.refreshToken = refreshToken;
        await user.save();

        const cookieOptions = {
            httpOnly: true,
            secure: true,
            sameSite: 'none',
            maxAge: 1 * 24 * 60 * 60 * 1000
        };

        if (process.env.NODE_ENV !== 'production') {
            cookieOptions.secure = false;
            cookieOptions.sameSite = 'lax';
        }

        res.cookie('accessToken', accessToken, cookieOptions);

        res.cookie('refreshToken', refreshToken, {
            ...cookieOptions,
            maxAge: 7 * 24 * 60 * 60 * 1000
        });

        // --- DAILY LOGIN POINTS ---
        try {
            const PointLog = require("../models/PointLogModel");
            const pointController = require("./pointController");

            const startOfDay = new Date();
            startOfDay.setHours(0, 0, 0, 0);

            const hasLoginPoints = await PointLog.findOne({
                userId: user._id,
                action: "DAILY_LOGIN",
                createdAt: { $gte: startOfDay }
            });

            if (!hasLoginPoints) {
                await pointController.addPoints(user._id, "DAILY_LOGIN", 10);
            }
        } catch (pointErr) {
            console.error("Daily login point error (Google):", pointErr);
        }

        res.json({
            success: true,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                phone: user.phone,
                role: user.role,
                rating: user.rating,
                totalReviews: user.totalReviews,
                avatar: user.avatar
            }
        });

    } catch (err) {
        console.error("Google Login Error:", err);
        res.status(500).json({ success: false, message: "Google Login failed", error: err.message });
    }
};

exports.forgotPasswordCheckEmail = async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) return res.status(400).json({ success: false, message: "Email is required" });

        const user = await User.findOne({ email: email.toLowerCase() });
        if (!user) return res.status(404).json({ success: false, message: "Email không tồn tại trong hệ thống" });

        res.json({ success: true, message: "Email hợp lệ" });
    } catch (err) {
        res.status(500).json({ success: false, message: "Lỗi kiểm tra email", error: err.message });
    }
};

exports.forgotPasswordSendOTP = async (req, res) => {
    try {
        const { email, phone } = req.body;
        if (!email || !phone) return res.status(400).json({ success: false, message: "Missing email or phone" });

        const user = await User.findOne({
            email: email.toLowerCase(),
            phone: phone.trim()
        });

        if (!user) return res.status(400).json({ success: false, message: "Số điện thoại không khớp với email đã đăng ký" });

        const crypto = require("crypto");
        const otp = crypto.randomInt(100000, 999999).toString();
        const otpExpires = Date.now() + 5 * 60 * 1000; // 5 minutes

        user.resetPasswordOTP = otp;
        user.resetPasswordOTPExpires = otpExpires;
        await user.save();

        const emailService = require("../services/emailService");
        const reqLang = req.headers['accept-language']?.substring(0, 2) || user.language || 'vi';
        await emailService.sendPasswordResetOTP(user.email, user.name, otp, reqLang);

        res.json({ success: true, message: "Mã OTP đã được gửi đến email của bạn" });
    } catch (err) {
        res.status(500).json({ success: false, message: "Lỗi gửi OTP", error: err.message });
    }
};

exports.forgotPasswordVerifyOTP = async (req, res) => {
    try {
        const { email, otp } = req.body;
        if (!email || !otp) return res.status(400).json({ success: false, message: "Missing email or OTP" });

        const user = await User.findOne({
            email: email.toLowerCase()
        }).select("+resetPasswordOTP +resetPasswordOTPExpires");

        if (!user) return res.status(404).json({ success: false, message: "User not found" });

        if (user.resetPasswordOTP !== otp || user.resetPasswordOTPExpires < Date.now()) {
            return res.status(400).json({ success: false, message: "Mã OTP không đúng hoặc đã hết hạn" });
        }

        res.json({ success: true, message: "Xác thực OTP thành công" });
    } catch (err) {
        res.status(500).json({ success: false, message: "Lỗi xác thực OTP", error: err.message });
    }
};

exports.resetPassword = async (req, res) => {
    try {
        const { email, otp, newPassword } = req.body;
        if (!email || !otp || !newPassword) return res.status(400).json({ success: false, message: "Missing fields" });

        const score = calculatePasswordStrength(newPassword);
        if (score < 70) {
            return res.status(400).json({
                success: false,
                message: "Mật khẩu mới quá yếu. Cần đạt ít nhất 70% mức độ an toàn."
            });
        }

        const user = await User.findOne({
            email: email.toLowerCase()
        }).select("+resetPasswordOTP +resetPasswordOTPExpires");

        if (!user) return res.status(404).json({ success: false, message: "User not found" });

        if (user.resetPasswordOTP !== otp || user.resetPasswordOTPExpires < Date.now()) {
            return res.status(400).json({ success: false, message: "Mã OTP không đúng hoặc đã hết hạn" });
        }

        const salt = await bcrypt.genSalt(10);
        user.passwordHash = await bcrypt.hash(newPassword, salt);

        // Clear OTP fields
        user.resetPasswordOTP = undefined;
        user.resetPasswordOTPExpires = undefined;

        await user.save();

        res.json({ success: true, message: "Đổi mật khẩu thành công" });
    } catch (err) {
        res.status(500).json({ success: false, message: "Lỗi đổi mật khẩu", error: err.message });
    }
};
