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
    - ward: string (normalized ward name)
    - street: string (normalized street name)
    - propertyType: "APARTMENT", "HOUSE", "LAND", "OFFICE", "SHOPHOUSE", "ROOM"
    - transactionType: "RENT" or "SALE"
    - minPrice: number
    - maxPrice: number

    Rules:
    - Determine "queryType": "SEARCH", "ANALYTICS", or "GENERAL".
    - CRITICAL: If the user inputs ONLY a location name (e.g., "bac tu liem", "cầu giấy", "hà nội", "hồ tùng mậu"), ALWAYS classify it as "SEARCH".
    - Identify ANALYTICS if the user asks for "giá trung bình", "bao nhiêu tin đăng", "khu vực nào nhiều nhất", v.v.
    - TransactionType Mapping: 
        - "mua", "bán", "cần tìm mua", "bán nhà", "mua căn hộ" -> "SALE"
        - "thuê", "cho thuê", "tìm phòng", "thuê nhà", "phòng trọ" -> "RENT"
    - For short queries like "ho tung mau", "cau giay", "ha noi", "quan 1", extract them into the most specific field (street, district, or city).
    - IMPORTANT: Always try to return locations with correct Vietnamese accents (e.g. "Hồ Tùng Mậu" instead of "ho tung mau") if recognized.
    - Set missing fields to null.

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

const generateChatResponse = async (userQuery, posts, stats = null, vipPackages = [], history = []) => {
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
            const prefix = p.isSuggestion ? "[GỢI Ý LÂN CẬN]" : "[KẾT QUẢ CHÍNH XÁC]";
            return `- ${prefix} [REF:${p._id}] ${title} tại ${district} ${city}. Giá: ${price} VNĐ. Diện tích: ${area}m2. Loại: ${type}.`;
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
    1. CHỈ giới thiệu bất động sản CÓ TRONG context cung cấp. KHÔNG TỰ BỊA ĐẶT.
    2. ƯU TIÊN KẾT QUẢ CHÍNH XÁC. Nếu là "GỢI Ý LÂN CẬN", hãy thông báo rõ cho người dùng.
    3. KHÔNG TÌM THẤY: Hãy trả lời CỰC KỲ NGẮN GỌN (dưới 20 từ). Ví dụ: "Rất tiếc, tôi không tìm thấy kết quả phù hợp tại [địa điểm]. Bạn thử tìm khu vực khác nhé?".
    4. HIỂN THỊ: BẮT BUỘC dùng tag [REF:id] để giới thiệu bất động sản (ví dụ: "[REF:P1]"). Dùng CHÍNH XÁC mã ID (P1, P2...) được cung cấp.
 
    DỮ LIỆU HỆ THỐNG:
    ${context}
    `;

    const messages = [
        { role: "system", content: systemPrompt },
        ...history.map(h => ({ 
            role: h.role, 
            // Sanitize history: Replace any [PROPERTY:...] with [REF:OLD] to prevent AI from seeing hex IDs
            content: h.content.replace(/\[PROPERTY:\s*[a-fA-F0-9]+\s*\]/g, "[REF:OLD]")
        })),
        { role: "user", content: userQuery }
    ];

    try {
        const response = await groq.chat.completions.create({
            messages: messages,
            model: "llama-3.3-70b-versatile",
            temperature: 0,
        });
        return response.choices[0].message.content;
    } catch (error) {
        require('fs').appendFileSync('error.log', new Date().toISOString() + ' - ' + (error.stack || error) + '\n');
        console.error("Error generating chat response:", error.stack || error);
        return "Xin lỗi, tôi gặp sự cố khi xử lý yêu cầu của bạn. Vui lòng thử lại sau.";
    }
};

module.exports = {
    extractSearchParams,
    generateChatResponse
};
