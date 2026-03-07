const Post = require("../models/PostModel");
const geminiService = require("../services/geminiService");

const handleQuery = async (req, res) => {
    try {
        const { message } = req.body;
        if (!message) {
            return res.status(400).json({ message: "Vui lòng cung cấp nội dung tin nhắn." });
        }

        // 1. Extract search parameters using Gemini
        let searchParams = await geminiService.extractSearchParams(message);
        if (!searchParams || typeof searchParams !== 'object') searchParams = {};

        // 2. Build MongoDB query
        const query = { status: "ACTIVE" };
        let posts = [];
        let stats = null;

        if (searchParams.queryType === "ANALYTICS") {
            // Analytics handling
            const matchQuery = { status: "ACTIVE" };
            if (searchParams.city) matchQuery["address.city"] = new RegExp(searchParams.city, "i");
            if (searchParams.district) matchQuery["address.district"] = new RegExp(searchParams.district, "i");
            if (searchParams.propertyType) matchQuery.propertyType = searchParams.propertyType;

            if (searchParams.analyticsType === "AVERAGE_PRICE") {
                stats = await Post.aggregate([
                    { $match: matchQuery },
                    { $group: { _id: null, avgPrice: { $avg: "$price" }, count: { $sum: 1 } } }
                ]);
            } else if (searchParams.analyticsType === "POST_COUNT") {
                stats = await Post.aggregate([
                    { $match: matchQuery },
                    { $group: { _id: "$address.district", count: { $sum: 1 } } },
                    { $sort: { count: -1 } }
                ]);
            } else {
                // Default stats
                stats = await Post.aggregate([
                    { $match: matchQuery },
                    { $group: { _id: "$propertyType", count: { $sum: 1 } } }
                ]);
            }
        } else {
            // Standard search handling
            if (searchParams && searchParams.city) query["address.city"] = new RegExp(searchParams.city, "i");
            if (searchParams && searchParams.district) query["address.district"] = new RegExp(searchParams.district, "i");
            if (searchParams && searchParams.transactionType) query.transactionType = searchParams.transactionType;
            if (searchParams && searchParams.propertyType) query.propertyType = searchParams.propertyType;

            if (searchParams && (searchParams.minPrice || searchParams.maxPrice)) {
                query.price = {};
                if (searchParams.minPrice) query.price.$gte = searchParams.minPrice;
                if (searchParams.maxPrice) query.price.$lte = searchParams.maxPrice;
            }

            posts = await Post.find(query).limit(2).lean();
        }

        // 4. Generate AI response based on posts and stats
        const aiResponse = await geminiService.generateChatResponse(message, posts, stats);

        return res.status(200).json({
            success: true,
            data: {
                message: aiResponse,
                posts: posts // Return post data so frontend can match [PROPERTY:id] tags
            }
        });

    } catch (error) {
        console.error("Chatbot query error stack:", error.stack);
        return res.status(500).json({ message: "Đã xảy ra lỗi khi xử lý yêu cầu của bạn.", error: error.message });
    }
};

module.exports = {
    handleQuery
};
