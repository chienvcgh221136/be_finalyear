const mongoose = require("mongoose");


const MessageItemSchema = new mongoose.Schema({
    senderId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    content: {
        type: String,
        required: true
    },
    type: {
        type: String,
        enum: ["TEXT", "IMAGE"],
        default: "TEXT"
    },
    isRead: {
        type: Boolean,
        default: false
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
}, { timestamps: true });


const MessageSchema = new mongoose.Schema({
    chatRoomId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "ChatRoom",
        required: true
    },
    messages: [MessageItemSchema]
}, { timestamps: true, collection: "messages" });

MessageSchema.index({ chatRoomId: 1 });

module.exports = mongoose.model("Message", MessageSchema);
