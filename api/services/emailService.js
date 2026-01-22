const nodemailer = require('nodemailer');

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

exports.sendTopupSuccessEmail = async (to, userName, amount, newBalance) => {
    try {
        if (!to) return;

        const info = await transporter.sendMail({
            from: process.env.SMTP_FROM || '"NhaTot Support" <support@nhatot.com>',
            to: to,
            subject: '✅ Nạp tiền thành công!',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #2563eb;">Nạp tiền thành công!</h2>
                    <p>Xin chào <strong>${userName}</strong>,</p>
                    <p>Bạn vừa nạp thành công số tiền: <strong style="color: #16a34a; font-size: 18px;">${new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount)}</strong> vào ví NhaTot.</p>
                    
                    <div style="background-color: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
                        <p style="margin: 0;">Số dư hiện tại:</p>
                        <p style="margin: 5px 0 0; font-size: 24px; font-weight: bold; color: #1f2937;">${new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(newBalance)}</p>
                    </div>
                    
                    <p>Cảm ơn bạn đã sử dụng dịch vụ của chúng tôi.</p>
                    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
                    <p style="color: #6b7280; font-size: 12px;">Đây là email tự động, vui lòng không trả lời.</p>
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

exports.sendWithdrawOTP = async (to, userName, otp, amount) => {
    try {
        if (!to) return;
        await transporter.sendMail({
            from: process.env.SMTP_FROM || '"NhaTot Support" <support@nhatot.com>',
            to: to,
            subject: '🔐 Mã xác nhận rút tiền',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #2563eb;">Yêu cầu rút tiền</h2>
                    <p>Xin chào <strong>${userName}</strong>,</p>
                    <p>Bạn đang thực hiện yêu cầu rút số tiền: <strong style="color: #ef4444; font-size: 18px;">${new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount)}</strong>.</p>
                    <p>Mã OTP xác thực của bạn là:</p>
                    <div style="background-color: #f3f4f6; padding: 15px; border-radius: 8px; text-align: center; margin: 20px 0;">
                        <span style="font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #1f2937;">${otp}</span>
                    </div>
                    <p>Mã này sẽ hết hạn trong 10 phút. Tuyệt đối không chia sẻ mã này cho bất kỳ ai.</p>
                </div>
            `,
        });
        return true;
    } catch (error) {
        console.error("Error sending OTP email:", error);
        return false;
    }
};

exports.sendAdminWithdrawNotification = async (userName, amount, requestId) => {
    try {
        // Debug Log
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
            from: process.env.SMTP_FROM || '"NhaTot System" <system@nhatot.com>',
            to: adminEmail,
            subject: '🔔 [ADMIN] Yêu cầu rút tiền mới',
            html: `
                <div style="font-family: Arial, sans-serif;">
                    <h3>Yêu cầu rút tiền mới</h3>
                    <p>User: <strong>${userName}</strong></p>
                    <p>Số tiền: <strong>${new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount)}</strong></p>
                    <p>Request ID: ${requestId}</p>
                    <a href="${process.env.CLIENT_URL || 'http://localhost:5173'}/admin/withdrawals">Kiểm tra ngay</a>
                </div>
            `,
        });
        console.log("✅ Admin notification sent to:", adminEmail);
    } catch (error) {
        console.error("Error sending admin notification:", error);
    }
};

exports.sendWithdrawStatusUpdate = async (to, userName, status, amount, note) => {
    try {
        if (!to) return;

        let statusColor = '#3b82f6';
        let statusText = 'Đang xử lý';
        if (status === 'APPROVED') { statusColor = '#10b981'; statusText = 'Đã duyệt'; }
        if (status === 'REJECTED') { statusColor = '#ef4444'; statusText = 'Từ chối'; }
        if (status === 'PAID') { statusColor = '#10b981'; statusText = 'Đã thanh toán'; }

        await transporter.sendMail({
            from: process.env.SMTP_FROM || '"NhaTot Support" <support@nhatot.com>',
            to: to,
            subject: `📢 Cập nhật trạng thái rút tiền: ${statusText}`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: ${statusColor};">${statusText}</h2>
                    <p>Xin chào <strong>${userName}</strong>,</p>
                    <p>Yêu cầu rút tiền <strong>${new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount)}</strong> của bạn đã chuyển sang trạng thái: <strong style="color: ${statusColor};">${statusText}</strong>.</p>
                    ${note ? `<p><strong>Ghi chú từ Admin:</strong> ${note}</p>` : ''}
                    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
                    <p style="color: #6b7280; font-size: 12px;">Cảm ơn bạn đã sử dụng dịch vụ.</p>
                </div>
            `,
        });
        return true;
    } catch (error) {
        console.error("Error sending status email:", error);
        return false;
    }
};
