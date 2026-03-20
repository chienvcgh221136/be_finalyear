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

exports.sendTopupSuccessEmail = async (to, userName, amount, newBalance, lang = 'vi') => {
    try {
        if (!to) return;
        
        const isEn = lang === 'en';
        const subject = isEn ? '✅ Top-up Successful!' : '✅ Nạp tiền thành công!';
        const header = isEn ? 'Top-up Successful!' : 'Nạp tiền thành công!';
        const greeting = isEn ? `Hello <strong>${userName}</strong>,` : `Xin chào <strong>${userName}</strong>,`;
        const content = isEn ? `You have successfully topped up: <strong style="color: #16a34a; font-size: 18px;">${new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount)}</strong> into your EstateMarket wallet.` : `Bạn vừa nạp thành công số tiền: <strong style="color: #16a34a; font-size: 18px;">${new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount)}</strong> vào ví EstateMarket.`;
        const balanceLabel = isEn ? `Current balance:` : `Số dư hiện tại:`;
        const thanks = isEn ? `Thank you for using our service.` : `Cảm ơn bạn đã sử dụng dịch vụ của chúng tôi.`;
        const footerText = isEn ? `This is an automated email, please do not reply.` : `Đây là email tự động, vui lòng không trả lời.`;

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
                        <p style="margin: 5px 0 0; font-size: 24px; font-weight: bold; color: #1f2937;">${new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(newBalance)}</p>
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
        const isEn = lang === 'en';
        const subject = isEn ? '🔐 Withdrawal OTP' : '🔐 Mã xác nhận rút tiền';
        const header = isEn ? 'Withdrawal Request' : 'Yêu cầu rút tiền';
        const greeting = isEn ? `Hello <strong>${userName}</strong>,` : `Xin chào <strong>${userName}</strong>,`;
        const content = isEn ? `You are requesting to withdraw: <strong style="color: #ef4444; font-size: 18px;">${new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount)}</strong>.` : `Bạn đang thực hiện yêu cầu rút số tiền: <strong style="color: #ef4444; font-size: 18px;">${new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount)}</strong>.`;
        const otpText = isEn ? `Your verification OTP is:` : `Mã OTP xác thực của bạn là:`;
        const footer = isEn ? `This code will expire in 10 minutes. Do not share this code with anyone.` : `Mã này sẽ hết hạn trong 10 phút. Tuyệt đối không chia sẻ mã này cho bất kỳ ai.`;

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
        const isEn = lang === 'en';
        const subject = isEn ? '🔔 [ADMIN] New Withdrawal Request' : '🔔 [ADMIN] Yêu cầu rút tiền mới';
        const header = isEn ? 'New Withdrawal Request' : 'Yêu cầu rút tiền mới';
        const amountLabel = isEn ? 'Amount:' : 'Số tiền:';
        const checkLink = isEn ? 'Check now' : 'Kiểm tra ngay';

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
                    <p>User: <strong>${userName}</strong></p>
                    <p>${amountLabel} <strong>${new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount)}</strong></p>
                    <p>Request ID: ${requestId}</p>
                    <a href="${process.env.CLIENT_URL || 'http://localhost:5173'}/admin/withdrawals">${checkLink}</a>
                </div>
            `,
        });
        console.log("✅ Admin notification sent to:", adminEmail);
    } catch (error) {
        console.error("Error sending admin notification:", error);
    }
};

exports.sendWithdrawStatusUpdate = async (to, userName, status, amount, note, lang = 'vi') => {
    try {
        if (!to) return;
        const isEn = lang === 'en';

        let statusColor = '#3b82f6';
        let statusText = isEn ? 'Processing' : 'Đang xử lý';
        if (status === 'APPROVED') { statusColor = '#10b981'; statusText = isEn ? 'Approved' : 'Đã duyệt'; }
        if (status === 'REJECTED') { statusColor = '#ef4444'; statusText = isEn ? 'Rejected' : 'Từ chối'; }
        if (status === 'PAID') { statusColor = '#10b981'; statusText = isEn ? 'Paid' : 'Đã thanh toán'; }

        const subject = isEn ? `📢 Withdrawal Status Update: ${statusText}` : `📢 Cập nhật trạng thái rút tiền: ${statusText}`;
        const greeting = isEn ? `Hello <strong>${userName}</strong>,` : `Xin chào <strong>${userName}</strong>,`;
        const content = isEn 
            ? `Your withdrawal request of <strong>${new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount)}</strong> has changed status to: <strong style="color: ${statusColor};">${statusText}</strong>.` 
            : `Yêu cầu rút tiền <strong>${new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount)}</strong> của bạn đã chuyển sang trạng thái: <strong style="color: ${statusColor};">${statusText}</strong>.`;
        const noteLabel = isEn ? `Note from Admin:` : `Ghi chú từ Admin:`;
        const thanks = isEn ? `Thank you for using our service.` : `Cảm ơn bạn đã sử dụng dịch vụ.`;

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
        const isEn = lang === 'en';
        
        const subject = isEn ? '📅 Viewing Appointment Request Confirmation' : '📅 Xác nhận yêu cầu đặt lịch xem nhà';
        const header = isEn ? 'Request Sent!' : 'Yêu cầu đã được gửi!';
        const greeting = isEn ? `Hello <strong>${userName}</strong>,` : `Xin chào <strong>${userName}</strong>,`;
        const content = isEn ? `You have sent a viewing appointment request for the property: <strong>${postTitle}</strong>.` : `Bạn đã gửi yêu cầu xem nhà cho tin đăng: <strong>${postTitle}</strong>.`;
        const timeLabel = isEn ? `Time:` : `Thời gian:`;
        const pendingWait = isEn ? `Please wait for the seller to confirm. We will notify you of the result soon.` : `Vui lòng chờ người bán xác nhận. Chúng tôi sẽ thông báo ngay khi có kết quả.`;
        const thanks = isEn ? `Thank you for using EstateMarket.` : `Cảm ơn bạn đã sử dụng EstateMarket.`;

        await transporter.sendMail({
            from: process.env.SMTP_FROM || '"EstateMarket Support" <support@estatemarket.com>',
            to: to,
            subject: subject,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #2563eb;">${header}</h2>
                    <p>${greeting}</p>
                    <p>${content}</p>
                    <p>${timeLabel} <strong>${new Date(time).toLocaleString(isEn ? 'en-US' : 'vi-VN')}</strong></p>
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
        const isEn = lang === 'en';

        const subject = isEn ? '🔔 You have a new viewing appointment request' : '🔔 Bạn có yêu cầu xem nhà mới';
        const header = isEn ? 'New viewing request!' : 'Yêu cầu xem nhà mới!';
        const greeting = isEn ? `Hello <strong>${sellerName}</strong>,` : `Xin chào <strong>${sellerName}</strong>,`;
        const content = isEn ? `User <strong>${buyerName}</strong> wants to schedule a viewing for your property: <strong>${postTitle}</strong>.` : `Người dùng <strong>${buyerName}</strong> muốn đặt lịch xem nhà của bạn: <strong>${postTitle}</strong>.`;
        const timeLabel = isEn ? `Time:` : `Thời gian:`;
        const noteLabel = isEn ? `Note:` : `Ghi chú:`;
        const noNote = isEn ? `None` : `Không có`;
        const actionText = isEn ? `Please visit your profile to Accept or Reject.` : `Vui lòng truy cập trang cá nhân để Chấp nhận hoặc Từ chối.`;
        const btnText = isEn ? `Manage Appointments` : `Quản lý lịch hẹn`;

        await transporter.sendMail({
            from: process.env.SMTP_FROM || '"EstateMarket System" <system@estatemarket.com>',
            to: to,
            subject: subject,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #2563eb;">${header}</h2>
                    <p>${greeting}</p>
                    <p>${content}</p>
                    <div style="background-color: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
                        <p style="margin: 5px 0;"><strong>${timeLabel}</strong> ${new Date(time).toLocaleString(isEn ? 'en-US' : 'vi-VN')}</p>
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
        const isEn = lang === 'en';

        let statusText = status === 'APPROVED' ? (isEn ? 'Approved ✅' : 'Được chấp nhận ✅') : (isEn ? 'Rejected ❌' : 'Bị từ chối ❌');
        let color = status === 'APPROVED' ? '#16a34a' : '#ef4444';

        const subject = isEn ? `📢 Appointment Update: ${statusText}` : `📢 Cập nhật lịch hẹn: ${statusText}`;
        const greeting = isEn ? `Hello <strong>${userName}</strong>,` : `Xin chào <strong>${userName}</strong>,`;
        const content = isEn 
            ? `Your viewing request for <strong>${postTitle}</strong> on <strong>${new Date(time).toLocaleString('en-US')}</strong> has been <strong>${statusText}</strong>.`
            : `Yêu cầu xem nhà <strong>${postTitle}</strong> của bạn vào lúc <strong>${new Date(time).toLocaleString('vi-VN')}</strong> đã <strong>${statusText}</strong>.`;
        
        const approvedExtra = isEn ? '<p>Please arrive on time or contact the seller if there are changes.</p>' : '<p>Vui lòng đến đúng giờ hoặc liên hệ người bán nếu có thay đổi.</p>';
        const rejectedExtra = isEn ? '<p>You can try scheduling for a different time.</p>' : '<p>Bạn có thể thử đặt lịch vào thời gian khác.</p>';
        const thanks = isEn ? `Thank you for using EstateMarket.` : `Cảm ơn bạn đã sử dụng EstateMarket.`;

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
    try {
        if (!to) return;
        const isEn = lang === 'en';

        let reasonText = reason;
        const reasonsVi = {
            'WRONG_INFO': 'Thông tin sai lệch',
            'SCAM': 'Lừa đảo',
            'DUPLICATE': 'Tin trùng lặp',
            'SPAM': 'Spam',
            'OTHER': 'Khác'
        };
        const reasonsEn = {
            'WRONG_INFO': 'Misleading information',
            'SCAM': 'Scam / Fraud',
            'DUPLICATE': 'Duplicate post',
            'SPAM': 'Spam',
            'OTHER': 'Other'
        };
        
        const currentReasons = isEn ? reasonsEn : reasonsVi;
        if (currentReasons[reason]) reasonText = currentReasons[reason];

        const subject = isEn ? '⚠️ Post Violation Warning' : '⚠️ Cảnh báo vi phạm quy định đăng tin';
        const header = isEn ? 'Violation Warning' : 'Cảnh báo vi phạm';
        const greeting = isEn ? `Hello <strong>${userName}</strong>,` : `Xin chào <strong>${userName}</strong>,`;
        const content = isEn ? `Your post: <strong>${postTitle}</strong> has been reported and confirmed to violate EstateMarket's policies.` : `Bài đăng của bạn: <strong>${postTitle}</strong> đã bị báo cáo và xác nhận vi phạm quy định của EstateMarket.`;
        const reasonLabel = isEn ? `Reason:` : `Lý do:`;
        const detailLabel = isEn ? `Details:` : `Chi tiết:`;
        const warningAction = isEn ? `Please <strong>edit your post</strong> to comply with our policies immediately. If the violation continues, your account may be locked.` : `Vui lòng <strong>chỉnh sửa bài đăng</strong> để tuân thủ quy định ngay lập tức. Nếu tiếp tục vi phạm, tài khoản của bạn có thể bị khóa.`;
        const btnText = isEn ? `Manage Posts` : `Quản lý bài đăng`;
        const footerText = isEn ? `EstateMarket Moderation Team` : `Đội ngũ kiểm duyệt EstateMarket`;

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
    try {
        if (!to) return;
        const isEn = lang === 'en';

        let reasonText = reason;
        const reasonsVi = {
            'WRONG_INFO': 'Thông tin sai lệch',
            'SCAM': 'Lừa đảo',
            'DUPLICATE': 'Tin trùng lặp',
            'SPAM': 'Spam',
            'OTHER': 'Khác'
        };
        const reasonsEn = {
            'WRONG_INFO': 'Misleading information',
            'SCAM': 'Scam / Fraud',
            'DUPLICATE': 'Duplicate post',
            'SPAM': 'Spam',
            'OTHER': 'Other'
        };
        const currentReasons = isEn ? reasonsEn : reasonsVi;
        if (currentReasons[reason]) reasonText = currentReasons[reason];

        const subject = isEn ? '⚠️ Community Policy Violation Warning' : '⚠️ Cảnh báo vi phạm quy định cộng đồng';
        const header = isEn ? 'Account Warning' : 'Cảnh báo tài khoản';
        const greeting = isEn ? `Hello <strong>${userName}</strong>,` : `Xin chào <strong>${userName}</strong>,`;
        const content = isEn ? `Your account has been reported and confirmed to violate EstateMarket's community policies.` : `Tài khoản của bạn đã bị báo cáo và xác nhận vi phạm quy định cộng đồng của EstateMarket.`;
        const reasonLabel = isEn ? `Violation Reason:` : `Lý do vi phạm:`;
        const detailLabel = isEn ? `Details:` : `Chi tiết:`;
        const warningAction = isEn ? `We strongly suggest you review your actions. <strong>If violations continue, your account will be permanently banned.</strong>` : `Chúng tôi đề nghị bạn xem lại các hành động của mình. <strong>Nếu tiếp tục vi phạm, tài khoản của bạn sẽ bị khóa vĩnh viễn.</strong>`;
        const btnText = isEn ? `View Policies` : `Xem quy định`;
        const footerText = isEn ? `EstateMarket Moderation Team` : `Đội ngũ kiểm duyệt EstateMarket`;

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
        const isEn = lang === 'en';

        const subject = isEn ? '⏰ Reminder: Pending Viewing Appointment' : '⏰ Nhắc nhở: Bạn có lịch hẹn chưa xử lý';
        const header = isEn ? 'Appointment Reminder!' : 'Nhắc nhở lịch hẹn!';
        const greeting = isEn ? `Hello <strong>${sellerName}</strong>,` : `Xin chào <strong>${sellerName}</strong>,`;
        const content = isEn ? `You have an unresponded viewing request from <strong>${buyerName}</strong> for: <strong>${postTitle}</strong>.` : `Bạn có một yêu cầu xem nhà từ <strong>${buyerName}</strong> cho tin: <strong>${postTitle}</strong> chưa được xử lý.`;
        const timeLabel = isEn ? `Time:` : `Thời gian:`;
        const overdueText = isEn ? `This request was sent over 24 hours ago.` : `Yêu cầu này đã được gửi hơn 24 giờ trước.`;
        const actionText = isEn ? `Please respond soon to avoid delaying the client.` : `Vui lòng phản hồi sớm để tránh làm mất thời gian của khách hàng.`;
        const btnText = isEn ? `Process Now` : `Xử lý ngay`;

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
                        <p style="margin: 5px 0;"><strong>${timeLabel}</strong> ${new Date(time).toLocaleString(isEn ? 'en-US' : 'vi-VN')}</p>
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
        const isEn = lang === 'en';

        const subject = isEn ? '⏳ We have reminded the seller about your appointment' : '⏳ Chúng tôi đã nhắc người bán về lịch hẹn của bạn';
        const header = isEn ? 'Awaiting Response...' : 'Đang chờ phản hồi...';
        const greeting = isEn ? `Hello <strong>${buyerName}</strong>,` : `Xin chào <strong>${buyerName}</strong>,`;
        const content = isEn ? `Your viewing request for <strong>${postTitle}</strong> (at ${new Date(time).toLocaleString('en-US')}) is still awaiting <strong>${sellerName}</strong>'s confirmation.` : `Yêu cầu xem nhà của bạn cho tin <strong>${postTitle}</strong> (lúc ${new Date(time).toLocaleString('vi-VN')}) vẫn đang chờ <strong>${sellerName}</strong> xác nhận.`;
        const reminderText = isEn ? `We have just sent an email to remind the seller to process your request soon.` : `Chúng tôi vừa gửi email nhắc nhở người bán để họ xử lý sớm yêu cầu của bạn.`;
        const thanks = isEn ? `Thank you for your patience.` : `Cảm ơn bạn đã kiên nhẫn.`;
        const footerText = isEn ? `EstateMarket Team` : `Đội ngũ EstateMarket`;

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

        const subject = isEn ? '🔐 Password Reset OTP' : '🔐 Mã xác nhận đặt lại mật khẩu';
        const header = isEn ? 'Account Verification' : 'Xác thực tài khoản';
        const greeting = isEn ? `Hello <strong>${userName}</strong>,` : `Xin chào <strong>${userName}</strong>,`;
        const content = isEn ? `We received a request to reset your password. Please use the OTP below to proceed:` : `Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản của bạn. Vui lòng sử dụng mã OTP dưới đây để tiếp tục:`;
        const noteLabel = isEn ? `Note:` : `Lưu ý:`;
        const note1 = isEn ? `This code is valid for <strong>5 minutes</strong>.` : `Mã này có hiệu lực trong <strong>5 phút</strong>.`;
        const note2 = isEn ? `If you did not make this request, please ignore this email.` : `Nếu bạn không thực hiện yêu cầu này, vui lòng bỏ qua email này.`;
        const note3 = isEn ? `Do not share this code with anyone.` : `Tuyệt đối không chia sẻ mã này cho bất kỳ ai.`;
        const footerText = isEn ? `© 2026 EstateMarket App. All rights reserved.` : `© 2026 EstateMarket App. Tất cả quyền được bảo lưu.`;

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
