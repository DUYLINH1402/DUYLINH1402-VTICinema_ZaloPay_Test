const express = require("express");
const router = express.Router();
const { get } = require("firebase-admin/database");
const { db } = require("../firebase/firebaseConfig");

// Lấy danh sách rạp theo thành phố
async function getCinemasByCity(cityName) {
  const snapshot = await get(db.ref("Cinemas"));
  const data = snapshot.val();

  const cinemas = Object.values(data || {}).filter(
    (cinema) => cinema.city.toLowerCase() === cityName.toLowerCase()
  );

  return cinemas.map((c) => c.cinema_name).join(", ");
}

// Lấy thông tin chi tiết rạp
async function getCinemaDetailByName(name) {
  const snapshot = await get(db.ref("Cinemas"));
  const data = snapshot.val();

  const cinema = Object.values(data || {}).find((c) =>
    c.cinema_name.toLowerCase().includes(name.toLowerCase())
  );

  if (!cinema) return null;

  return `🏢 ${cinema.cinema_name}\n📍 Địa chỉ: ${cinema.location}\n📞 SĐT: ${cinema.phone_number}\n🕗 Giờ mở cửa: ${cinema.opening_hours}`;
}

router.post("/", async (req, res) => {
  const intentName = req.body.queryResult?.intent?.displayName;
  const params = req.body.queryResult?.parameters;
  let responseText = "";

  try {
    switch (intentName) {
      case "DanhSachRapTheoThanhPho":
        const city = params["thanhpho"];
        const list = await getCinemasByCity(city);
        responseText = list
          ? `📍 Các rạp ở ${city}: ${list}`
          : `Mình không tìm thấy rạp nào ở ${city}`;
        break;

      case "ThongTinRap":
        const name = params["tenrap"];
        const detail = await getCinemaDetailByName(name);
        responseText = detail || `Không tìm thấy thông tin rạp ${name}`;
        break;

      case "GioMoCuaRap":
        const detailRap = await getCinemaDetailByName(params["tenrap"]);
        responseText = detailRap
          ? `${params["tenrap"]} mở cửa lúc ${detailRap.match(/🕗 Giờ mở cửa: (.+)/)?.[1]}`
          : `Mình không tìm thấy rạp ${params["tenrap"]}`;
        break;

      default:
        responseText = "Xin lỗi, mình chưa hỗ trợ yêu cầu này.";
    }
  } catch (error) {
    console.error(" Lỗi webhook:", error);
    responseText = "Đã xảy ra lỗi khi xử lý yêu cầu.";
  }

  res.json({ fulfillmentText: responseText });
});

module.exports = router;
