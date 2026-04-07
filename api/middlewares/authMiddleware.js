const jwt = require("jsonwebtoken");

const authenticate = async (req, res, next) => {
  let token;

  if (req.cookies.accessToken) {
    token = req.cookies.accessToken;
  } else if (req.headers.authorization && req.headers.authorization.startsWith("Bearer ")) {
    token = req.headers.authorization.split(" ")[1];
  }

  if (!token)
    return res.status(401).json({
      success: false,
      message: "Unauthorized - No Token"
    });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const User = require("../models/UserModel");
    const user = await User.findById(decoded.userId);
    
    if (!user) {
      return res.status(401).json({ success: false, message: "User not found" });
    }
    
    if (user.isBanned) {
      return res.status(403).json({ success: false, message: "Account is banned" });
    }

    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ success: false, message: "Invalid token" });
  }
};

const optionalAuthenticate = async (req, res, next) => {
  let token;

  if (req.cookies.accessToken) {
    token = req.cookies.accessToken;
  } else if (req.headers.authorization && req.headers.authorization.startsWith("Bearer ")) {
    token = req.headers.authorization.split(" ")[1];
  }

  if (!token) {
    return next();
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const User = require("../models/UserModel");
    const user = await User.findById(decoded.userId);
    
    if (user && !user.isBanned) {
        req.user = decoded;
    }
    next();
  } catch (err) {
    // If token is invalid, we just don't set req.user and proceed
    next();
  }
};

module.exports = authenticate; // Default export for backwards compatibility
module.exports.authenticate = authenticate;
module.exports.optionalAuthenticate = optionalAuthenticate;
