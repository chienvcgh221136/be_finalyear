const mongoose = require("mongoose");

/*
Data structure from user:
{
  "_id": "...",
  "chatRoomId": "...",
  "messages": [
    { "senderId": "...", "content": "...", "isRead": false, "createdAt": "..." }
  ]
}
*/

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
// _id: false because we might not need individual IDs for messages inside the array, 
// but if the user wants to reference them, we might need them. 
// Given the sample data provided, the messages inside the array didn't explicitly show _id, 
// but usually Mongoose adds them. 
// I'll keep _id: false for now to match the "embedded document" style unless specific need arises.
// Actually, let's enable _id just in case for React keys.
// Re-reading user request: "data của messages" shows array of objects.
// Let's remove { _id: false } to be safe.

const MessageSchema = new mongoose.Schema({
    chatRoomId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "ChatRoom",
        required: true
    },
    messages: [MessageItemSchema]
}, { timestamps: true, collection: "messages" });

module.exports = mongoose.model("Message", MessageSchema);
