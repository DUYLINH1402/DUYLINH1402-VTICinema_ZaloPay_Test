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
const sendBookingConfirmation = require("./emailService");
// Route xử lý webhook từ Dialogflow
const dialogflowWebhook = require("./routes/dialogflowWebhook");
app.use("/webhook", dialogflowWebhook);

// Thêm các thư viện cho Dialogflow
const dialogflow = require("@google-cloud/dialogflow");
const { v4: uuid } = require("uuid");

// Cấu hình credentials cho Dialogflow
// Thay thế phần require file JSON bằng biến môi trường
const credentials = {
  type: "service_account",
  project_id: process.env.DIALOGFLOW_PROJECT_ID,
  private_key_id: "40aa75a82d2079f17687992eac6a94fd486d5058",
  private_key: process.env.DIALOGFLOW_PRIVATE_KEY.replace(/\\n/g, "\n"),
  client_email: process.env.DIALOGFLOW_CLIENT_EMAIL,
  client_id: process.env.DIALOGFLOW_CLIENT_ID,
  auth_uri: "https://accounts.google.com/o/oauth2/auth",
  token_uri: "https://oauth2.googleapis.com/token",
  auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
  client_x509_cert_url:
    "https://www.googleapis.com/robot/v1/metadata/x509/vtichatbot-qsgp%40vtichatbot-qsgp.iam.gserviceaccount.com",
  universe_domain: "googleapis.com",
};

const projectId = process.env.DIALOGFLOW_PROJECT_ID;
const sessionClient = new dialogflow.SessionsClient({ credentials });

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

// API Chatbot
app.post("/chatbot", async (req, res) => {
  const { message } = req.body;
  const sessionId = uuid();
  const sessionPath = sessionClient.projectAgentSessionPath(projectId, sessionId);

  const request = {
    session: sessionPath,
    queryInput: {
      text: {
        text: message,
        languageCode: "vi",
      },
    },
  };

  try {
    const responses = await sessionClient.detectIntent(request);
    const result = responses[0].queryResult.fulfillmentText;
    res.json({ response: result });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ error: "Something went wrong" });
  }
});

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
  return `${datePart}${randomPart}`;
}

app.post("/payment", async (req, res) => {
  const appTransId = generateAppTransId();
  const embed_data = {
    //sau khi hoàn tất thanh toán sẽ đi vào link này (thường là link web thanh toán thành công của mình)
    // redirecturl: `https://vticinema.web.app/payment-result?appTransId=${appTransId}`,
    redirecturl: `http://localhost:5173/payment-result?appTransId=${appTransId}`,
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
    // Khi thanh toán xong, zalopay server sẽ POST đến url này để thông báo cho server của mình
    //Chú ý: cần dùng ngrok để public url thì Zalopay Server mới call đến được
    callback_url: "https://81f0-2402-800-6344-e5b3-241b-be62-2d0c-272.ngrok-free.app/callback",
    // callback_url: "https://vticinema-zalopay-test.vercel.app/callback",
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

  try {
    // Kiểm tra và parse dữ liệu callback
    const dataStr = req.body.data;
    if (!dataStr) {
      console.error("Dữ liệu `data` không tồn tại!");
      return res.status(400).json({ error: "Dữ liệu `data` không tồn tại!" });
    }

    const reqMac = req.body.mac; // MAC từ ZaloPay
    const data = typeof dataStr === "string" ? JSON.parse(dataStr) : dataStr;
    const appTransId = data.app_trans_id; // Lấy app_trans_id từ data

    console.log("appTransId nhận được:", appTransId);

    // Kiểm tra key2
    if (!config.key2) {
      console.error("key2 không được cấu hình trong file .env!");
      return res.status(500).json({ error: "key2 không được cấu hình!" });
    }

    // Tạo MAC để xác thực
    const calculatedMac = CryptoJS.HmacSHA256(dataStr, config.key2).toString();
    console.log("MAC tính toán:", calculatedMac);
    console.log("MAC nhận từ ZaloPay:", reqMac);

    if (reqMac !== calculatedMac) {
      console.error("MAC không khớp!");
      return res.status(400).json({ error: "MAC không khớp!" });
    }

    const transactionTime = new Date().toLocaleString("vi-VN", {
      timeZone: "Asia/Ho_Chi_Minh",
    }); // Lưu ngày giờ theo múi giờ Việt Nam

    // Cập nhật trạng thái giao dịch trong Firebase
    const orderRef = db.ref(`Orders/${appTransId}`);
    await orderRef.update({
      status: "success",
      transactionTime: transactionTime, // Thêm ngày giờ giao dịch
      updatedAt: new Date().toISOString(),
    });
    console.log("Cập nhật trạng thái thành công cho giao dịch:", appTransId);

    // Lấy thông tin đơn hàng từ Firebase để gửi email
    const snapshot = await orderRef.once("value");
    if (!snapshot.exists()) {
      console.error("Không tìm thấy đơn hàng trong DB!");
      return res.status(404).json({ error: "Đơn hàng không tồn tại!" });
    }

    const orderData = snapshot.val();
    const email = orderData.app_user; // Email khách hàng
    const movieDetails = orderData.movieDetails;

    // Chuyển đổi ngày suất chiếu sang định dạng Việt Nam
    const formatDateVN = (dateString) => {
      const date = new Date(dateString);
      return date.toLocaleDateString("vi-VN"); // Định dạng "DD/MM/YYYY"
    };

    // Gửi email xác nhận đặt vé
    await sendBookingConfirmation(email, {
      customerName: orderData.app_user,
      movieTitle: movieDetails.movieName,
      cinema: movieDetails.theater,
      showday: formatDateVN(movieDetails.showDate),
      showtime: movieDetails.showTime,
      seats: movieDetails.seat,
      services:
        orderData.services?.map((s) => `${s.name} (${s.quantity} phần)`).join(", ") ||
        "Không có dịch vụ",
      price: orderData.amount,
      transactionId: appTransId, // Mã giao dịch
      transactionTime: orderData.transactionTime || "Không xác định", //Thời gian giao dịch
    });

    res.status(200).json({ return_code: 1, return_message: "success" });
  } catch (error) {
    console.error("Lỗi trong callback:", error.message);
    res.status(500).json({ return_code: 0, return_message: error.message });
  }
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
