const mongoose = require("mongoose");

const ChatRoomSchema = new mongoose.Schema({
    postId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Post",
        required: true
    },
    userIds: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
    }],
    lastMessage: {
        type: String,
        default: ""
    },
    lastMessageAt: {
        type: Date,
        default: Date.now
    },
    nicknames: {
        type: Map,
        of: String,
        default: {}
    },
    deletedBy: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
    }]
}, { timestamps: true, collection: "chat_rooms" });

module.exports = mongoose.model("ChatRoom", ChatRoomSchema);
