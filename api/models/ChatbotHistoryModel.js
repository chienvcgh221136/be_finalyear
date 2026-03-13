const mongoose = require("mongoose");

const ChatbotHistorySchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        unique: true
    },
    messages: [
        {
            role: { type: String, enum: ["user", "assistant"], required: true },
            content: { type: String, required: true },
            posts: { type: Array, default: [] },
            timestamp: { type: Date, default: Date.now }
        }
    ]
}, { timestamps: true, collection: "chatbot_history" });

module.exports = mongoose.model("ChatbotHistory", ChatbotHistorySchema);
