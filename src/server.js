// Node v10.15.3
require("dotenv").config(); // Load file .env
const axios = require("axios"); // npm install axios
const CryptoJS = require("crypto-js"); // npm install crypto-js
const express = require("express"); // npm install express
const bodyParser = require("body-parser"); // npm install body-parser
const moment = require("moment"); // npm install moment
const cron = require("node-cron");
const cors = require("cors");
const app = express();
const { getDatabase, ref, remove } = require("firebase-admin/database");
const { db } = require("./firebase/firebaseConfig");

const config = {
  app_id: process.env.ZALO_APP_ID,
  key1: process.env.ZALO_KEY1,
  key2: process.env.ZALO_KEY2,
  endpoint: "https://sb-openapi.zalopay.vn/v2/create",
};
// CORS ORIGIN
// Cho phép khi Test và khi đã Deploy
const allowedOrigins = [
  "http://localhost:5173",
  "https://vticinema.web.app",
  "https://vticinema-zalopay-test.vercel.app",
];
app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true, // Cho phép gửi cookie hoặc thông tin đăng nhập
  })
);
// Route mặc định
app.get("/", (req, res) => {
  res.send("Welcome to the VTI Cinema Payment API!");
});

app.use(bodyParser.json());

/**
 * methed: POST
 * Sandbox	POST	https://sb-openapi.zalopay.vn/v2/create
 * Real	POST	https://openapi.zalopay.vn/v2/create
 * description: tạo đơn hàng, thanh toán
 */

// Hàm tạo app_trans_id
function generateAppTransId() {
  const now = new Date();
  const datePart = now.toISOString().slice(2, 10).replace(/-/g, ""); // Lấy định dạng yymmdd
  const randomPart = Math.floor(Math.random() * 100000); // Sinh số ngẫu nhiên từ 0 đến 99999
  return `${datePart}_${randomPart}`;
}

app.post("/payment", async (req, res) => {
  const appTransId = generateAppTransId();
  const embed_data = {
    //sau khi hoàn tất thanh toán sẽ đi vào link này (thường là link web thanh toán thành công của mình)
    redirecturl: `https://vticinema.web.app/payment-result?appTransId=${appTransId}`,
    // redirecturl: `http://localhost:5173/payment-result?appTransId=${appTransId}`,
  };

  const items = [];
  const transID = Math.floor(Math.random() * 1000000);
  // Tạo app_trans_id
  const { amount, description, email, services, movieDetails } = req.body;
  console.log(amount);
  console.log(description);
  console.log(email);
  console.log("Service: ", services);

  const order = {
    app_trans_id: appTransId, // Mã giao dịch của ứng dụng
    app_id: config.app_id,
    app_user: email || "unknown_user",
    app_time: Date.now(), // miliseconds
    item: JSON.stringify(items),
    embed_data: JSON.stringify(embed_data),
    amount: amount,
    //khi thanh toán xong, zalopay server sẽ POST đến url này để thông báo cho server của mình
    //Chú ý: cần dùng ngrok để public url thì Zalopay Server mới call đến được
    // callback_url: "https://a83b-126-103-150-211.ngrok-free.app/callback",
    callback_url: "https://vticinema-zalopay-test.vercel.app/callback",
    description: `${description} #${transID}`,
    bank_code: "",
  };

  // appid|app_trans_id|appuser|amount|apptime|embeddata|item
  const data =
    config.app_id +
    "|" +
    order.app_trans_id +
    "|" +
    order.app_user +
    "|" +
    order.amount +
    "|" +
    order.app_time +
    "|" +
    order.embed_data +
    "|" +
    order.item;
  order.mac = CryptoJS.HmacSHA256(data, config.key1).toString();

  // Lưu thông tin đơn hàng vào Firebase
  const orderRef = db.ref(`Orders/${appTransId}`);
  await orderRef.set({
    app_trans_id: appTransId,
    description: `${description} #${transID}`,
    createdAt: new Date().toISOString(),
    amount,
    app_user: email,
    status: "pending",
    services,
    movieDetails,
  });
  try {
    const result = await axios.post(config.endpoint, null, { params: order });

    return res.status(200).json(result.data);
  } catch (error) {
    console.log(error.message);
  }
});

/**
 * method: POST
 * description: callback để Zalopay Server call đến khi thanh toán thành công.
 * Khi và chỉ khi ZaloPay đã thu tiền khách hàng thành công thì mới gọi API này để thông báo kết quả.
 */

app.post("/callback", async (req, res) => {
  console.log("Dữ liệu callback nhận được:", req.body);
  // Lấy appTransId liệu từ ZaloPay
  const data =
    typeof req.body.data === "string"
      ? JSON.parse(req.body.data)
      : req.body.data; // Parse JSON nếu `data` là chuỗi JSON
  // const data = JSON.parse(req.body.data);
  const appTransId = data.app_trans_id; // Lấy app_trans_id từ data

  // console.log("req.body:", req.body); // Xem toàn bộ req.body
  // console.log("appTransId nhận được:", appTransId);
  // console.log("Callback nhận được:", req.body);
  let result = {};
  try {
    const dataStr = req.body.data; // Chuỗi dữ liệu từ ZaloPay
    if (!dataStr) {
      console.error("Dữ liệu `data` không tồn tại!");
      return res.status(400).json({ error: "Dữ liệu `data` không tồn tại!" });
    }
    const reqMac = req.body.mac; // MAC từ ZaloPay

    // Tạo MAC để xác thực
    try {
      const mac = CryptoJS.HmacSHA256(dataStr, config.key2).toString();
      console.log("MAC được tạo:", mac);
    } catch (error) {
      console.error("Lỗi khi tạo MAC:", error.message);
      return res.status(500).json({ error: "Lỗi khi tạo MAC" });
    }
    console.log("MAC:", mac);

    // FixBug
    if (!config.key2) {
      console.error("key2 không tồn tại hoặc chưa được cấu hình!");
    }
    console.log("key2:", config.key2);

    if (reqMac !== mac) {
      console.error("MAC không khớp!");
      result.return_code = -1;
      result.return_message = "mac not equal";
    } else {
      // const dataJson = JSON.parse(dataStr);
      // Cập nhật trạng thái giao dịch trong Firebase
      const orderRef = db.ref(`Orders/${appTransId}`);
      await orderRef.update({
        status: "success",
        updatedAt: new Date().toISOString(),
      });

      console.log("Cập nhật trạng thái thành công!");
      result.return_code = 1;
      result.return_message = "success";
    }
  } catch (error) {
    console.error("Lỗi trong callback:", error.message);
    result.return_code = 0;
    result.return_message = error.message;
  }

  res.status(200).json(result); // Trả về kết quả cho ZaloPay
});

// Chạy cron job mỗi ngày 1 lần để dọn các giao dịch pending quá hạn
cron.schedule("0 0 * * *", async () => {
  console.log("Dọn dẹp giao dịch `pending` lâu...");
  const ordersRef = ref(db, "Orders");
  const snapshot = await get(ordersRef);

  if (snapshot.exists()) {
    const orders = snapshot.val();
    const now = Date.now();
    const db = getDatabase();

    for (const [orderId, order] of Object.entries(orders)) {
      if (order.status === "pending") {
        const createdAt = new Date(order.createdAt).getTime();
        const age = now - createdAt;

        // Xóa đơn hàng nếu đã lâu hơn 24 giờ
        if (age > 24 * 60 * 60 * 1000) {
          console.log(`Xóa giao dịch quá hạn: ${orderId}`);
          await remove(ref(db, `Orders/${orderId}`));
        }
      }
    }
  }
});

//Kiểm tra trạng thái đơn hàng
app.get("/payment-status/:app_trans_id", async (req, res) => {
  const app_trans_id = req.params.app_trans_id;

  // Giả lập kiểm tra trạng thái đơn hàng
  const orderStatus = getOrderStatusFromDatabase(app_trans_id); // Lấy từ DB

  if (orderStatus) {
    res.json({ status: "success", order: orderStatus });
  } else {
    res.status(404).json({ status: "not_found", message: "Order not found" });
  }
});

if (process.env.NODE_ENV !== "production") {
  app.listen(8888, function () {
    console.log("Server is listening at port 8888");
  });
}

module.exports = app;
