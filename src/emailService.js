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
    <html>
      <head>
        <style>
          body {
            font-family: Arial, sans-serif;
            background-color: #f9f9f9;
            margin: 0;
            padding: 0;
          }
          .container {
            max-width: 600px;
            margin: auto;
            padding: 20px;
            background-color: #fff;
            border-radius: 10px;
            border: 1px solid #ddd;
          }
          h2 {
            color: #e50914;
            text-align: center;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 10px;
          }
          td {
            padding: 8px;
            border-bottom: 1px solid #ddd;
          }
          .highlight {
            color: #e50914;
            font-size: 18px;
            font-weight: bold;
          }
          .note {
            text-align: center;
            font-size: 16px;
            color: #e50914;
            font-weight: bold;
            margin-top: 10px;
          }
          .footer {
            text-align: center;
            font-size: 16px;
            color: #333;
            margin-top: 10px;
          }
          .cta {
            text-align: center;
            font-size: 18px;
            color: #e50914;
            font-weight: bold;
          }

          /* 📱 Tối ưu hiển thị trên Mobile */
          @media screen and (max-width: 600px) {
            .container {
              padding: 15px;
            }
            h2 {
              font-size: 20px;
            }
            td {
              font-size: 14px;
              padding: 6px;
            }
            .highlight {
              font-size: 16px;
            }
            .note, .footer, .cta {
              font-size: 14px;
            }
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h2>Xác nhận thanh toán thành công!</h2>
          <p><strong>Xin chào ${bookingInfo.customerName}</strong>,</p>
          <p>Bạn đã đặt vé thành công cho bộ phim <strong>${
            bookingInfo.movieTitle
          }</strong>.</p>

          <table>
            <tr>
              <td><strong>💳 Mã giao dịch:</strong></td>
              <td style="color: #0056b3; font-size: 16px;"><strong>${
                bookingInfo.transactionId
              }</strong></td>
            </tr>
            <tr>
              <td><strong>🎬 Rạp:</strong></td>
              <td>${bookingInfo.cinema}</td>
            </tr>
            <tr>
              <td><strong>🕒 Suất chiếu:</strong></td>
              <td>${bookingInfo.showtime} - ${bookingInfo.showday}</td>
            </tr>
            <tr>
              <td><strong>🎟️ Ghế:</strong></td>
              <td>${bookingInfo.seats}</td>
            </tr>
            <tr>
              <td><strong>🍿 Dịch vụ:</strong></td>
              <td>${bookingInfo.services}</td>
            </tr>
            <tr>
              <td><strong>📅 Ngày giao dịch:</strong></td>
              <td>${bookingInfo.transactionTime}</td>
            </tr>
            <tr>
              <td><strong>💰 Tổng thanh toán:</strong></td>
              <td class="highlight">${new Intl.NumberFormat("vi-VN").format(
                bookingInfo.price
              )} VND</td>
            </tr>
          </table>

          <p class="note">Lưu ý: Xuất trình mail này tại quầy để nhận vé!</p>
          <p class="footer">Cảm ơn bạn đã sử dụng dịch vụ của chúng tôi!</p>
          <p class="footer">Chúc bạn có một trải nghiệm tuyệt vời!</p>
          <div class="cta">Hẹn gặp lại bạn tại rạp!</div>
        </div>
      </body>
    </html>
  `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`Email xác nhận đã gửi tới ${toEmail}`);
  } catch (error) {
    console.error("Lỗi gửi email:", error);
  }
};

module.exports = sendBookingConfirmation;
