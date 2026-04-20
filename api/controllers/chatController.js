const ChatRoom = require("../models/ChatRoomModel");
const Message = require("../models/MessageModel");
const User = require("../models/UserModel");

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


exports.getMyChats = async (req, res) => {
    try {
        const userId = req.user.userId;

        // Fetch all rooms user is part of
        const allChats = await ChatRoom.find({
            userIds: userId
        })
            .populate("userIds", "name avatar email blockedUsers")
            .populate("postId", "title images price address userId")
            .sort({ lastMessageAt: -1 })
            .lean();

        // Filter chats: include if NEVER deleted OR lastMessageAt > deletedAt
        const chats = allChats.filter(chat => {
            const deletedAt = chat.deletedAt ? chat.deletedAt[userId] : null;
            if (!deletedAt) return true;
            return new Date(chat.lastMessageAt) > new Date(deletedAt);
        });

        // Fetch all message documents for these chats to count unread
        const chatRoomIds = chats.map(c => c._id);
        const messageDocs = await Message.find({ chatRoomId: { $in: chatRoomIds } }).lean();

        // Calculate unread count for each chat & check block status
        const chatsWithUnread = chats.map(chat => {
            const msgDoc = messageDocs.find(m => m.chatRoomId.toString() === chat._id.toString());
            let unreadCount = 0;
            const deletedAt = chat.deletedAt ? chat.deletedAt[userId] : null;

            if (msgDoc && msgDoc.messages) {
                // Count messages NOT sent by me, NOT read, and AFTER my deletion timestamp
                unreadCount = msgDoc.messages.filter(msg => {
                    const isNotMe = msg.senderId.toString() !== userId;
                    const isUnread = !msg.isRead;
                    const isAfterDelete = deletedAt ? new Date(msg.createdAt) > new Date(deletedAt) : true;
                    return isNotMe && isUnread && isAfterDelete;
                }).length;
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


        res.json({ success: true, chats: chatsWithUnread });
    } catch (error) {
        console.error("Get chats error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.getMessages = async (req, res) => {
    try {
        const { chatRoomId } = req.params;
        const userId = req.user.userId;

        const chatRoom = await ChatRoom.findById(chatRoomId);
        if (!chatRoom) {
            return res.status(404).json({ success: false, message: "Chat room not found" });
        }

        const messageDoc = await Message.findOne({ chatRoomId });

        if (!messageDoc) { 
            return res.json({ success: true, data: { messages: [] } });
        }

        const deletedAt = chatRoom.deletedAt && chatRoom.deletedAt.get(userId);
        let filteredMessages = messageDoc.messages;

        if (deletedAt) {
            filteredMessages = messageDoc.messages.filter(msg =>
                new Date(msg.createdAt) > new Date(deletedAt)
            );
        }

        res.json({ success: true, data: { ...messageDoc.toObject(), messages: filteredMessages } });
    } catch (error) {
        console.error("Get messages error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.sendMessage = async (req, res) => {
    try {
        const { chatRoomId } = req.params;
        const { content, type = "TEXT" } = req.body;
        const senderId = req.user.userId;

        if (!content) {
            return res.status(400).json({ success: false, message: "Content is required" });
        }

        const chatRoom = await ChatRoom.findById(chatRoomId);
        if (!chatRoom) {
            return res.status(404).json({ success: false, message: "Chat room not found" });
        }

        const receiverId = chatRoom.userIds.find(id => id.toString() !== senderId);

        // Fetch users in parallel
        const [sender, receiver] = await Promise.all([
            User.findById(senderId),
            User.findById(receiverId)
        ]);

        if (!sender) {
            return res.status(404).json({ success: false, message: "Sender not found" });
        }

        // Check blocking with string conversion for reliability
        const senderBlockedOthers = sender.blockedUsers?.some(id => id.toString() === receiverId?.toString());
        if (senderBlockedOthers) {
            return res.status(403).json({ success: false, message: "Bạn đã chặn người dùng này. Hãy bỏ chặn để gửi tin nhắn." });
        }

        const receiverBlockedSender = receiver?.blockedUsers?.some(id => id.toString() === senderId.toString());
        if (receiverBlockedSender) {
            return res.status(403).json({ success: false, message: "Bạn không thể gửi tin nhắn cho người dùng này." });
        }

        // Find or create the message document
        let messageDoc = await Message.findOne({ chatRoomId });
        if (!messageDoc) {
            messageDoc = await Message.create({ chatRoomId, messages: [] });
        }

        const newMessage = {
            senderId,
            content,
            type,
            isRead: false,
            createdAt: new Date()
        };

        messageDoc.messages.push(newMessage);
        
        // Update both in parallel
        const updateData = {
            $set: {
                lastMessage: type === 'IMAGE' ? '[Hình ảnh]' : content,
                lastMessageAt: new Date()
            },
            $pull: { deletedBy: { $in: [senderId, receiverId] } }
        };

        await Promise.all([
            messageDoc.save(),
            ChatRoom.updateOne({ _id: chatRoomId }, updateData)
        ]);

        // Emit real-time event via Socket.io
        const io = req.app.get("io");
        if (io) {
            io.to(chatRoomId).emit("new_message", {
                chatRoomId,
                newMessage
            });
        }

        res.json({ success: true, newMessage });
    } catch (error) {
        console.error("Send message error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.searchMessages = async (req, res) => {
    try {
        const userId = req.user.userId;
        const { query } = req.query;

        if (!query) return res.json({ success: true, results: [] });

        // 1. Find all chats user is involved in
        const userChats = await ChatRoom.find({ userIds: userId }).select('_id');
        const chatRoomIds = userChats.map(c => c._id);

        // 2. Fetch the deletedAt timestamps for this user for all relevant chats
        const chatsWithInfo = await ChatRoom.find({ _id: { $in: chatRoomIds } }).select('deletedAt').lean();

        // 2. Search in Message collection
        const results = await Message.aggregate([
            { $match: { chatRoomId: { $in: chatRoomIds } } },
            { $unwind: "$messages" },
            {
                $match: {
                    "messages.content": { $regex: query, $options: "i" }
                }
            },
            {
                $addFields: {
                    userChatInfo: {
                        $first: {
                            $filter: {
                                input: chatsWithInfo,
                                as: "c",
                                cond: { $eq: ["$$c._id", "$chatRoomId"] }
                            }
                        }
                    }
                }
            },
            {
                $match: {
                    $expr: {
                        $or: [
                            { $eq: ["$userChatInfo.deletedAt", null] },
                            { $not: { $getField: { field: { $toString: userId }, input: "$userChatInfo.deletedAt" } } },
                            {
                                $gt: [
                                    "$messages.createdAt",
                                    { $getField: { field: { $toString: userId }, input: "$userChatInfo.deletedAt" } }
                                ]
                            }
                        ]
                    }
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

        res.json({ success: true, results });

    } catch (error) {
        console.error("Search messages error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.markAsRead = async (req, res) => {
    try {
        const { chatRoomId } = req.params;
        const userId = req.user.userId;

        const messageDoc = await Message.findOne({ chatRoomId });
        if (!messageDoc) {
            return res.status(404).json({ success: false, message: "Chat not found" });
        }

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
exports.deleteChat = async (req, res) => {
    try {
        const { chatRoomId } = req.params;
        const userId = req.user.userId;

        const chatRoom = await ChatRoom.findOne({
            _id: chatRoomId,
            userIds: userId
        });

        if (!chatRoom) {
            return res.status(404).json({ success: false, message: "Chat not found or unauthorized" });
        }

        if (!chatRoom.deletedAt) {
            chatRoom.deletedAt = new Map();
        }

        // Set deletion timestamp for the current user
        chatRoom.deletedAt.set(userId, new Date());

        if (!chatRoom.deletedBy.includes(userId)) {
            chatRoom.deletedBy.push(userId);
        }

        await chatRoom.save();

        res.json({ success: true, message: "Chat deleted effectively for you" });
    } catch (error) {
        console.error("Delete chat error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

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
