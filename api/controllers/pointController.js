const User = require("../models/UserModel");
const PointLog = require("../models/PointLogModel");
const VipPackage = require("../models/VipPackageModel");

const Notification = require("../models/NotificationModel");
const Lead = require("../models/LeadModel");
const Post = require("../models/PostModel");

// Constants for Reward Costs
const REWARDS = {
    "ITEM_POST_PUSH": { cost: 50, label: "Đẩy Tin (1 lần)" },
    "ITEM_VIP_BRONZE_1DAY": { cost: 500, label: "VIP Bronze (1 Ngày)" },
    "ITEM_VIP_SILVER_3DAY": { cost: 1000, label: "VIP Silver (3 Ngày)" },
    "ITEM_VIP_GOLD_7DAY": { cost: 2000, label: "VIP Gold (7 Ngày)" },
    "LEAD_CREDIT": { cost: 50, label: "Xem 1 Lead (SĐT)" }
};

// --- READ OPERATIONS ---

exports.getMyPoints = async (req, res) => {
    try {
        const userId = req.user.userId;
        const user = await User.findById(userId).select("points inventory vip");

        // Get recent history
        const history = await PointLog.find({ userId })
            .sort({ createdAt: -1 })
            .limit(20);

        res.json({
            success: true,
            data: {
                balance: user.points,
                inventory: user.inventory,
                history
            }
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

exports.getVipItemsUsageHistory = async (req, res) => {
    try {
        const userId = req.user.userId;

        // Get all inventory items usage history from PointLog
        // VIP items (Bronze/Silver/Gold) activate user VIP packages
        // Push Post updates post's createdAt
        // Lead Credit unlocks customer phone numbers
        const history = await PointLog.find({
            userId,
            action: { $in: ['USE_ITEM_POST_PUSH', 'USE_ITEM_VIP_BRONZE_1DAY', 'USE_ITEM_VIP_SILVER_3DAY', 'USE_ITEM_VIP_GOLD_7DAY', 'USE_LEAD_CREDIT'] }
        })
            .populate({
                path: 'relatedId',
                model: 'Post',
                select: 'title images status vip createdAt'
            })
            .sort({ createdAt: -1 })
            .limit(50);

        res.json({ success: true, data: history });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};


exports.getAllPointLogs = async (req, res) => {
    try {
        const { page = 1, limit = 20, type, action } = req.query;
        const query = {};

        if (type) query.type = type;
        if (action) query.action = action;

        const skip = (page - 1) * limit;

        const logs = await PointLog.find(query)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit))
            .populate('userId', 'name email avatar');

        const total = await PointLog.countDocuments(query);

        res.json({
            success: true,
            data: logs,
            pagination: {
                current: parseInt(page),
                total: Math.ceil(total / limit),
                totalRecords: total
            }
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

exports.getAdminPointStats = async (req, res) => {
    try {
        // Total points currently available in user wallets
        const users = await User.find({}, 'points');
        const totalAvailable = users.reduce((sum, user) => sum + (user.points || 0), 0);

        // Total points earned (Distributed)
        const totalEarnedResult = await PointLog.aggregate([
            { $match: { type: 'EARN' } },
            { $group: { _id: null, total: { $sum: '$points' } } }
        ]);
        const totalDistributed = totalEarnedResult[0]?.total || 0;

        // Total points spent (Redeemed)
        const totalSpentResult = await PointLog.aggregate([
            { $match: { type: 'SPEND' } },
            { $group: { _id: null, total: { $sum: '$points' } } }
        ]);
        const totalRedeemed = totalSpentResult[0]?.total || 0;

        res.json({
            success: true,
            data: {
                totalAvailable,
                totalDistributed,
                totalRedeemed
            }
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// --- ACTION OPERATIONS ---

exports.redeemReward = async (req, res) => {
    try {
        const userId = req.user.userId;
        const { rewardKey } = req.body;

        if (!REWARDS[rewardKey]) {
            return res.status(400).json({ message: "Invalid reward key" });
        }

        const cost = REWARDS[rewardKey].cost;
        const user = await User.findById(userId);

        if (user.points < cost) {
            return res.status(400).json({ message: "Không đủ điểm." });
        }

        // 1. Deduct Points
        user.points -= cost;

        // Initialize inventory if not exists
        if (!user.inventory) {
            user.inventory = { postPush: 0, vipBronze1Day: 0, vipSilver3Day: 0, vipGold7Day: 0, leadCredit: 0 };
        }

        // Initialize vip object with bonus credits if not exists
        if (!user.vip) {
            user.vip = {
                isActive: false,
                vipType: 'NONE',
                bonusPushCredits: 0,
                bonusLeadCredits: 0
            };
        } else {
            // Ensure bonus credits fields exist
            if (user.vip.bonusPushCredits === undefined) user.vip.bonusPushCredits = 0;
            if (user.vip.bonusLeadCredits === undefined) user.vip.bonusLeadCredits = 0;
        }

        // 2. Grant Reward Logic
        switch (rewardKey) {
            case "ITEM_POST_PUSH":
                user.inventory.postPush = (user.inventory.postPush || 0) + 1;
                break;

            case "ITEM_VIP_BRONZE_1DAY":
                user.inventory.vipBronze1Day = (user.inventory.vipBronze1Day || 0) + 1;
                break;

            case "ITEM_VIP_SILVER_3DAY":
                user.inventory.vipSilver3Day = (user.inventory.vipSilver3Day || 0) + 1;
                break;

            case "ITEM_VIP_GOLD_7DAY":
                user.inventory.vipGold7Day = (user.inventory.vipGold7Day || 0) + 1;
                break;

            case "LEAD_CREDIT":
                user.inventory.leadCredit = (user.inventory.leadCredit || 0) + 1;
                break;
        }

        await user.save();

        // 3. Log Transaction
        await PointLog.create({
            userId,
            type: "SPEND",
            action: `REDEEM_${rewardKey}`,
            points: cost,
            description: `Đổi quà: ${REWARDS[rewardKey].label}`
        });

        // 4. Send Notification
        await Notification.create({
            recipientId: userId,
            type: "POINT",
            message: `Bạn đã đổi thành công gói ${REWARDS[rewardKey].label}. -${cost} điểm.`,
            relatedId: userId // or maybe null?
        });

        res.json({ success: true, message: "Đổi quà thành công!", points: user.points, inventory: user.inventory });

    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

exports.useInventoryItem = async (req, res) => {
    try {
        const userId = req.user.userId;
        const { itemKey, quantity = 1 } = req.body; // Removed unused postId

        if (quantity < 1) return res.status(400).json({ message: "Số lượng không hợp lệ." });

        const user = await User.findById(userId);
        if (!user.inventory) return res.status(400).json({ message: "Kho quà trống." });

        // Map itemKey to inventory field
        let inventoryField = '';
        if (itemKey === 'ITEM_POST_PUSH') inventoryField = 'postPush';
        else if (itemKey === 'ITEM_VIP_BRONZE_1DAY') inventoryField = 'vipBronze1Day';
        else if (itemKey === 'ITEM_VIP_SILVER_3DAY') inventoryField = 'vipSilver3Day';
        else if (itemKey === 'ITEM_VIP_GOLD_7DAY') inventoryField = 'vipGold7Day';
        else if (itemKey === 'LEAD_CREDIT') inventoryField = 'leadCredit';

        if (!inventoryField || (user.inventory[inventoryField] || 0) < quantity) {
            return res.status(400).json({ message: "Số lượng trong kho không đủ." });
        }


        // Push Post and Lead Credit are handled below

        // Handle Push Post - adds bonus push credits to VIP package
        if (itemKey === 'ITEM_POST_PUSH') {
            // Initialize vip object if not exists
            if (!user.vip) {
                user.vip = {
                    isActive: false,
                    vipType: 'NONE',
                    bonusPushCredits: 0,
                    bonusLeadCredits: 0
                };
            }

            // Add bonus push credits
            user.vip.bonusPushCredits = (user.vip.bonusPushCredits || 0) + quantity;

            // Deduct inventory
            user.inventory[inventoryField] -= quantity;
            await user.save();

            // Log activity
            await PointLog.create({
                userId,
                type: 'SPEND',
                action: 'USE_ITEM_POST_PUSH',
                points: 0,
                relatedId: userId,
                description: `Thêm ${quantity} lượt đẩy tin vào VIP`
            });

            return res.json({
                success: true,
                message: `Đã thêm ${quantity} lượt đẩy tin vào gói VIP! Vào Quản lý VIP để sử dụng.`,
                inventory: user.inventory,
                vip: user.vip
            });
        }

        // Handle Lead Credit - adds bonus lead view credits to VIP package
        if (itemKey === 'LEAD_CREDIT') {
            // Initialize vip object if not exists
            if (!user.vip) {
                user.vip = {
                    isActive: false,
                    vipType: 'NONE',
                    bonusPushCredits: 0,
                    bonusLeadCredits: 0
                };
            }

            // Add bonus lead credits
            user.vip.bonusLeadCredits = (user.vip.bonusLeadCredits || 0) + quantity;

            // Deduct inventory
            user.inventory[inventoryField] -= quantity;
            await user.save();

            // Log activity
            await PointLog.create({
                userId,
                type: 'SPEND',
                action: 'USE_LEAD_CREDIT',
                points: 0,
                relatedId: userId,
                description: `Thêm ${quantity} lượt xem lead vào VIP`
            });

            return res.json({
                success: true,
                message: `Đã thêm ${quantity} lượt xem lead vào gói VIP! Sử dụng để mở khóa số điện thoại khách hàng.`,
                inventory: user.inventory,
                vip: user.vip
            });
        }

        // Handle VIP Items - activate VIP package for user
        if (itemKey.includes('VIP')) {
            let baseDays = 0;
            let vipType = '';
            let vipPackageId = null;

            if (itemKey.includes("BRONZE")) {
                baseDays = 1;
                vipType = "VIP Bronze";
                // Find Bronze package
                const pkg = await VipPackage.findOne({ name: /Bronze/i });
                if (pkg) vipPackageId = pkg._id;
            }
            if (itemKey.includes("SILVER")) {
                baseDays = 3;
                vipType = "VIP Silver";
                // Find Silver package
                const pkg = await VipPackage.findOne({ name: /Silver/i });
                if (pkg) vipPackageId = pkg._id;
            }
            if (itemKey.includes("GOLD")) {
                baseDays = 7;
                vipType = "VIP Gold";
                // Find Gold package
                const pkg = await VipPackage.findOne({ name: /Gold/i });
                if (pkg) vipPackageId = pkg._id;
            }

            const totalDays = baseDays * quantity;
            const now = new Date();

            // Check if user already has active VIP
            let newExpiry;
            if (user.vip && user.vip.isActive && user.vip.expiredAt > now) {
                // Extend existing VIP
                newExpiry = new Date(user.vip.expiredAt);
                newExpiry.setDate(newExpiry.getDate() + totalDays);
            } else {
                // New VIP activation
                newExpiry = new Date(now);
                newExpiry.setDate(newExpiry.getDate() + totalDays);
            }

            // Update user VIP package
            user.vip = {
                isActive: true,
                vipType: vipType,
                packageId: vipPackageId,
                expiredAt: newExpiry,
                dailyUsedSlots: user.vip?.dailyUsedSlots || 0,
                lastSlotResetDate: user.vip?.lastSlotResetDate || now,
                todayViewedPhones: user.vip?.todayViewedPhones || 0,
                limitViewPhone: user.vip?.limitViewPhone || 0,
                bonusPushCredits: user.vip?.bonusPushCredits || 0,
                bonusLeadCredits: user.vip?.bonusLeadCredits || 0
            };

            // Deduct inventory
            user.inventory[inventoryField] -= quantity;
            await user.save();

            // Log activity
            const actionMap = {
                'ITEM_VIP_BRONZE_1DAY': 'USE_ITEM_VIP_BRONZE_1DAY',
                'ITEM_VIP_SILVER_3DAY': 'USE_ITEM_VIP_SILVER_3DAY',
                'ITEM_VIP_GOLD_7DAY': 'USE_ITEM_VIP_GOLD_7DAY'
            };
            await PointLog.create({
                userId,
                type: 'SPEND',
                action: actionMap[itemKey],
                points: 0,
                relatedId: userId,
                description: `Kích hoạt ${REWARDS[itemKey].label}`
            });

            return res.json({
                success: true,
                message: `Kích hoạt ${vipType} thành công! Hạn sử dụng đến ${newExpiry.toLocaleDateString('vi-VN')}. Vào Quản lý VIP để gắn VIP cho tin đăng.`,
                inventory: user.inventory,
                vip: user.vip
            });
        }

        return res.status(400).json({ message: "Item không hợp lệ." });

    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// --- INTERNAL HELPER (Not API) ---
// --- USER BALANCE MANAGEMENT ---

exports.getUsersWithPoints = async (req, res) => {
    try {
        const { page = 1, limit = 10, sort = 'desc', search = '', role } = req.query;
        const query = {};

        if (search) {
            query.$or = [
                { name: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } },
                { phone: { $regex: search, $options: 'i' } }
            ];
        }

        if (role) {
            query.role = role; // 'USER', 'AGENT', 'ADMIN'
        }

        const sortDir = sort === 'asc' ? 1 : -1;
        const skip = (page - 1) * limit;

        const users = await User.find(query)
            .select('name email phone points role avatar lastLogin createdAt isBanned violationCount')
            .sort({ points: sortDir })
            .skip(skip)
            .limit(parseInt(limit));

        const total = await User.countDocuments(query);

        res.json({
            success: true,
            data: users,
            pagination: {
                current: parseInt(page),
                total: Math.ceil(total / limit),
                totalRecords: total
            }
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

exports.adjustUserPoints = async (req, res) => {
    try {
        const { userId, amount, description } = req.body;
        const adminId = req.user.userId; // Admin performing the action

        if (!userId || amount === undefined) {
            console.log("DEBUG: Missing userId or amount", userId, amount);
            return res.status(400).json({ message: "Missing userId or amount" });
        }

        const pointAmount = parseInt(amount);
        // Allow amount 0 for warnings/info logs
        // if (pointAmount === 0) return res.status(400).json({ message: "Amount cannot be 0" });

        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ message: "User not found" });

        // Update User Points
        user.points += pointAmount;
        await user.save();

        console.log("DEBUG: PointLog Enum Values:", PointLog.schema.path('action').enumValues); // Check if ADMIN_ADJUSTMENT is here

        // Log Transaction
        await PointLog.create({
            userId,
            type: pointAmount > 0 ? "EARN" : "SPEND",
            action: "ADMIN_ADJUSTMENT",
            points: Math.abs(pointAmount), // Store absolute value usually, but verify schema expectations.
            // Previous logPoints used signed passed, but here we explicitly set type.
            // Let's stick to existing logPoints helper or create directly.
            // Actually, existing logPoints helper takes signed points if we look at previous code?
            // "points" in logPoints: "positive for earn, negative for spend" comment in line 85 of previous read.
            // But PointLog schema might store absolute. Let's check existing controller usage.
            // In redeemReward (Step 406): `points: cost` (absolute?) but type SPEND.
            // In addPoints helper: `points` passed direct.
            // Let's be consistent with redeemReward: Store absolute amount, and use type to distinguish.
            // Wait, redeemReward in Step 406 Log: `points: cost`. Cost is positive. Type is SPEND.
            // So PointLog stores absolute value.
            description: description || `Admin adjusted points: ${pointAmount > 0 ? '+' : ''}${pointAmount}`,
            relatedId: adminId // Store admin ID who made change
        });

        // Send Notification to User
        let notifMessage = "";
        let notifType = "POINT";

        if (pointAmount === 0) {
            notifType = "SYSTEM"; // Or keep POINT, but SYSTEM feels more like an alert/warning
            notifMessage = `CẢNH BÁO VI PHẠM: ${description || 'Bạn đã nhận được một cảnh cáo từ quản trị viên.'}`;
        } else if (pointAmount > 0) {
            notifMessage = `Bạn đã được cộng ${pointAmount.toLocaleString()} điểm. Lý do: ${description || 'Admin điều chỉnh'}.`;
        } else {
            notifMessage = `Bạn bị trừ ${Math.abs(pointAmount).toLocaleString()} điểm. Lý do: ${description || 'Vi phạm quy định'}.`;
        }

        await Notification.create({
            recipientId: userId,
            type: notifType,
            message: notifMessage,
            senderId: adminId
        });

        res.json({ success: true, message: "Points adjusted successfully", newBalance: user.points });

    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

exports.addPoints = async (userId, action, points, relatedId) => {
    try {
        const user = await User.findById(userId);
        if (!user) return;

        user.points = (user.points || 0) + points;
        await user.save();

        // Create Log
        await PointLog.create({
            userId,
            type: "EARN",
            action,
            points,
            relatedId,
            description: `Tích lũy từ hoạt động: ${action}`
        });

        // Create Notification
        let message = `Bạn vừa nhận được ${points} điểm!`;
        if (action === "POST_CREATED") message = `Bạn nhận được ${points} điểm từ bài đăng mới.`;
        if (action === "TOPUP_REWARD") message = `Bạn nhận được ${points} điểm thưởng từ nạp tiền.`;
        if (action === "FIRST_TOPUP_BONUS") message = `Bạn nhận được ${points} điểm thưởng nạp lần đầu!`;
        if (action === "DAILY_LOGIN") message = `Điểm danh hàng ngày: +${points} điểm.`;

        await Notification.create({
            recipientId: userId,
            type: "POINT",
            message,
            relatedId
        });

    } catch (err) {
        console.error("Error in addPoints helper:", err);
    }
};
