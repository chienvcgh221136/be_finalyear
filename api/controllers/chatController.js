const ChatRoom = require("../models/ChatRoomModel");
const Message = require("../models/MessageModel");
const User = require("../models/UserModel");

// Create or Get Chat Room
exports.createOrGetChat = async (req, res) => {
    try {
        const { postId, sellerId } = req.body;
        const buyerId = req.user.userId;

        if (!postId || !sellerId) {
            return res.status(400).json({ success: false, message: "Missing required fields" });
        }

        // Prevent self-chat
        if (buyerId === sellerId) {
            return res.status(400).json({ success: false, message: "Không thể tự nhắn tin cho chính mình" });
        }

        // Check if chat room exists between these two users (regardless of post)
        let chatRoom = await ChatRoom.findOne({
            userIds: { $all: [buyerId, sellerId] }
        });

        if (chatRoom) {
            // Chat exists, update the context (postId) to the new post
            chatRoom.postId = postId;
            chatRoom.lastMessageAt = Date.now(); // Optional: bump time or just keep

            // If the user had previously deleted this chat, un-delete it
            if (chatRoom.deletedBy && chatRoom.deletedBy.includes(buyerId)) {
                chatRoom.deletedBy = chatRoom.deletedBy.filter(id => id.toString() !== buyerId);
            }

            await chatRoom.save();
        } else {
            // Create new chat room
            chatRoom = await ChatRoom.create({
                postId,
                userIds: [buyerId, sellerId],
                lastMessage: "",
                lastMessageAt: Date.now(),
                deletedBy: []
            });

            // Initialize empty message document
            await Message.create({
                chatRoomId: chatRoom._id,
                messages: []
            });
        }

        res.json({ success: true, chatRoom });
    } catch (error) {
        console.error("Create chat error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// Get My Chats
// Get My Chats
// Get My Chats
exports.getMyChats = async (req, res) => {
    try {
        const userId = req.user.userId;
        console.log("getMyChats request for userId:", userId);

        // Use lean() to get plain JavaScript objects we can modify
        const chats = await ChatRoom.find({
            userIds: userId,
            deletedBy: { $ne: userId } // Exclude chats deleted by this user
        })
            .populate("userIds", "name avatar email blockedUsers") // Fetch blockedUsers to check status
            .populate("postId", "title images price address userId") // Added userId to populate
            .sort({ lastMessageAt: -1 })
            .lean();

        // Fetch all message documents for these chats to count unread
        const chatRoomIds = chats.map(c => c._id);
        const messageDocs = await Message.find({ chatRoomId: { $in: chatRoomIds } }).lean();

        // Calculate unread count for each chat & check block status
        const chatsWithUnread = chats.map(chat => {
            const msgDoc = messageDocs.find(m => m.chatRoomId.toString() === chat._id.toString());
            let unreadCount = 0;
            if (msgDoc && msgDoc.messages) {
                // Count messages NOT sent by me and NOT read
                unreadCount = msgDoc.messages.filter(msg =>
                    msg.senderId.toString() !== userId && !msg.isRead
                ).length;
            }

            // Check if I am blocked by the other user
            const otherUser = chat.userIds.find(u => u._id.toString() !== userId);
            let blockedByOther = false;

            if (otherUser && otherUser.blockedUsers) {
                // Check if my ID is in their blocked list
                blockedByOther = otherUser.blockedUsers.some(id => id.toString() === userId);
                // Remove blockedUsers list from output for privacy
                delete otherUser.blockedUsers;
            }

            return { ...chat, unreadCount, blockedByOther };
        });

        console.log(`Found ${chatsWithUnread.length} chats for user ${userId}`);

        res.json({ success: true, chats: chatsWithUnread });
    } catch (error) {
        console.error("Get chats error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// Get Messages
exports.getMessages = async (req, res) => {
    try {
        const { chatRoomId } = req.params;
        const messages = await Message.findOne({ chatRoomId });

        if (!messages) {
            // Return empty structure consistent with MessageData type
            return res.json({ success: true, data: { messages: [] } });
        }

        res.json({ success: true, data: messages });
    } catch (error) {
        console.error("Get messages error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// Send Message
exports.sendMessage = async (req, res) => {
    try {
        const { chatRoomId } = req.params;
        const { content, type = "TEXT" } = req.body; // Accept type
        const senderId = req.user.userId;

        if (!content) {
            return res.status(400).json({ success: false, message: "Content is required" });
        }

        const chatRoom = await ChatRoom.findById(chatRoomId);
        if (!chatRoom) {
            return res.status(404).json({ success: false, message: "Chat room not found" });
        }

        // Check for blocked users
        const receiverId = chatRoom.userIds.find(id => id.toString() !== senderId);

        // Check if sender has blocked receiver OR receiver has blocked sender
        const sender = await User.findById(senderId);
        const receiver = await User.findById(receiverId);

        if (sender.blockedUsers && sender.blockedUsers.includes(receiverId)) {
            return res.status(403).json({ success: false, message: "You have blocked this user. Unblock to send message." });
        }

        if (receiver.blockedUsers && receiver.blockedUsers.includes(senderId)) {
            return res.status(403).json({ success: false, message: "You identify as blocked by this user." });
        }


        // Find the message document for this chat room
        let messageDoc = await Message.findOne({ chatRoomId });
        if (!messageDoc) {
            messageDoc = await Message.create({
                chatRoomId,
                messages: []
            });
        }

        const newMessage = {
            senderId,
            content,
            type,
            isRead: false,
            createdAt: new Date()
        };

        // Push new message to array
        messageDoc.messages.push(newMessage);
        await messageDoc.save();

        // Update ChatRoom lastMessage
        // Also un-delete the chat for the receiver if they deleted it
        const updateData = {
            lastMessage: type === 'IMAGE' ? '[Hình ảnh]' : content,
            lastMessageAt: new Date()
        };

        if (chatRoom.deletedBy.includes(receiverId)) {
            // Remove receiverId from deletedBy
            updateData.$pull = { deletedBy: receiverId };
        }

        await ChatRoom.findByIdAndUpdate(chatRoomId, updateData);

        res.json({ success: true, newMessage });
    } catch (error) {
        console.error("Send message error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// Search Messages
exports.searchMessages = async (req, res) => {
    try {
        const userId = req.user.userId;
        const { query } = req.query;

        if (!query) return res.json({ success: true, results: [] });

        // 1. Find all chats user is involved in
        const userChats = await ChatRoom.find({ userIds: userId }).select('_id');
        const chatRoomIds = userChats.map(c => c._id);

        // 2. Search in Message collection
        // We need to find documents where 'messages.content' matches query
        // But we want individual messages. Aggregate is best here.
        const results = await Message.aggregate([
            { $match: { chatRoomId: { $in: chatRoomIds } } },
            { $unwind: "$messages" },
            {
                $match: {
                    "messages.content": { $regex: query, $options: "i" }
                    // Optional: Filter by type TEXT if needed, but maybe searching URL text is okay or not.
                }
            },
            {
                $project: {
                    chatRoomId: 1,
                    message: "$messages"
                }
            },
            { $sort: { "message.createdAt": -1 } },
            { $limit: 20 }
        ]);

        // Populate chat info for context (optional, but finding which chat it belongs to is helpful)
        // We can do a second query to get chat details if needed, or frontend can map id

        res.json({ success: true, results });

    } catch (error) {
        console.error("Search messages error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// Mark Messages as Read
exports.markAsRead = async (req, res) => {
    try {
        const { chatRoomId } = req.params;
        const userId = req.user.userId;

        // Find message doc
        const messageDoc = await Message.findOne({ chatRoomId });
        if (!messageDoc) {
            return res.status(404).json({ success: false, message: "Chat not found" });
        }

        // Update all messages where sender is NOT me (i.e. I am reading them) and isRead is false
        let updated = false;
        messageDoc.messages.forEach(msg => {
            if (msg.senderId.toString() !== userId && !msg.isRead) {
                msg.isRead = true;
                updated = true;
            }
        });

        if (updated) {
            await messageDoc.save();
        }

        res.json({ success: true, updated });
    } catch (error) {
        console.error("Mark read error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};
// Delete Chat (Soft Delete)
exports.deleteChat = async (req, res) => {
    try {
        const { chatRoomId } = req.params;
        const userId = req.user.userId;

        // Check if chat exists and belongs to user
        const chatRoom = await ChatRoom.findOne({
            _id: chatRoomId,
            userIds: userId
        });

        if (!chatRoom) {
            return res.status(404).json({ success: false, message: "Chat not found or unauthorized" });
        }

        // Add user to deletedBy array if not already there
        if (!chatRoom.deletedBy.includes(userId)) {
            chatRoom.deletedBy.push(userId);
            await chatRoom.save();
        }

        res.json({ success: true, message: "Chat deleted found successfully" });
    } catch (error) {
        console.error("Delete chat error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// Set Nickname
exports.setNickname = async (req, res) => {
    try {
        const { chatRoomId } = req.params;
        const { targetUserId, nickname } = req.body;
        const requesterId = req.user.userId;

        const chatRoom = await ChatRoom.findOne({
            _id: chatRoomId,
            userIds: requesterId
        });

        if (!chatRoom) {
            return res.status(404).json({ success: false, message: "Chat room not found or you are not a participant" });
        }

        // Initialize nicknames map if it doesn't exist
        if (!chatRoom.nicknames) {
            chatRoom.nicknames = new Map();
        }

        if (nickname && nickname.trim()) {
            chatRoom.nicknames.set(targetUserId, nickname.trim());
        } else {
            chatRoom.nicknames.delete(targetUserId);
        }

        await chatRoom.save();

        res.json({ success: true, message: "Nickname updated", nicknames: chatRoom.nicknames });
    } catch (error) {
        console.error("Set nickname error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};
