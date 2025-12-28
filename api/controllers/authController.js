const User = require("../models/UserModel");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

exports.register = async (req, res) => {
  try {
    const { name, email, password, phone } = req.body;
    if (!name || !email || !password || !phone)
        return res.status(400).json({
            success:false,
            message:"Missing fields"
        });

    const existEmail = await User.findOne({ email });
        if (existEmail) return res.status(400).json({ 
            success:false,
            message:"Email already exists"
        });

    const existPhone = await User.findOne({ phone }); 
        if (existPhone) return res.status(400).json({ 
            success:false,
            message:"Phone already exists" 
        });

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const user = await User.create({
        name,email,passwordHash,phone,isVerified:true 
    });

    const token = jwt.sign({ id:user._id, role:user.role }, 
        process.env.JWT_SECRET, { expiresIn:"1d" });

    res.status(201).json({
        success:true,
        token,
        data:{ id:user._id,name:user.name,email:user.email,phone:user.phone,role:user.role } 
    });
  } catch (err) {
    res.status(500).json({
        success:false,
        message:"Register failed",error:err.message 
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

    const token = jwt.sign({ userId: user._id, role: user.role }, 
                             process.env.JWT_SECRET, { expiresIn: "7d" });

    res.json({ 
        success: true, token, 
        user: { id: user._id, name: user.name, email: user.email, phone: user.phone, role: user.role, rating: user.rating, totalReviews: user.totalReviews } });
    } catch (err) {
    res.status(500).json({ 
        success: false, 
        message: "Login error", error: err.message
    });
  }
};
