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
    from: process.env.EMAIL_USER,
    to: toEmail,
    subject: "Đặt vé xem phim thành công!",
    html: `
            <h2>Xin chào ${bookingInfo.customerName},</h2>
            <p>Bạn đã đặt vé thành công cho bộ phim <strong>${
              bookingInfo.movieTitle
            }</strong>.</p>
            <p><strong>Rạp:</strong> ${bookingInfo.cinema}</p>
            <p><strong>Suất chiếu:</strong> ${bookingInfo.showday} - ${
      bookingInfo.showtime
    }</p>
            <p><strong>Ghế:</strong> ${bookingInfo.seats}</p>
            <p><strong>Dịch vụ:</strong> ${bookingInfo.services}</p>
            <p><strong>Tổng thanh toán:</strong> ${new Intl.NumberFormat(
              "vi-VN"
            ).format(bookingInfo.price)} VND</p>

            <p>Cảm ơn bạn đã sử dụng dịch vụ của chúng tôi!</p>
            <hr>
            <p>Hẹn gặp lại tại rạp! 🍿</p>
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
