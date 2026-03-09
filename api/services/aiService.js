const Groq = require("groq-sdk");

const API_KEY = process.env.GROQ_API_KEY;
if (!API_KEY) {
    console.error("[Groq] ERROR: GROQ_API_KEY is not defined in .env");
}

const groq = new Groq({ apiKey: API_KEY });

console.log(`[Groq] Using API Key: ${API_KEY ? API_KEY.substring(0, 10) + '...' : 'undefined'}`);

const extractSearchParams = async (userQuery) => {
    const prompt = `
    Extract search parameters or analytical intent from the following real estate query in Vietnamese.
    Return ONLY a JSON object with the following fields:
    - queryType: "SEARCH" (default) or "ANALYTICS" (for stats/avg/count)
    - analyticsType: "AVERAGE_PRICE", "POST_COUNT", "AREA_TRENDS" or null
    - city: string (normalized city name)
    - district: string (normalized district name)
    - transactionType: "RENT" or "SALE"
    - propertyType: "APARTMENT", "HOUSE", "LAND", "OFFICE", "SHOPHOUSE", "ROOM"
    - minPrice: number
    - maxPrice: number

    Identify ANALYTICS if the user asks for "giá trung bình", "bao nhiêu tin đăng", "khu vực nào nhiều nhất", v.v.
    Return null for missing fields. 
    
    Query: "${userQuery}"
    `;

    try {
        const response = await groq.chat.completions.create({
            messages: [{ role: "user", content: prompt }],
            model: "llama-3.1-8b-instant",
            temperature: 0,
            response_format: { type: "json_object" }
        });

        const text = response.choices[0].message.content;
        return JSON.parse(text);
    } catch (error) {
        console.error("Error extracting search params:", error.message);
        return {};
    }
};

const generateChatResponse = async (userQuery, posts, stats = null, vipPackages = []) => {
    let context = "";

    if (stats) {
        context = `THÔNG KÊ HỆ THỐNG:\n${JSON.stringify(stats, null, 2)}\n\n`;
    }

    if (posts && posts.length > 0) {
        context += "DANH SÁCH BẤT ĐỘNG SẢN PHÙ HỢP:\n" + posts.map(p => {
            const addr = p.address || {};
            const district = addr.district || "không rõ";
            const city = addr.city || "";
            const price = p.price ? p.price.toLocaleString() : "Liên hệ";
            const title = p.title || "Bất động sản";
            const area = p.area || "?";
            const type = p.propertyType || "Chưa rõ";
            return `- [PROPERTY:${p._id}] ${title} tại ${district} ${city}. Giá: ${price} VNĐ. Diện tích: ${area}m2. Loại: ${type}.`;
        }).join("\n");
    } else if (!stats && vipPackages.length === 0) {
        context = "Không tìm thấy bất động sản nào phù hợp.";
    }

    if (vipPackages && vipPackages.length > 0) {
        context += "\n\nCÁC GÓI DỊCH VỤ VIP:\n" + vipPackages.map(pkg => {
            return `- Gói ${pkg.name}: Giá ${pkg.price.toLocaleString()} VNĐ/${pkg.durationDays} ngày. Quyền lợi: ${pkg.perks.join(", ")}.`;
        }).join("\n");
    }

    const systemPrompt = `
    Bạn là trợ lý ảo chuyên gia về bất động sản của hệ thống này.
    
    NGUYÊN TẮC QUAN TRỌNG:
    1. CHỈ sử dụng dữ liệu được cung cấp bởi người dùng trong phần context để trả lời. 
    2. Nếu không có thông tin trong dữ liệu, hãy lịch sự thông báo rằng bạn không tìm thấy kết quả phù hợp trên hệ thống và gợi ý người dùng điều chỉnh yêu cầu.
    3. KHÔNG được tự ý bịa đặt thông tin hoặc sử dụng kiến thức bên ngoài về các bất động sản khác.
    4. Trả lời bằng tiếng Việt, thân thiện và chuyên nghiệp.
    5. Khi giới thiệu bất động sản từ danh sách cung cấp, BẮT BUỘC phải bao gồm tag [PROPERTY:id] (ví dụ: [PROPERTY:65f...] ) của bài đăng đó trong câu trả lời để hệ thống hiển thị card.

    DỮ LIỆU HỆ THỐNG:
    ${context}
    `;

    try {
        const response = await groq.chat.completions.create({
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userQuery }
            ],
            model: "llama-3.3-70b-versatile",
            temperature: 0.7,
        });
        return response.choices[0].message.content;
    } catch (error) {
        console.error("Error generating chat response:", error.message);
        return "Xin lỗi, tôi gặp sự cố khi xử lý yêu cầu của bạn. Vui lòng thử lại sau.";
    }
};

module.exports = {
    extractSearchParams,
    generateChatResponse
};
