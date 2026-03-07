const axios = require("axios");

const API_KEY = process.env.GEMINI_API_KEY || "AIzaSyDTCs75Mj6eZCmk_IhPa3qucC5EAc-D9Uw";
const API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

console.log(`[Gemini] Using API Key: ${API_KEY.substring(0, 8)}...${API_KEY.substring(API_KEY.length - 4)}`);

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
        const response = await axios.post(`${API_URL}?key=${API_KEY}`, {
            contents: [{ parts: [{ text: prompt }] }]
        });

        const text = response.data.candidates[0].content.parts[0].text;
        const jsonMatch = text.match(/\{.*\}/s);
        return jsonMatch ? JSON.parse(jsonMatch[0]) : {};
    } catch (error) {
        console.error("Error extracting search params:", error.response ? error.response.data : error.message);
        return {};
    }
};

const generateChatResponse = async (userQuery, posts, stats = null) => {
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
    } else if (!stats) {
        context = "Không tìm thấy bất động sản nào phù hợp.";
    }

    const prompt = `
    Bạn là trợ lý ảo hỗ trợ tìm kiếm bất động sản. 
    Dữ liệu từ website:
    ${context}
    
    Câu hỏi: "${userQuery}"
    
    Yêu cầu trả lời:
    1. Trả lời thật ngắn gọn, đi thẳng vào vấn đề.
    2. Chỉ giới thiệu tối đa 2 bất động sản phù hợp nhất.
    3. Luôn sử dụng mã [PROPERTY:id] để hiển thị card cho các bài đăng được chọn.
    4. Nếu không có dữ liệu phù hợp, hãy thông báo ngắn gọn.
    `;

    try {
        const response = await axios.post(`${API_URL}?key=${API_KEY}`, {
            contents: [{ parts: [{ text: prompt }] }]
        });
        return response.data.candidates[0].content.parts[0].text;
    } catch (error) {
        console.error("Error generating chat response:", error.response ? error.response.data : error.message);
        return "Xin lỗi, tôi gặp sự cố khi xử lý yêu cầu của bạn. Vui lòng thử lại sau.";
    }
};

module.exports = {
    extractSearchParams,
    generateChatResponse
};
