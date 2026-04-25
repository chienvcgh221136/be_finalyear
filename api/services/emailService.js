const nodemailer = require('nodemailer');
const i18n = require('../utils/i18n');

// Create transporter
const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: process.env.SMTP_PORT || 587,
    secure: false, // true for 465, false for other ports
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },
});

exports.sendTopupSuccessEmail = async (to, userName, amount, newBalance, lang = 'vi') => {
    try {
        if (!to) return;

        const formattedAmount = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
        const formattedBalance = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(newBalance);

        const subject = i18n.t('emails.topup_success.subject', lang);
        const header = i18n.t('emails.topup_success.header', lang);
        const greeting = i18n.t('emails.topup_success.greeting', lang, { userName });
        const content = i18n.t('emails.topup_success.content', lang, { amount: formattedAmount });
        const balanceLabel = i18n.t('emails.topup_success.balance_label', lang);
        const thanks = i18n.t('emails.common.thanks', lang);
        const footerText = i18n.t('emails.common.footer', lang);

        const info = await transporter.sendMail({
            from: process.env.SMTP_FROM || '"EstateMarket Support" <support@estatemarket.com>',
            to: to,
            subject: subject,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #2563eb;">${header}</h2>
                    <p>${greeting}</p>
                    <p>${content}</p>
                    
                    <div style="background-color: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
                        <p style="margin: 0;">${balanceLabel}</p>
                        <p style="margin: 5px 0 0; font-size: 24px; font-weight: bold; color: #1f2937;">${formattedBalance}</p>
                    </div>
                    
                    <p>${thanks}</p>
                    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
                    <p style="color: #6b7280; font-size: 12px;">${footerText}</p>
                </div>
            `,
        });

        console.log("Email sent: %s", info.messageId);
        return true;
    } catch (error) {
        console.error("Error sending email:", error);
        return false;
    }
};

exports.sendWithdrawOTP = async (to, userName, otp, amount, lang = 'vi') => {
    try {
        if (!to) return;
        const formattedAmount = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);

        const subject = i18n.t('emails.withdraw_otp.subject', lang);
        const header = i18n.t('emails.withdraw_otp.header', lang);
        const greeting = i18n.t('emails.withdraw_otp.greeting', lang, { userName });
        const content = i18n.t('emails.withdraw_otp.content', lang, { amount: formattedAmount });
        const otpText = i18n.t('emails.withdraw_otp.otp_text', lang);
        const footer = i18n.t('emails.withdraw_otp.footer', lang);

        await transporter.sendMail({
            from: process.env.SMTP_FROM || '"EstateMarket Support" <support@estatemarket.com>',
            to: to,
            subject: subject,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #2563eb;">${header}</h2>
                    <p>${greeting}</p>
                    <p>${content}</p>
                    <p>${otpText}</p>
                    <div style="background-color: #f3f4f6; padding: 15px; border-radius: 8px; text-align: center; margin: 20px 0;">
                        <span style="font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #1f2937;">${otp}</span>
                    </div>
                    <p>${footer}</p>
                </div>
            `,
        });
        return true;
    } catch (error) {
        console.error("Error sending OTP email:", error);
        return false;
    }
};

exports.sendAdminWithdrawNotification = async (userName, amount, requestId, lang = 'vi') => {
    try {
        const subject = i18n.t('emails.admin_withdraw.notif_subject', lang);
        const header = i18n.t('emails.admin_withdraw.notif_header', lang);
        const checkLink = i18n.t('emails.admin_withdraw.notif_btn', lang);

        console.log("Attempting to send Admin Withdraw Notification...");
        console.log("Env ADMIN_EMAIL:", process.env.ADMIN_EMAIL);
        console.log("Env SMTP_USER:", process.env.SMTP_USER);

        const adminEmail = process.env.ADMIN_EMAIL || process.env.SMTP_USER;
        console.log("Resolved Admin Email:", adminEmail);

        if (!adminEmail) {
            console.warn("⚠️ ADMIN_EMAIL and SMTP_USER are not set. Skipping admin notification.");
            return;
        }

        await transporter.sendMail({
            from: process.env.SMTP_FROM || '"EstateMarket System" <system@estatemarket.com>',
            to: adminEmail,
            subject: subject,
            html: `
                <div style="font-family: Arial, sans-serif;">
                    <h3>${header}</h3>
                    <p>${i18n.t('emails.admin_withdraw.notif_content', lang, { userName, amount: new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount) })}</p>
                    <p>${i18n.t('emails.admin_withdraw.notif_content_id', lang, { requestId })}</p>
                    <a href="${process.env.CLIENT_URL || 'http://localhost:5173'}/admin/withdrawals">${checkLink}</a>
                </div>
            `,
        });
        console.log("✅ Admin notification sent to:", adminEmail);
    } catch (error) {
        console.error("Error sending admin notification:", error);
    }
};

exports.sendAdminWithdrawReminder = async (userName, amount, hours, requestId, lang = 'vi') => {
    try {
        const subject = i18n.t('emails.admin_withdraw.remind_subject', lang, { hours });
        const header = i18n.t('emails.admin_withdraw.remind_header', lang);
        const checkLink = i18n.t('emails.admin_withdraw.remind_btn', lang);

        const adminEmail = process.env.ADMIN_EMAIL || process.env.SMTP_USER;
        if (!adminEmail) return;

        await transporter.sendMail({
            from: process.env.SMTP_FROM || '"EstateMarket System" <system@estatemarket.com>',
            to: adminEmail,
            subject: subject,
            html: `
                <div style="font-family: Arial, sans-serif;">
                    <h3 style="color: #f59e0b;">${header}</h3>
                    <p>${i18n.t('emails.admin_withdraw.remind_content', lang, { userName, amount: new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount) })}</p>
                    <p>${i18n.t('emails.admin_withdraw.remind_details', lang, { hours })}</p>
                    <p>${i18n.t('emails.admin_withdraw.remind_content_id', lang, { requestId })}</p>
                    <a href="${process.env.CLIENT_URL || 'http://localhost:5173'}/admin/withdrawals">${checkLink}</a>
                </div>
            `,
        });
    } catch (error) {
        console.error("Error sending admin reminder:", error);
    }
};

exports.sendAdminWithdrawUrgent = async (userName, amount, hours, requestId, lang = 'vi') => {
    try {
        const subject = i18n.t('emails.admin_withdraw.urgent_subject', lang, { hours });
        const header = i18n.t('emails.admin_withdraw.urgent_header', lang);
        const checkLink = i18n.t('emails.admin_withdraw.urgent_btn', lang);

        const adminEmail = process.env.ADMIN_EMAIL || process.env.SMTP_USER;
        if (!adminEmail) return;

        await transporter.sendMail({
            from: process.env.SMTP_FROM || '"EstateMarket System" <system@estatemarket.com>',
            to: adminEmail,
            subject: subject,
            html: `
                <div style="font-family: Arial, sans-serif; border: 2px solid red; padding: 10px;">
                    <h3 style="color: red;">${header}</h3>
                    <p>${i18n.t('emails.admin_withdraw.urgent_content', lang, { userName, amount: new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount) })}</p>
                    <p>${i18n.t('emails.admin_withdraw.urgent_details', lang, { hours })}</p>
                    <p>${i18n.t('emails.admin_withdraw.urgent_content_id', lang, { requestId })}</p>
                    <a href="${process.env.CLIENT_URL || 'http://localhost:5173'}/admin/withdrawals">${checkLink}</a>
                </div>
            `,
        });
    } catch (error) {
        console.error("Error sending admin urgent:", error);
    }
};

exports.sendWithdrawStatusUpdate = async (to, userName, status, amount, note, lang = 'vi') => {
    try {
        if (!to) return;
        const statusText = i18n.t(`emails.withdraw_status.${status.toLowerCase()}_text`, lang) || status;
        let statusColor = '#3b82f6';
        if (status === 'APPROVED') statusColor = '#10b981';
        if (status === 'REJECTED') statusColor = '#ef4444';
        if (status === 'PAID') statusColor = '#10b981';

        const subject = i18n.t('emails.withdraw_status.subject', lang);
        const greeting = i18n.t('emails.common.greeting', lang, { userName }) || `Xin chào <strong>${userName}</strong>,`;
        const amountFormatted = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
        const content = i18n.t('emails.withdraw_status.content', lang, { amountFormatted, statusColor, statusText }) || `Yêu cầu rút tiền <strong>${amountFormatted}</strong> của bạn đã chuyển sang trạng thái: <strong style="color: ${statusColor};">${statusText}</strong>.`;
        const noteLabel = i18n.t('emails.common.admin_note', lang) || `Ghi chú từ Admin:`;
        const thanks = i18n.t('emails.common.thanks', lang);

        await transporter.sendMail({
            from: process.env.SMTP_FROM || '"EstateMarket Support" <support@estatemarket.com>',
            to: to,
            subject: subject,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: ${statusColor};">${statusText}</h2>
                    <p>${greeting}</p>
                    <p>${content}</p>
                    ${note ? `<p><strong>${noteLabel}</strong> ${note}</p>` : ''}
                    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
                    <p style="color: #6b7280; font-size: 12px;">${thanks}</p>
                </div>
            `,
        });
        return true;
    } catch (error) {
        console.error("Error sending status email:", error);
        return false;
    }
};

exports.sendAppointmentRequestSender = async (to, userName, postTitle, time, lang = 'vi') => {
    try {
        if (!to) return;
        const buyerName = userName || i18n.t('common.user', lang) || "Người dùng";
        const displayTitle = postTitle || i18n.t('common.property', lang) || "Bất động sản";

        const subject = i18n.t('emails.appointment.sender_subject', lang);
        const header = i18n.t('emails.appointment.sender_header', lang);
        const greeting = i18n.t('emails.appointment.sender_greeting', lang, { buyerName });
        const content = i18n.t('emails.appointment.sender_content', lang, { postTitle: displayTitle });
        const timeLabel = i18n.t('emails.appointment.sender_time', lang);
        const pendingWait = i18n.t('emails.appointment.sender_note', lang);
        const thanks = i18n.t('emails.common.thanks', lang);
        const formattedTime = new Date(time).toLocaleString(lang === 'en' ? 'en-US' : 'vi-VN');

        await transporter.sendMail({
            from: process.env.SMTP_FROM || '"EstateMarket" <support@estatemarket.com>',
            to: to,
            subject: subject,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #2563eb;">${header}</h2>
                    <p>${greeting}</p>
                    <p>${content}</p>
                    <p>${timeLabel} <strong>${formattedTime}</strong></p>
                    <p>${pendingWait}</p>
                    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
                    <p style="color: #6b7280; font-size: 12px;">${thanks}</p>
                </div>
            `,
        });
        return true;
    } catch (error) {
        console.error("Error sending appointment sender email:", error);
        return false;
    }
};

exports.sendAppointmentRequestReceiver = async (to, sellerName, buyerName, postTitle, time, note, lang = 'vi') => {
    try {
        if (!to) return;
        const sName = sellerName || i18n.t('common.user', lang) || "Người dùng";
        const bName = buyerName || i18n.t('common.user', lang) || "Người dùng";
        const displayTitle = postTitle || i18n.t('common.property', lang) || "Bất động sản";

        const subject = i18n.t('emails.appointment.receiver_subject', lang);
        const header = i18n.t('emails.appointment.receiver_header', lang);
        const greeting = i18n.t('emails.appointment.receiver_greeting', lang, { sellerName: sName });
        const content = i18n.t('emails.appointment.receiver_content', lang, { buyerName: bName, postTitle: displayTitle });
        const timeLabel = i18n.t('emails.appointment.receiver_time', lang);
        const noteLabel = i18n.t('emails.appointment.update_note', lang) || 'Ghi chú:';
        const noNote = i18n.t('common.none', lang) || 'Không có';
        const actionText = i18n.t('emails.appointment.receiver_note', lang);
        const btnText = i18n.t('emails.appointment.receiver_btn', lang);
        const formattedTime = new Date(time).toLocaleString(lang === 'en' ? 'en-US' : 'vi-VN');
        console.log(`[EmailService] Preparing to send appointment receiver email to: ${to}, Subject: ${subject}`);

        await transporter.sendMail({
            from: process.env.SMTP_FROM || '"EstateMarket" <support@estatemarket.com>',
            to: to,
            subject: subject,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #2563eb;">${header}</h2>
                    <p>${greeting}</p>
                    <p>${content}</p>
                    <div style="background-color: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
                        <p style="margin: 5px 0;"><strong>${timeLabel}</strong> ${new Date(time).toLocaleString(lang === 'en' ? 'en-US' : 'vi-VN')}</p>
                        <p style="margin: 5px 0;"><strong>${noteLabel}</strong> ${note || noNote}</p>
                    </div>
                    <p>${actionText}</p>
                    <a href="${process.env.CLIENT_URL || 'http://localhost:5173'}/profile?tab=appointments" style="display: inline-block; background-color: #2563eb; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; font-weight: bold;">${btnText}</a>
                </div>
            `,
        });
        return true;
    } catch (error) {
        console.error("Error sending appointment receiver email:", error);
        return false;
    }
};

exports.sendAppointmentStatusUpdate = async (to, userName, postTitle, status, time, lang = 'vi') => {
    try {
        if (!to) return;
        const statusKey = status === 'APPROVED' ? 'update_accepted' : 'update_rejected';
        const color = status === 'APPROVED' ? '#16a34a' : '#ef4444';
        const statusText = i18n.t(`emails.appointment.${statusKey}`, lang);

        const bName = userName || i18n.t('common.user', lang) || "Người dùng";
        const displayTitle = postTitle || i18n.t('common.property', lang) || "Bất động sản";

        const subject = i18n.t('emails.appointment.update_subject', lang);
        const greeting = i18n.t('emails.appointment.update_greeting', lang, { buyerName: bName });
        const content = i18n.t('emails.appointment.update_content', lang, { postTitle: displayTitle });
        
        const approvedExtra = i18n.t('emails.appointment.update_note_approved', lang);
        const rejectedExtra = i18n.t('emails.appointment.update_note_rejected', lang);
        const thanks = i18n.t('emails.common.thanks', lang);

        await transporter.sendMail({
            from: process.env.SMTP_FROM || '"EstateMarket Support" <support@estatemarket.com>',
            to: to,
            subject: subject,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: ${color};">${statusText}</h2>
                    <p>${greeting}</p>
                    <p>${content}</p>
                    ${status === 'APPROVED' ? approvedExtra : rejectedExtra}
                    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
                    <p style="color: #6b7280; font-size: 12px;">${thanks}</p>
                </div>
            `,
        });
        return true;
    } catch (error) {
        console.error("Error sending appointment status email:", error);
        return false;
    }
};

exports.sendViolationWarning = async (to, userName, postTitle, reason, description, lang = 'vi') => {
    // Fallbacks for display
    const displayName = userName || 'User';
    const displayTitle = postTitle || 'your post';
    
    try {
        if (!to) return;
        let reasonText = reason;
        const reasonsVi = { 'WRONG_INFO': 'Thông tin sai lệch', 'SCAM': 'Lừa đảo', 'DUPLICATE': 'Tin trùng lặp', 'SPAM': 'Spam', 'OTHER': 'Khác' };
        const reasonsEn = { 'WRONG_INFO': 'Misleading information', 'SCAM': 'Scam / Fraud', 'DUPLICATE': 'Duplicate post', 'SPAM': 'Spam', 'OTHER': 'Other' };
        const currentReasons = lang === 'en' ? reasonsEn : reasonsVi;
        if (currentReasons[reason]) reasonText = currentReasons[reason];

        const subject = i18n.t('emails.moderation.violation_subject', lang);
        const header = i18n.t('emails.moderation.violation_header', lang);
        const greeting = i18n.t('emails.moderation.violation_greeting', lang, { userName: displayName });
        const content = i18n.t('emails.moderation.violation_content', lang, { postTitle: displayTitle });
        const reasonLabel = i18n.t('emails.moderation.violation_reason', lang);
        const detailLabel = i18n.t('emails.moderation.violation_details_label', lang);
        const warningAction = i18n.t('emails.moderation.violation_note', lang);
        const btnText = i18n.t('emails.moderation.violation_manage_btn', lang);
        const footerText = i18n.t('emails.common.estatemarket_support', lang);

        await transporter.sendMail({
            from: process.env.SMTP_FROM || '"EstateMarket System" <system@estatemarket.com>',
            to: to,
            subject: subject,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
                    <div style="background-color: #ef4444; padding: 20px; text-align: center;">
                        <h2 style="color: white; margin: 0;">${header}</h2>
                    </div>
                    <div style="padding: 20px;">
                        <p>${greeting}</p>
                        <p>${content}</p>
                        
                        <div style="background-color: #fff1f2; border-left: 4px solid #ef4444; padding: 15px; margin: 20px 0;">
                            <p style="margin: 5px 0;"><strong>${reasonLabel}</strong> ${reasonText}</p>
                            ${description ? `<p style="margin: 5px 0;"><strong>${detailLabel}</strong> ${description}</p>` : ''}
                        </div>

                        <p>${warningAction}</p>
                        
                        <div style="text-align: center; margin-top: 25px;">
                            <a href="${process.env.CLIENT_URL || 'http://localhost:5173'}/profile?tab=posts" style="display: inline-block; background-color: #ef4444; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">${btnText}</a>
                        </div>
                    </div>
                    <div style="background-color: #f9fafb; padding: 15px; text-align: center; border-top: 1px solid #e5e7eb;">
                        <p style="color: #6b7280; font-size: 12px; margin: 0;">${footerText}</p>
                    </div>
                </div>
            `,
        });
        return true;
    } catch (error) {
        console.error("Error sending violation warning email:", error);
        return false;
    }
};

exports.sendUserViolationWarning = async (to, userName, reason, description, lang = 'vi') => {
    // Fallbacks for display
    const displayName = userName || 'User';
    
    try {
        if (!to) return;
        let reasonText = reason;
        const reasonsVi = { 'WRONG_INFO': 'Thông tin sai lệch', 'SCAM': 'Lừa đảo', 'DUPLICATE': 'Tin trùng lặp', 'SPAM': 'Spam', 'OTHER': 'Khác' };
        const reasonsEn = { 'WRONG_INFO': 'Misleading information', 'SCAM': 'Scam / Fraud', 'DUPLICATE': 'Duplicate post', 'SPAM': 'Spam', 'OTHER': 'Other' };
        const currentReasons = lang === 'en' ? reasonsEn : reasonsVi;
        if (currentReasons[reason]) reasonText = currentReasons[reason];

        const subject = i18n.t('emails.moderation.user_violation_subject', lang);
        const header = i18n.t('emails.moderation.user_violation_header', lang);
        const greeting = i18n.t('emails.moderation.user_violation_greeting', lang, { userName: displayName });
        const content = i18n.t('emails.moderation.user_violation_content', lang);
        const reasonLabel = i18n.t('emails.moderation.user_violation_reason', lang);
        const detailLabel = i18n.t('emails.moderation.violation_details_label', lang);
        const warningAction = i18n.t('emails.moderation.user_violation_note', lang);
        const btnText = i18n.t('emails.moderation.user_violation_btn', lang);
        const footerText = i18n.t('emails.common.estatemarket_support', lang);

        await transporter.sendMail({
            from: process.env.SMTP_FROM || '"EstateMarket System" <system@estatemarket.com>',
            to: to,
            subject: subject,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
                    <div style="background-color: #ef4444; padding: 20px; text-align: center;">
                        <h2 style="color: white; margin: 0;">${header}</h2>
                    </div>
                    <div style="padding: 20px;">
                        <p>${greeting}</p>
                        <p>${content}</p>
                        
                        <div style="background-color: #fff1f2; border-left: 4px solid #ef4444; padding: 15px; margin: 20px 0;">
                            <p style="margin: 5px 0;"><strong>${reasonLabel}</strong> ${reasonText}</p>
                            ${description ? `<p style="margin: 5px 0;"><strong>${detailLabel}</strong> ${description}</p>` : ''}
                        </div>

                        <p>${warningAction}</p>
                        
                        <div style="text-align: center; margin-top: 25px;">
                            <a href="${process.env.CLIENT_URL || 'http://localhost:5173'}/terms" style="display: inline-block; background-color: #ef4444; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">${btnText}</a>
                        </div>
                    </div>
                    <div style="background-color: #f9fafb; padding: 15px; text-align: center; border-top: 1px solid #e5e7eb;">
                        <p style="color: #6b7280; font-size: 12px; margin: 0;">${footerText}</p>
                    </div>
                </div>
            `,
        });
        return true;
    } catch (error) {
        console.error("Error sending user violation warning email:", error);
        return false;
    }
};

exports.sendAppointmentReminderSeller = async (to, sellerName, buyerName, postTitle, time, appointmentId, lang = 'vi') => {
    try {
        if (!to) return;
        const subject = i18n.t('emails.appointment.remind_seller_subject', lang, { postTitle });
        const header = i18n.t('emails.appointment.remind_seller_header', lang);
        const greeting = i18n.t('emails.appointment.remind_seller_greeting', lang, { sellerName });
        const content = i18n.t('emails.appointment.remind_seller_content', lang, { buyerName });
        const timeLabel = i18n.t('emails.appointment.remind_seller_time', lang);
        const overdueText = i18n.t('emails.appointment.remind_seller_overdue', lang);
        const actionText = i18n.t('emails.appointment.remind_seller_action', lang);
        const btnText = i18n.t('emails.appointment.remind_seller_btn', lang);

        await transporter.sendMail({
            from: process.env.SMTP_FROM || '"EstateMarket System" <system@estatemarket.com>',
            to: to,
            subject: subject,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #f59e0b;">${header}</h2>
                    <p>${greeting}</p>
                    <p>${content}</p>
                    <div style="background-color: #fffbeb; padding: 15px; border-radius: 8px; margin: 20px 0; border: 1px solid #fcd34d;">
                        <p style="margin: 5px 0;"><strong>${timeLabel}</strong> ${new Date(time).toLocaleString(lang === 'en' ? 'en-US' : 'vi-VN')}</p>
                        <p style="margin: 5px 0; font-size: 13px; color: #b45309;">${overdueText}</p>
                    </div>
                    <p>${actionText}</p>
                    <a href="${process.env.CLIENT_URL || 'http://localhost:5173'}/profile?tab=appointments" style="display: inline-block; background-color: #2563eb; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; font-weight: bold;">${btnText}</a>
                </div>
            `,
        });
        return true;
    } catch (error) {
        console.error("Error sending reminder seller:", error);
        return false;
    }
};

exports.sendAppointmentReminderBuyer = async (to, buyerName, sellerName, postTitle, time, lang = 'vi') => {
    try {
        if (!to) return;
        const subject = i18n.t('emails.appointment.remind_buyer_subject', lang, { postTitle });
        const header = i18n.t('emails.appointment.remind_buyer_header', lang);
        const greeting = i18n.t('emails.appointment.remind_buyer_greeting', lang, { buyerName });
        const content = i18n.t('emails.appointment.remind_buyer_content', lang, { sellerName });
        const reminderText = i18n.t('emails.appointment.remind_buyer_note', lang);
        const thanks = i18n.t('emails.common.thanks', lang);
        const footerText = i18n.t('emails.common.estatemarket_support', lang);

        await transporter.sendMail({
            from: process.env.SMTP_FROM || '"EstateMarket Support" <support@estatemarket.com>',
            to: to,
            subject: subject,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #3b82f6;">${header}</h2>
                    <p>${greeting}</p>
                    <p>${content}</p>
                    <p>${reminderText}</p>
                    <p>${thanks}</p>
                    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
                    <p style="color: #6b7280; font-size: 12px;">${footerText}</p>
                </div>
            `,
        });
        return true;
    } catch (error) {
        console.error("Error sending reminder buyer:", error);
        return false;
    }
};

exports.sendPasswordResetOTP = async (to, userName, otp, lang = 'vi') => {
    try {
        if (!to) return;
        const isEn = lang === 'en';

        const subject = i18n.t('emails.password_reset.subject', lang);
        const header = i18n.t('emails.password_reset.header', lang);
        const greeting = i18n.t('emails.password_reset.greeting', lang, { userName });
        const content = i18n.t('emails.password_reset.content', lang);
        const noteLabel = i18n.t('emails.password_reset.note_label', lang);
        const note1 = i18n.t('emails.password_reset.note_1', lang);
        const note2 = i18n.t('emails.password_reset.note_2', lang);
        const note3 = i18n.t('emails.password_reset.note_3', lang);
        const footerText = i18n.t('common.footer_modal.content.footer_text', lang) || "© 2026 EstateMarket App";

        await transporter.sendMail({
            from: process.env.SMTP_FROM || '"EstateMarket Support" <support@estatemarket.com>',
            to: to,
            subject: subject,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden; background-color: #ffffff;">
                    <div style="background-color: #2563eb; padding: 30px; text-align: center;">
                        <h1 style="color: #ffffff; margin: 0; font-size: 24px;">${header}</h1>
                    </div>
                    <div style="padding: 30px; color: #374151; line-height: 1.6;">
                        <p style="font-size: 16px;">${greeting}</p>
                        <p>${content}</p>
                        
                        <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; text-align: center; margin: 25px 0;">
                            <span style="font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #1f2937;">${otp}</span>
                        </div>
                        
                        <p style="margin-bottom: 5px;"><strong>${noteLabel}</strong></p>
                        <ul style="margin-top: 5px; padding-left: 20px;">
                            <li>${note1}</li>
                            <li>${note2}</li>
                            <li>${note3}</li>
                        </ul>
                    </div>
                    <div style="background-color: #f9fafb; padding: 20px; text-align: center; border-top: 1px solid #e5e7eb;">
                        <p style="color: #6b7280; font-size: 12px; margin: 0;">${footerText}</p>
                    </div>
                </div>
            `,
        });
        return true;
    } catch (error) {
        console.error("Error sending password reset email:", error);
        return false;
    }
};

exports.sendBanEmail = async (to, userName, reason, lang = 'vi') => {
    try {
        if (!to) return;
        const isEn = lang === 'en';

        const subject = i18n.t('emails.ban_notification.subject', lang);
        const header = i18n.t('emails.ban_notification.header', lang);
        const greeting = i18n.t('emails.ban_notification.greeting', lang, { userName });
        const content = i18n.t('emails.ban_notification.content', lang);
        const reasonLabel = i18n.t('emails.ban_notification.reason_label', lang);
        const actionText = i18n.t('emails.ban_notification.action_text', lang);
        const appealText = i18n.t('emails.ban_notification.appeal_text', lang);
        const footerText = i18n.t('emails.ban_notification.footer', lang);

        await transporter.sendMail({
            from: process.env.SMTP_FROM || '"EstateMarket Security" <security@estatemarket.com>',
            to: to,
            subject: subject,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden;">
                    <div style="background-color: #000000; padding: 30px; text-align: center;">
                        <h2 style="color: white; margin: 0; letter-spacing: 2px;">${header.toUpperCase()}</h2>
                    </div>
                    <div style="padding: 30px; background-color: #ffffff;">
                        <p style="font-size: 16px;">${greeting}</p>
                        <p style="line-height: 1.6; color: #374151;">${content}</p>
                        
                        <div style="background-color: #f9fafb; border-left: 4px solid #000000; padding: 20px; margin: 25px 0;">
                            <p style="margin: 0; font-weight: bold; color: #111827;">${reasonLabel}</p>
                            <p style="margin: 10px 0 0; color: #4b5563; font-style: italic;">"${reason}"</p>
                        </div>

                        <p style="color: #ef4444; font-weight: bold;">${actionText}</p>
                        <p style="font-size: 14px; margin-top: 25px; color: #6b7280;">${appealText}</p>
                    </div>
                    <div style="background-color: #f9fafb; padding: 20px; text-align: center; border-top: 1px solid #e5e7eb;">
                        <p style="color: #9ca3af; font-size: 12px; margin: 0;">${footerText}</p>
                    </div>
                </div>
            `,
        });
        return true;
    } catch (error) {
        console.error("Error sending ban email:", error);
        return false;
    }
};

exports.sendUnbanEmail = async (to, userName, lang = 'vi') => {
    try {
        if (!to) return;
        const isEn = lang === 'en';

        const subject = i18n.t('emails.unban_notification.subject', lang);
        const header = i18n.t('emails.unban_notification.header', lang);
        const greeting = i18n.t('emails.unban_notification.greeting', lang, { userName });
        const content = i18n.t('emails.unban_notification.content', lang);
        const welcomeBack = i18n.t('emails.unban_notification.welcome_back', lang);
        const btnText = i18n.t('emails.unban_notification.login_now', lang);
        const footerText = i18n.t('emails.unban_notification.footer', lang);

        await transporter.sendMail({
            from: process.env.SMTP_FROM || '"EstateMarket Support" <support@estatemarket.com>',
            to: to,
            subject: subject,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden;">
                    <div style="background-color: #16a34a; padding: 30px; text-align: center;">
                        <h2 style="color: white; margin: 0;">${header}</h2>
                    </div>
                    <div style="padding: 30px; background-color: #ffffff; text-align: center;">
                        <p style="font-size: 16px; text-align: left;">${greeting}</p>
                        <p style="line-height: 1.6; color: #374151; text-align: left;">${content}</p>
                        
                        <p style="font-weight: bold; color: #16a34a; margin: 25px 0;">${welcomeBack}</p>
                        
                        <div style="margin-top: 30px;">
                            <a href="${process.env.CLIENT_URL || 'http://localhost:5173'}/login" style="display: inline-block; background-color: #16a34a; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; transition: background-color 0.3s;">${btnText}</a>
                        </div>
                    </div>
                    <div style="background-color: #f9fafb; padding: 20px; text-align: center; border-top: 1px solid #e5e7eb;">
                        <p style="color: #9ca3af; font-size: 12px; margin: 0;">${footerText}</p>
                    </div>
                </div>
            `,
        });
        return true;
    } catch (error) {
        console.error("Error sending unban email:", error);
        return false;
    }
};

exports.sendReportConfirmationEmail = async (to, userName, type, targetName, reason, lang = 'vi') => {
    // Fallbacks for display
    const displayName = userName || 'User';
    const displayTarget = targetName || 'the item';
    
    try {
        if (!to) return;
        const subject = i18n.t('emails.report_confirmation.subject', lang);
        const header = i18n.t('emails.report_confirmation.header', lang);
        const greeting = i18n.t('emails.report_confirmation.greeting', lang, { userName: displayName });
        const content = i18n.t('emails.report_confirmation.content', lang, { 
            type: type === 'USER' ? i18n.t('emails.report_confirmation.type_user', lang) : i18n.t('emails.report_confirmation.type_post', lang),
            targetName: displayTarget 
        });
        const reasonLabel = i18n.t('emails.report_confirmation.reason_label', lang);
        const note = i18n.t('emails.report_confirmation.note', lang);
        const thanks = i18n.t('emails.common.thanks', lang);

        await transporter.sendMail({
            from: process.env.SMTP_FROM || '"EstateMarket Support" <support@estatemarket.com>',
            to: to,
            subject: subject,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden;">
                    <div style="background-color: #3b82f6; padding: 25px; text-align: center;">
                        <h2 style="color: white; margin: 0;">${header}</h2>
                    </div>
                    <div style="padding: 30px; background-color: #ffffff; color: #374151;">
                        <p style="font-size: 16px;">${greeting}</p>
                        <p style="line-height: 1.6;">${content}</p>
                        <div style="background-color: #f3f4f6; border-left: 4px solid #3b82f6; padding: 15px; margin: 20px 0;">
                            <p style="margin: 0;"><strong>${reasonLabel}</strong> ${reason}</p>
                        </div>
                        <p style="font-size: 14px; color: #6b7280;">${note}</p>
                        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 25px 0;">
                        <p style="font-size: 12px; color: #9ca3af; text-align: center;">${thanks}</p>
                    </div>
                </div>
            `,
        });
        return true;
    } catch (error) {
        console.error("Error sending report confirmation email:", error);
        return false;
    }
};
