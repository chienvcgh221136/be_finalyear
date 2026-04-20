const User = require("../models/UserModel");
const PointLog = require("../models/PointLogModel");
const VipPackage = require("../models/VipPackageModel");
const Post = require("../models/PostModel");
const emailService = require("../services/emailService");
const Notification = require("../models/NotificationModel");

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
                history: history.map(log => ({
                    _id: log._id,
                    action: log.action,
                    points: log.points,
                    type: log.type,
                    createdAt: log.createdAt
                })),
                expiringSoon: await getExpiringSoon(userId)
            }
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

exports.getVipItemsUsageHistory = async (req, res) => {
    try {
        const userId = req.user.userId;

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
        await exports.spendPoints(userId, cost, `REDEEM_${rewardKey}`, `Đổi quà: ${REWARDS[rewardKey].label}`);

        // Refresh user for updated balance and inventory
        const updatedUser = await User.findById(userId);

        res.json({ success: true, message: "Đổi quà thành công!", points: updatedUser.points, inventory: updatedUser.inventory });

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

        // res.json({ success: true, message: "Đổi quà thành công!", points: user.points, inventory: user.inventory }); // Replaced above

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

            // Update user VIP package fields individually to preserve metadata like currentVipPosts
            if (!user.vip) user.vip = {};
            user.vip.isActive = true;
            user.vip.vipType = vipType;
            user.vip.packageId = vipPackageId;
            user.vip.expiredAt = newExpiry;

            // Priority Score is missing from the previous implementation, let's fetch it if possible
            const pkg = await VipPackage.findById(vipPackageId);
            if (pkg) user.vip.priorityScore = pkg.priorityScore;

            // Ensure other fields remain or are initialized
            user.vip.dailyUsedSlots = user.vip.dailyUsedSlots || 0;
            user.vip.lastSlotResetDate = user.vip.lastSlotResetDate || now;
            user.vip.todayViewedPhones = user.vip.todayViewedPhones || 0;
            user.vip.limitViewPhone = user.vip.limitViewPhone || 0;
            user.vip.bonusPushCredits = user.vip.bonusPushCredits || 0;
            user.vip.bonusLeadCredits = user.vip.bonusLeadCredits || 0;

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
            .select('name email phone points role avatar lastLogin createdAt isBanned violationCount handledViolations isProfileRewardGiven')
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
        const { userId, amount, description, penaltyLevel } = req.body;
        const adminId = req.user.userId; // Admin performing the action

        if (!userId || amount === undefined) {
            console.log("DEBUG: Missing userId or amount", userId, amount);
            return res.status(400).json({ message: "Missing userId or amount" });
        }

        const pointAmount = parseInt(amount);

        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ message: "User not found" });

        // Check if this is the profile reward
        if (description === "admin.points.adjustment_reasons.profile" || 
            description === "Thưởng cập nhật hồ sơ cá nhân đầy đủ + ảnh đại diện") {
            user.isProfileRewardGiven = true;
            await user.save();
        }

        // Update User Points
        if (pointAmount > 0) {
            await exports.addPoints(userId, "ADMIN_ADJUSTMENT", pointAmount, adminId, description || `Admin cộng điểm: +${pointAmount}`);
        } else {
            await exports.spendPoints(userId, Math.abs(pointAmount), "ADMIN_ADJUSTMENT", description || `Admin trừ điểm: -${Math.abs(pointAmount)}`, adminId);

            // If it was a penalty, mark as handled
            if (penaltyLevel) {
                user.handledViolations = user.violationCount;

                // Handle Level 5: BAN
                if (penaltyLevel === 5) {
                    user.isBanned = true;

                    // Remove all posts
                    await Post.updateMany(
                        { userId: user._id },
                        { status: "REMOVED" }
                    );

                    // Send Ban Email
                    const lang = user.language || 'vi';

                    // Simple server-side translation map for known penalty reasons
                    const translations = {
                        vi: {
                            "admin.points.adjustment_reasons.violation_warning": "Nhắc nhở vi phạm",
                            "admin.points.adjustment_reasons.violation_deduct_15": "Tái phạm lần 2: Trừ 15% tổng điểm",
                            "admin.points.adjustment_reasons.violation_deduct_30": "Tái phạm lần 3: Trừ 30% tổng điểm",
                            "admin.points.adjustment_reasons.violation_deduct_50": "Vi phạm nghiêm trọng: Trừ 50% tổng điểm",
                            "admin.points.adjustment_reasons.violation_ban": "Mức phạt tối đa: Tịch thu toàn bộ điểm & Khóa tài khoản"
                        },
                        en: {
                            "admin.points.adjustment_reasons.violation_warning": "Violation reminder",
                            "admin.points.adjustment_reasons.violation_deduct_15": "Repeat violation 2: Deduct 15% total points",
                            "admin.points.adjustment_reasons.violation_deduct_30": "Repeat violation 3: Deduct 30% total points",
                            "admin.points.adjustment_reasons.violation_deduct_50": "Serious violation: Deduct 50% total points",
                            "admin.points.adjustment_reasons.violation_ban": "Maximum penalty: Forfeit all points & Permanent ban"
                        }
                    };

                    const translatedReason = (translations[lang] && translations[lang][description])
                        || description
                        || (lang === 'en' ? "Community standards violation" : "Vi phạm quy hoạch hệ thống");

                    await emailService.sendBanEmail(user.email, user.name, translatedReason, lang);
                }

                await user.save();
            }
        }

        const updatedUser = await User.findById(userId);

        console.log("DEBUG: PointLog Enum Values:", PointLog.schema.path('action').enumValues); // Check if ADMIN_ADJUSTMENT is here

        let notifMessage = "";
        let notifType = "POINT";

        if (pointAmount === 0) {
            notifType = "SYSTEM";
            notifMessage = `[CẢNH BÁO VI PHẠM]: ${description || 'Bạn vừa nhận được một cảnh cáo nhắc nhở từ Quản trị viên.'}`;
        } else if (pointAmount > 0) {
            notifMessage = `[CỘNG ĐIỂM] ${description || 'Quản trị viên đã thưởng điểm cho bạn.'} (+${pointAmount.toLocaleString()} PTS)`;
        } else {
            notifMessage = `[TRỪ ĐIỂM] ${description || 'Khấu trừ điểm do vi phạm quy định.'} (-${Math.abs(pointAmount).toLocaleString()} PTS)`;
        }

        await Notification.create({
            recipientId: userId,
            type: notifType,
            message: notifMessage,
            senderId: adminId
        });

        res.json({ success: true, message: "Points adjusted successfully", newBalance: updatedUser.points });

    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

exports.addPoints = async (userId, action, points, relatedId, description = null) => {
    try {
        const user = await User.findById(userId);
        if (!user) return;

        user.points = (user.points || 0) + points;
        await user.save();

        const isAnniversaryAction = ['TOPUP_REWARD', 'FIRST_TOPUP_BONUS', 'VIP_PURCHASE'].includes(action);
        let expiryDate = null;
        let remainingPoints = 0;

        if (isAnniversaryAction) {
            const now = new Date();
            // 1. Initialize anniversary if not set
            if (!user.pointsAnniversaryDate) {
                user.pointsAnniversaryDate = now;
                await user.save();
            }

            // 2. Calculate anniversary for the current year
            const anniversary = new Date(user.pointsAnniversaryDate);
            // anniversaryDate only (month and day) applied to the current year
            const anniversaryDateCurrentYear = new Date(now.getFullYear(), anniversary.getMonth(), anniversary.getDate());

            // Normalize 'now' to start of day for accurate comparison
            const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

            let expiryYear = now.getFullYear();
            // If today is the anniversary or it has passed this year, the expiry is next year.
            if (today >= anniversaryDateCurrentYear) {
                expiryYear = now.getFullYear() + 1;
            }

            expiryDate = new Date(expiryYear, anniversary.getMonth(), anniversary.getDate(), 23, 59, 59, 999);
            remainingPoints = points;
        }

        // Create Log
        await PointLog.create({
            userId,
            type: "EARN",
            action,
            points,
            remainingPoints,
            expiryDate,
            relatedId,
            description: description || `Tích lũy từ hoạt động: ${action}`
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

exports.spendPoints = async (userId, amount, action, description, relatedId = null) => {
    try {
        const user = await User.findById(userId);
        if (!user || user.points < amount) {
            throw new Error("Không đủ điểm để thực hiện giao dịch.");
        }

        // 1. Deduct from User Total
        user.points -= amount;
        await user.save();

        // 2. FIFO logic: Spend points from the oldest unexpired batches
        let remainingToSpend = amount;

        // Find earn logs with remaining points, not expired, sorted by expiry (oldest first)
        const pointBatches = await PointLog.find({
            userId,
            type: 'EARN',
            remainingPoints: { $gt: 0 },
            expiryDate: { $gt: new Date() }
        }).sort({ expiryDate: 1 });

        for (const batch of pointBatches) {
            if (remainingToSpend <= 0) break;

            const spentFromBatch = Math.min(batch.remainingPoints, remainingToSpend);
            batch.remainingPoints -= spentFromBatch;
            remainingToSpend -= spentFromBatch;
            await batch.save();
        }

        // 3. Log the SPEND action
        await PointLog.create({
            userId,
            type: "SPEND",
            action,
            points: amount,
            relatedId,
            description
        });

    } catch (err) {
        console.error("Error in spendPoints helper:", err);
        throw err;
    }
};

const getExpiringSoon = async (userId) => {
    try {
        const expiringBatches = await PointLog.find({
            userId,
            type: 'EARN',
            remainingPoints: { $gt: 0 },
            expiryDate: { $ne: null, $gt: new Date() }
        }).sort({ expiryDate: 1 });

        const totalExpiring = expiringBatches.reduce((sum, batch) => sum + batch.remainingPoints, 0);

        const firstBatch = expiringBatches[0];
        return {
            total: totalExpiring,
            expiryDay: firstBatch ? new Date(firstBatch.expiryDate).getDate() : null,
            expiryMonth: firstBatch ? new Date(firstBatch.expiryDate).getMonth() + 1 : null,
            year: firstBatch ? new Date(firstBatch.expiryDate).getFullYear() : null
        };
    } catch (err) {
        console.error("Error in getExpiringSoon helper:", err);
        return { total: 0, batches: [] };
    }
};
