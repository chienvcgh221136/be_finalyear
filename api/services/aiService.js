const Groq = require("groq-sdk");

const API_KEY = process.env.GROQ_API_KEY;
if (!API_KEY) {
    console.error("[Groq] ERROR: GROQ_API_KEY is not defined in .env");
}

const groq = new Groq({ apiKey: API_KEY });

console.log(`[Groq] Using API Key: ${API_KEY ? API_KEY.substring(0, 10) + '...' : 'undefined'}`);

const extractSearchParams = async (userQuery) => {
    const prompt = `
    Extract search parameters or analytical intent from the following real estate query (in Vietnamese or English).
    Return ONLY a JSON object with the following fields:
    - queryType: "SEARCH" (default) or "ANALYTICS" (for stats/avg/count)
    - analyticsType: "AVERAGE_PRICE", "POST_COUNT", "AREA_TRENDS" or null
    - city: string (normalized city name)
    - district: string (normalized district name)
    - ward: string (normalized ward name)
    - street: string (normalized street name)
    - propertyType: "APARTMENT", "HOUSE", "LAND", "OFFICE", "SHOPHOUSE", "ROOM"
    - transactionType: "RENT" or "SALE"
    - minPrice: number (MUST BE IN FULL VND. Example: 10 triệu = 10000000, 1.5 tỷ = 1500000000)
    - maxPrice: number (MUST BE IN FULL VND. Example: 10 triệu = 10000000, 1.5 tỷ = 1500000000)

    Rules:
    - Determine "queryType": "SEARCH", "ANALYTICS", or "GENERAL".
    - CRITICAL: If the user inputs ONLY a location name (e.g., "bac tu liem", "cầu giấy", "hà nội", "hồ tùng mậu"), ALWAYS classify it as "SEARCH".
    - Identify ANALYTICS if the user asks for "giá trung bình", "bao nhiêu tin đăng", "khu vực nào nhiều nhất", "average price", "how many", etc.
    - TransactionType Mapping (Vietnamese & English): 
        - "mua", "bán", "cần tìm mua", "bán nhà", "mua căn hộ", "buy", "sell", "purchase" -> "SALE"
        - "thuê", "cho thuê", "tìm phòng", "thuê nhà", "phòng trọ", "rent", "lease" -> "RENT"
    - For short queries like "ho tung mau", "cau giay", "ha noi", "quan 1", extract them into the most specific field (street, district, or city).
    - IMPORTANT: Always try to return locations with correct Vietnamese accents (e.g. "Hồ Tùng Mậu" instead of "ho tung mau") if recognized, even if queried in English.
    - Set missing fields to null.

    CRITICAL NOTE ON PRICES: Users often say "triệu" (million), "tỷ" (billion). 
    If they say "dưới 10 triệu", maxPrice MUST be 10000000. 
    If they say "trên 1 tỷ", minPrice MUST be 1000000000.

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
        context = `SYSTEM STATISTICS:\n${JSON.stringify(stats, null, 2)}\n\n`;
    }

    if (posts && posts.length > 0) {
        context += "AVAILABLE PROPERTIES:\n" + posts.map(p => {
            const addr = p.address || {};
            const district = addr.district || "Unknown";
            const city = addr.city || "";
            const price = p.price ? p.price.toLocaleString() : "Contact";
            const title = p.title || "Property";
            const area = p.area || "?";
            const type = p.propertyType || "Unknown";
            const prefix = p.isSuggestion ? "[NEARBY SUGGESTION]" : "[EXACT MATCH]";
            return `- ${prefix} [REF:${p._id}] Title: ${title} | Location: ${district}, ${city} | Price: ${price} VND | Area: ${area}m2 | Type: ${type}`;
        }).join("\n");
    } else if (!stats && vipPackages.length === 0) {
        context = "No matching properties found.";
    }

    if (vipPackages && vipPackages.length > 0) {
        context += "\n\nVIP PACKAGES:\n" + vipPackages.map(pkg => {
            return `- Package ${pkg.name}: Price ${pkg.price.toLocaleString()} VND / ${pkg.durationDays} days. Perks: ${pkg.perks.join(", ")}.`;
        }).join("\n");
    }

    const systemPrompt = `
    You are a professional real estate AI assistant for this system.
    
    CRITICAL RULES:
    1. LANGUAGE MATCHING (CRITICAL): You MUST detect the language of the user's input and reply ENTIRELY in that same language.
       - If the user writes in English (e.g., "find to me rent house", "hello", "apartment"), you MUST reply ENTIRELY in English. *IMPORTANT*: You MUST TRANSLATE the property details, address, and specifications from the SYSTEM DATA CONTEXT (which is in Vietnamese) into English before presenting them. (e.g., translate "Giá", "Diện tích", "Loại", "tại", "mặt tiền" to "Price", "Area", "Type", "at", "frontage", etc.)
       - If the user writes in Vietnamese (e.g., "cho thuê nhà", "chào"), you MUST reply ENTIRELY in Vietnamese.
    2. GREETINGS: If the user only says a greeting, greet them back in their language and politely ask how you can help them find real estate today.
    3. ACCURACY: ONLY introduce properties provided in the SYSTEM DATA CONTEXT. DO NOT invent properties or information.
    4. SUGGESTIONS: Prioritize exact matches. If suggesting nearby properties, clearly inform the user but keep it brief.
    5. NOT FOUND (CRITICAL): If no properties are found in the SYSTEM DATA CONTEXT, you MUST reply VERY BRIEFLY (e.g., "Rất tiếc, tôi không tìm thấy kết quả phù hợp."). YOU ARE STRICTLY FORBIDDEN from suggesting searching on other websites, contacting local agencies, local authorities, or any other outside methods.
    6. FORMATTING: You MUST use the tag [REF:id] to reference a property (e.g., "[REF:P1]"). Use EXACTLY the ID provided in the dataset.
    7. OUT OF SCOPE: If the user asks about topics completely unrelated to real estate or this website, politely decline to answer.
    8. CURRENCY AND LOGIC (CRITICAL): Always show prices in VND as provided in the SYSTEM DATA CONTEXT (e.g., "triệu", "tỷ", "VNĐ"). DO NOT include USD conversions. Remember that 1 triệu = 1,000,000 and 1 tỷ = 1,000,000,000.
    9. CONCISENESS (CRITICAL): Always keep your responses extremely short and direct. DO NOT add verbose pleasantries, DO NOT give generic advice, and DO NOT ask unnecessary follow-up questions.
    10. ABSOLUTE PROHIBITION (CRITICAL): UNDER NO CIRCUMSTANCES should you output bullet points suggesting to "Liên hệ với các công ty bất động sản" or "Tìm kiếm trên các trang web". Your entire universe of knowledge is restricted to the SYSTEM DATA CONTEXT. If it's not there, you cannot help.
 
    SYSTEM DATA CONTEXT:
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
