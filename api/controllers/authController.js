const User = require("../models/UserModel");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

exports.register = async (req, res) => {
    try {
        const { name, email, password, phone } = req.body;
        if (!name || !email || !password || !phone)
            return res.status(400).json({
                success: false,
                message: "Missing fields"
            });

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
        const { email, password } = req.body;
        if (!email || !password)
            return res.status(400).json({
                success: false,
                message: "Missing email or password"
            });

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

        // Set Cookies
        res.cookie('accessToken', accessToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 1 * 24 * 60 * 60 * 1000 // 1 day
        });

        res.cookie('refreshToken', refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
        });

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

        res.cookie('accessToken', newAccessToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 1 * 24 * 60 * 60 * 1000
        });

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

    res.clearCookie('accessToken');
    res.clearCookie('refreshToken');
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
        const { sub: googleId, email, name, picture } = payload;

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

        res.cookie('accessToken', accessToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 1 * 24 * 60 * 60 * 1000
        });

        res.cookie('refreshToken', refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 7 * 24 * 60 * 60 * 1000
        });

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


