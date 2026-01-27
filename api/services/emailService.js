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
exports.sendAppointmentRequestSender = async (to, userName, postTitle, time) => {
    try {
        if (!to) return;
        await transporter.sendMail({
            from: process.env.SMTP_FROM || '"NhaTot Support" <support@nhatot.com>',
            to: to,
            subject: '📅 Xác nhận yêu cầu đặt lịch xem nhà',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #2563eb;">Yêu cầu đã được gửi!</h2>
                    <p>Xin chào <strong>${userName}</strong>,</p>
                    <p>Bạn đã gửi yêu cầu xem nhà cho tin đăng: <strong>${postTitle}</strong>.</p>
                    <p>Thời gian: <strong>${new Date(time).toLocaleString('vi-VN')}</strong></p>
                    <p>Vui lòng chờ người bán xác nhận. Chúng tôi sẽ thông báo ngay khi có kết quả.</p>
                    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
                    <p style="color: #6b7280; font-size: 12px;">Cảm ơn bạn đã sử dụng NhaTot.</p>
                </div>
            `,
        });
        return true;
    } catch (error) {
        console.error("Error sending appointment sender email:", error);
        return false;
    }
};

exports.sendAppointmentRequestReceiver = async (to, sellerName, buyerName, postTitle, time, note) => {
    try {
        if (!to) return;
        await transporter.sendMail({
            from: process.env.SMTP_FROM || '"NhaTot System" <system@nhatot.com>',
            to: to,
            subject: '🔔 Bạn có yêu cầu xem nhà mới',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #2563eb;">Yêu cầu xem nhà mới!</h2>
                    <p>Xin chào <strong>${sellerName}</strong>,</p>
                    <p>Người dùng <strong>${buyerName}</strong> muốn đặt lịch xem nhà của bạn: <strong>${postTitle}</strong>.</p>
                    <div style="background-color: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
                        <p style="margin: 5px 0;"><strong>Thời gian:</strong> ${new Date(time).toLocaleString('vi-VN')}</p>
                        <p style="margin: 5px 0;"><strong>Ghi chú:</strong> ${note || "Không có"}</p>
                    </div>
                    <p>Vui lòng truy cập trang cá nhân để Chấp nhận hoặc Từ chối.</p>
                    <a href="${process.env.CLIENT_URL || 'http://localhost:5173'}/profile?tab=appointments" style="display: inline-block; background-color: #2563eb; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; font-weight: bold;">Quản lý lịch hẹn</a>
                </div>
            `,
        });
        return true;
    } catch (error) {
        console.error("Error sending appointment receiver email:", error);
        return false;
    }
};

exports.sendAppointmentStatusUpdate = async (to, userName, postTitle, status, time) => {
    try {
        if (!to) return;
        let statusText = status === 'APPROVED' ? 'Được chấp nhận ✅' : 'Bị từ chối ❌';
        let color = status === 'APPROVED' ? '#16a34a' : '#ef4444';

        await transporter.sendMail({
            from: process.env.SMTP_FROM || '"NhaTot Support" <support@nhatot.com>',
            to: to,
            subject: `📢 Cập nhật lịch hẹn: ${statusText}`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: ${color};">${statusText}</h2>
                    <p>Xin chào <strong>${userName}</strong>,</p>
                    <p>Yêu cầu xem nhà <strong>${postTitle}</strong> của bạn vào lúc <strong>${new Date(time).toLocaleString('vi-VN')}</strong> đã <strong>${statusText}</strong>.</p>
                    ${status === 'APPROVED' ? '<p>Vui lòng đến đúng giờ hoặc liên hệ người bán nếu có thay đổi.</p>' : '<p>Bạn có thể thử đặt lịch vào thời gian khác.</p>'}
                    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
                    <p style="color: #6b7280; font-size: 12px;">Cảm ơn bạn đã sử dụng NhaTot.</p>
                </div>
            `,
        });
        return true;
    } catch (error) {
        console.error("Error sending appointment status email:", error);
        return false;
    }
};

exports.sendViolationWarning = async (to, userName, postTitle, reason, description) => {
    try {
        if (!to) return;

        let reasonText = reason;
        const reasons = {
            'WRONG_INFO': 'Thông tin sai lệch',
            'SCAM': 'Lừa đảo',
            'DUPLICATE': 'Tin trùng lặp',
            'SPAM': 'Spam',
            'OTHER': 'Khác'
        };
        if (reasons[reason]) reasonText = reasons[reason];

        await transporter.sendMail({
            from: process.env.SMTP_FROM || '"NhaTot System" <system@nhatot.com>',
            to: to,
            subject: '⚠️ Cảnh báo vi phạm quy định đăng tin',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
                    <div style="background-color: #ef4444; padding: 20px; text-align: center;">
                        <h2 style="color: white; margin: 0;">Cảnh báo vi phạm</h2>
                    </div>
                    <div style="padding: 20px;">
                        <p>Xin chào <strong>${userName}</strong>,</p>
                        <p>Bài đăng của bạn: <strong>${postTitle}</strong> đã bị báo cáo và xác nhận vi phạm quy định của NhaTot.</p>
                        
                        <div style="background-color: #fff1f2; border-left: 4px solid #ef4444; padding: 15px; margin: 20px 0;">
                            <p style="margin: 5px 0;"><strong>Lý do:</strong> ${reasonText}</p>
                            ${description ? `<p style="margin: 5px 0;"><strong>Chi tiết:</strong> ${description}</p>` : ''}
                        </div>

                        <p>Vui lòng <strong>chỉnh sửa bài đăng</strong> để tuân thủ quy định ngay lập tức. Nếu tiếp tục vi phạm, tài khoản của bạn có thể bị khóa.</p>
                        
                        <div style="text-align: center; margin-top: 25px;">
                            <a href="${process.env.CLIENT_URL || 'http://localhost:5173'}/profile?tab=posts" style="display: inline-block; background-color: #ef4444; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">Quản lý bài đăng</a>
                        </div>
                    </div>
                    <div style="background-color: #f9fafb; padding: 15px; text-align: center; border-top: 1px solid #e5e7eb;">
                        <p style="color: #6b7280; font-size: 12px; margin: 0;">Đội ngũ kiểm duyệt NhaTot</p>
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
