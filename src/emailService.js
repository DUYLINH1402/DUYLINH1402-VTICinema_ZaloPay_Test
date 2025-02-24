const nodemailer = require("nodemailer");
require("dotenv").config();

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

/**
 * Gửi email xác nhận đặt vé sau khi thanh toán thành công
 * @param {string} toEmail - Email của khách hàng
 * @param {Object} bookingInfo - Thông tin đặt vé
 */
const sendBookingConfirmation = async (toEmail, bookingInfo) => {
  const mailOptions = {
    from: `"VTI Cinema" <${process.env.EMAIL_USER}>`,
    to: toEmail,
    subject: "Đặt vé xem phim thành công!",
    html: `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #ddd; padding: 20px; border-radius: 10px; background-color: #f9f9f9;">
      <h2 style="color: #e50914; text-align: center;">🎉 Xác nhận đặt vé thành công! 🎉</h2>
      <p style="font-size: 16px;"><strong>Xin chào ${bookingInfo.customerName},</strong></p>
      <p style="font-size: 16px;">Bạn đã đặt vé thành công cho bộ phim <strong>${bookingInfo.movieTitle}</strong>.</p>
      
      <table style="width: 100%; border-collapse: collapse; margin-top: 10px;">
        <tr>
          <td style="padding: 8px; border-bottom: 1px solid #ddd;"><strong>🎬 Rạp:</strong></td>
          <td style="padding: 8px; border-bottom: 1px solid #ddd;">${bookingInfo.cinema}</td>
        </tr>
        <tr>
          <td style="padding: 8px; border-bottom: 1px solid #ddd;"><strong>🕒 Suất chiếu:</strong></td>
          <td style="padding: 8px; border-bottom: 1px solid #ddd;">${bookingInfo.showday} - ${bookingInfo.showtime}</td>
        </tr>
        <tr>
          <td style="padding: 8px; border-bottom: 1px solid #ddd;"><strong>🎟️ Ghế:</strong></td>
          <td style="padding: 8px; border-bottom: 1px solid #ddd;">${bookingInfo.seats}</td>
        </tr>
        <tr>
          <td style="padding: 8px; border-bottom: 1px solid #ddd;"><strong>🍿 Dịch vụ:</strong></td>
          <td style="padding: 8px; border-bottom: 1px solid #ddd;">${bookingInfo.services}</td>
        </tr>
        <tr>
          <td style="padding: 8px; border-bottom: 1px solid #ddd;"><strong>💰 Tổng thanh toán:</strong></td>
          <td style="padding: 8px; border-bottom: 1px solid #ddd; color: #e50914; font-size: 18px;"><strong>${bookingInfo.price}</strong></td>
        </tr>
      </table>

      <p style="text-align: center; font-size: 16px; color: #333; margin-top: 20px;">
        Cảm ơn bạn đã sử dụng dịch vụ của chúng tôi! Chúc bạn có một trải nghiệm tuyệt vời 🎬🍿
      </p>

      <div style="text-align: center; margin-top: 20px;">
        <p style="font-size: 18px; color: #e50914; font-weight: bold;">Hẹn gặp lại tại rạp!</p>
      </div>
    </div>
  `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`📧 Email xác nhận đã gửi tới ${toEmail}`);
  } catch (error) {
    console.error("❌ Lỗi gửi email:", error);
  }
};

module.exports = sendBookingConfirmation;
