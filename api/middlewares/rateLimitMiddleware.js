const rateLimit = require("express-rate-limit");

const chatbotRateLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 5, // Limit each IP to 5 requests per `window` (here, per minute)
    message: {
        success: false,
        message: "Bạn đã gửi quá nhiều yêu cầu. Vui lòng đợi 1 phút trước khi tiếp tục."
    },
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

module.exports = { chatbotRateLimiter };
