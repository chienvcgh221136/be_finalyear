const jwt = require("jsonwebtoken");

const authenticate = (req, res, next) => {
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
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ success: false, message: "Invalid token" });
  }
};

const optionalAuthenticate = (req, res, next) => {
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
    req.user = decoded;
    next();
  } catch (err) {
    // If token is invalid, we just don't set req.user and proceed
    next();
  }
};

module.exports = authenticate; // Default export for backwards compatibility
module.exports.authenticate = authenticate;
module.exports.optionalAuthenticate = optionalAuthenticate;
