const Post = require("../models/PostModel");
const VipPackage = require("../models/VipPackageModel");
const ChatbotHistory = require("../models/ChatbotHistoryModel");
const aiService = require("../services/aiService");

// Helper to create a regex that matches Vietnamese accented characters given an unaccented or accented string
function createFuzzyRegex(str) {
    if (!str) return null;
    const map = {
        'a': '[aáàảãạâấầẩẫậăắằẳẵặAÁÀẢÃẠÂẤẦẨẪẬĂẮẰẲẴẶ]',
        'e': '[eéèẻẽẹêếềểễệEÉÈẺẼẸÊẾỀỂỄỆ]',
        'i': '[iíìỉĩịIÍÌỈĨỊ]',
        'o': '[oóòỏõọôốồổỗộơớờởỡợOÓÒỎÕỌÔỐỒỔỖỘƠỚỜỞỠỢ]',
        'u': '[uúùủũụưứừửữựUÚÙỦŨỤƯỨỪỬỮỰ]',
        'y': '[yýỳỷỹỵYÝỲỶỸỴ]',
        'd': '[dđDĐ]'
    };
    
    // Explicitly strip ALL Vietnamese characters to base a-z
    let normalized = str.toLowerCase();
    normalized = normalized.replace(/à|á|ạ|ả|ã|â|ầ|ấ|ậ|ẩ|ẫ|ă|ằ|ắ|ặ|ẳ|ẵ/g, "a");
    normalized = normalized.replace(/è|é|ẹ|ẻ|ẽ|ê|ề|ế|ệ|ể|ễ/g, "e");
    normalized = normalized.replace(/ì|í|ị|ỉ|ĩ/g, "i");
    normalized = normalized.replace(/ò|ó|ọ|ỏ|õ|ô|ồ|ố|ộ|ổ|ỗ|ơ|ờ|ớ|ợ|ở|ỡ/g, "o");
    normalized = normalized.replace(/ù|ú|ụ|ủ|ũ|ư|ừ|ứ|ự|ử|ữ/g, "u");
    normalized = normalized.replace(/ỳ|ý|ỵ|ỷ|ỹ/g, "y");
    normalized = normalized.replace(/đ/g, "d");
    
    let regexStr = '';
    for (let char of normalized) {
        regexStr += map[char] || char;
    }
    return new RegExp(regexStr, 'i');
}

const handleQuery = async (req, res) => {
    try {
        const { message } = req.body;
        if (!message) {
            return res.status(400).json({ message: "Vui lòng cung cấp nội dung tin nhắn." });
        }

        // 1. Extract search parameters using Groq
        let searchParams = await aiService.extractSearchParams(message);
        console.log(`[Chatbot] Extracted Params for "${message}":`, JSON.stringify(searchParams));
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
            // Use fuzzy regex to allow substring & accent-insensitive matches (e.g. 'cau giay' matches 'Quận Cầu Giấy')
            if (searchParams && searchParams.city) query["address.city"] = createFuzzyRegex(searchParams.city);
            if (searchParams && searchParams.district) query["address.district"] = createFuzzyRegex(searchParams.district);
            if (searchParams && searchParams.ward) query["address.ward"] = createFuzzyRegex(searchParams.ward);
            if (searchParams && searchParams.street) query["address.street"] = createFuzzyRegex(searchParams.street);
            
            if (searchParams && searchParams.transactionType) query.transactionType = searchParams.transactionType;
            if (searchParams && searchParams.propertyType) query.propertyType = searchParams.propertyType;

            if (searchParams && (searchParams.minPrice || searchParams.maxPrice)) {
                query.price = {};
                if (searchParams.minPrice) query.price.$gte = searchParams.minPrice;
                if (searchParams.maxPrice) query.price.$lte = searchParams.maxPrice;
            }

            posts = await Post.find(query)
                .limit(5)
                .collation({ locale: "en", strength: 1 })
                .lean();
            
            console.log(`[Chatbot] Primary search found ${posts.length} posts`);

            // 2.1 SUGGESTIONS: If specific filters found no results, try broader city-wide suggestions
            if (posts.length === 0 && searchParams.city) {
                const suggestionQuery = { 
                    status: "ACTIVE", 
                    "address.city": createFuzzyRegex(searchParams.city) 
                };
                if (searchParams.transactionType) {
                    suggestionQuery.transactionType = searchParams.transactionType;
                }
                
                const suggestions = await Post.find(suggestionQuery)
                    .limit(5)
                    .collation({ locale: "en", strength: 1 })
                    .lean();
                if (suggestions.length > 0) {
                    posts = suggestions.map(p => ({ ...p, isSuggestion: true }));
                }
            }

            // 2.2 FALLBACK: If still no posts, try broader keyword search using fuzzy regex
            if (posts.length === 0 && message && message.trim().length >= 2) {
                const locationTerm = searchParams.street || searchParams.district || searchParams.city || message.trim().replace(/[?!,.]$/, '');
                
                // Use fuzzy regex for robust fallback matching
                const fuzzyLocation = createFuzzyRegex(locationTerm);
                const fallbackQuery = { 
                    status: "ACTIVE",
                    $or: [
                        { "address.city": fuzzyLocation },
                        { "address.district": fuzzyLocation },
                        { "address.ward": fuzzyLocation },
                        { "address.street": fuzzyLocation }
                    ]
                };
                
                // Strictly enforce transactionType if extracted
                if (searchParams.transactionType) {
                    fallbackQuery.transactionType = searchParams.transactionType;
                }

                posts = await Post.find(fallbackQuery)
                    .limit(5)
                    .collation({ locale: "en", strength: 1 })
                    .lean();
                console.log(`[Chatbot] Fallback search for "${locationTerm}" found ${posts.length} posts`);
            }
        }

        // 3. Fetch history if authenticated
        // CONSISTENT: Always use userId from JWT payload
        let history = [];
        if (req.user && req.user.userId) {
            console.log(`[Chatbot] Fetching history for user: ${req.user.userId}`);
            const userHistory = await ChatbotHistory.findOne({ userId: req.user.userId });
            if (userHistory) {
                history = userHistory.messages.slice(-10);
            }
        }

        // 4. Fetch VIP Packages for context
        const vipPackages = await VipPackage.find({ isActive: true }).lean();

        // 5. MAPPING: Use short tags [REF:P1] for the AI to prevent ID mangling
        const idMap = new Map();
        const aliasedPosts = posts.map((p, index) => {
            const alias = `P${index + 1}`;
            const realId = String(p._id);
            idMap.set(alias, realId);
            return {
                ...p,
                _id: alias,
                id: alias
            };
        });

        // 6. Generate AI response
        // Tell AI to use [REF:P1] format
        let aiResponse = await aiService.generateChatResponse(message.trim(), aliasedPosts, stats, vipPackages, history);

        // 7. REVERSE MAPPING: Replace [REF:P1] with [PROPERTY:realId]
        idMap.forEach((realId, alias) => {
            const aliasRegex = new RegExp(`\\[REF:${alias}\\]`, 'g');
            aiResponse = aiResponse.replace(aliasRegex, `[PROPERTY:${realId}]`);
        });

        // Final cleanup of any lingering [REF:] tags just in case
        aiResponse = aiResponse.replace(/\[REF:[^\]]+\]/g, "");

        // 8. Save to history
        if (req.user && req.user.userId) {
            const processedPostsForHistory = posts.map(p => ({
                ...p,
                _id: String(p._id),
                id: String(p._id)
            }));

            await ChatbotHistory.findOneAndUpdate(
                { userId: req.user.userId },
                {
                    $push: {
                        messages: {
                            $each: [
                                { role: "user", content: message.trim() },
                                { role: "assistant", content: aiResponse, posts: processedPostsForHistory }
                            ]
                        }
                    }
                },
                { upsert: true, new: true }
            );
        }

        return res.status(200).json({
            success: true,
            data: {
                message: aiResponse,
                posts: posts.map(p => ({ ...p, _id: String(p._id), id: String(p._id) })),
                stats: stats
            }
        });

    } catch (error) {
        console.error("Chatbot query error stack:", error.stack);
        return res.status(500).json({ message: "Đã xảy ra lỗi khi xử lý yêu cầu của bạn.", error: error.message });
    }
};

const getHistory = async (req, res) => {
    try {
        if (!req.user || !req.user.userId) {
            return res.status(401).json({ message: "Vui lòng đăng nhập." });
        }

        console.log(`[Chatbot] getHistory requested for userId: ${req.user.userId}`);
        const history = await ChatbotHistory.findOne({ userId: req.user.userId });
        console.log(`[Chatbot] History found for user ${req.user.userId}: ${history ? history.messages.length : 0} messages`);

        // Ensure posts in history also have stringified IDs
        const messages = history ? history.messages.map(m => {
            const msgObj = m.toObject ? m.toObject() : m;
            return {
                ...msgObj,
                posts: (msgObj.posts || []).map(p => ({
                    ...p,
                    _id: String(p._id),
                    id: String(p._id)
                }))
            };
        }) : [];

        return res.status(200).json({
            success: true,
            data: messages
        });
    } catch (error) {
        console.error("Get chatbot history error:", error);
        return res.status(500).json({ message: "Lỗi khi lấy lịch sử trò chuyện." });
    }
};

module.exports = {
    handleQuery,
    getHistory
};
