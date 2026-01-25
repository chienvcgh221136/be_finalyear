const mongoose = require("mongoose");

const PostSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    title: { type: String, required: true },
    description: { type: String },
    transactionType: { type: String, enum: ["RENT", "SALE"], required: true },
    propertyType: { type: String, enum: ["APARTMENT", "HOUSE", "LAND", "OFFICE", "SHOPHOUSE"], required: true },
    apartmentType: { type: String, enum: ["MINI", "DORM", "SERVICED", "STUDIO", "OFFICETEL", "PENTHOUSE", "DUPLEX", "HIGH_END"], default: null },
    price: { type: Number, required: true },
    deposit: { type: Number, default: 0 },
    area: { type: Number },

    // Nested Address
    address: {
        street: { type: String },
        ward: { type: String },
        district: { type: String, required: true },
        city: { type: String, required: true }
    },

    // Flattened address fields for backward compatibility or easier querying if needed (Optional, but better to migrate to nested)
    // For now, we removed top-level district/city from schema to strictly use address object, 
    // OR we can keep them as aliases if existing code relies heavily on them. 
    // The user request showed nested address. Let's stick to nested.

    bedrooms: { type: Number },
    bathrooms: { type: Number },
    floor: { type: Number },
    totalFloors: { type: Number },
    furniture: { type: String, enum: ["NONE", "BASIC", "FULL"], default: "NONE" },

    images: [String],
    redbookImages: [String],
    status: { type: String, enum: ["PENDING", "ACTIVE", "REJECTED", "SOLD", "RENTED"], default: "PENDING" },

    rejectReason: { type: String, default: null },
    approvedAt: { type: Date, default: null },

    vip: {
        isActive: { type: Boolean, default: false },
        vipType: { type: String, default: "NONE" },
        priorityScore: { type: Number, default: 0 },
        startedAt: { type: Date, default: null },
        expiredAt: { type: Date, default: null },
    },
    viewCount: { type: Number, default: 0 }
}, { timestamps: true, collection: "posts" });

module.exports = mongoose.model("Post", PostSchema);
