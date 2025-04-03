const express = require("express");
const router = express.Router();
const { db } = require("../firebase/firebaseConfig");

const CITY_SYNONYMS = {
  "TP.HCM": "Hồ Chí Minh",
  HCM: "Hồ Chí Minh",
  "Sài Gòn": "Hồ Chí Minh",
  HN: "Hà Nội",
  Hue: "Huế",
  "Thua Thien Hue": "Huế",
  "TT-Huế": "Huế",
  "TT Huế": "Huế",
};

// Bỏ dấu tiếng Việt
function normalizeText(text) {
  if (!text || typeof text !== "string") return "";
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

// chuẩn hoá tên Thành Phố
function normalizeCity(cityName) {
  const clean = cityName.trim().toLowerCase();
  const entry = Object.entries(CITY_SYNONYMS).find(([key]) => key.toLowerCase() === clean);
  return entry ? entry[1] : cityName;
}

// Lấy danh sách rạp theo thành phố
async function getCinemasByCity(cityName) {
  const snapshot = await db.ref("Cinema").once("value");
  const data = snapshot.val();

  const targetCity = normalizeCity(cityName).toLowerCase();

  const cinemas = Object.values(data || {}).filter((cinema) => {
    return cinema.city && cinema.city.toLowerCase() === targetCity;
  });
  return cinemas.map((c) => c.cinema_name).join(", ");
}

// Lấy thông tin chi tiết rạp
async function getCinemaDetailByName(name) {
  const snapshot = await db.ref("Cinema").once("value");
  const data = snapshot.val();
  const cinema = Object.values(data || {}).find((c) =>
    c.cinema_name.toLowerCase().includes(name.toLowerCase())
  );

  if (!cinema) return null;

  return `${cinema.cinema_name}\n📍 Địa chỉ: ${cinema.location}\n 📞 SĐT: ${cinema.phone_number}\n 🕗 Giờ mở cửa: ${cinema.opening_hours}`;
}

// LẤY DANH SÁCH KHUYẾN MÃI
async function getAllPromotions() {
  const snapshot = await db.ref("Promotions").once("value");
  const data = snapshot.val();

  if (!data) return "Hiện tại chưa có khuyến mãi nào.";

  let result = "🎁 Các khuyến mãi đang áp dụng:\n\n";

  Object.values(data).forEach((promo) => {
    result += `🔸 ${promo.title}\n`;
    result += `📅 Từ ${promo.startDate} đến ${promo.endDate}\n`;
    result += `📝 ${promo.description}\n\n`;
  });

  return result.trim();
}

// Lấy thông tin phim theo tên
async function getMovieDetailByTitle(title) {
  console.log(">>> title from Dialogflow:", title);

  const snapshot = await db.ref("Movies").once("value");
  const data = snapshot.val();

  if (!data) return null;

  const input = normalizeText(title);

  const movie = Object.values(data).find((m) => normalizeText(m.movie_name) === input);

  if (!movie) return null;

  return `🎬 ${movie.movie_name} (${movie.genre})\n🧑 Diễn viên: ${movie.actor}\n🎞 Đạo diễn: ${movie.director}\n🕐 Thời lượng: ${movie.duration} phút\n📅 Khởi chiếu: ${movie.release_date}\n📌 Tóm tắt: ${movie.description}`;
}

// Gợi ý phim đang chiếu
async function getActiveMovies() {
  const snapshot = await db.ref("Movies").once("value");
  const data = snapshot.val();

  if (!data) return "Hiện tại chưa có phim nào.";

  const activeMovies = Object.values(data).filter((m) => m.status?.toLowerCase() === "active");

  if (activeMovies.length === 0) return "Hiện tại chưa có phim nào đang chiếu.";

  let result = "🎬 Các phim đang chiếu hôm nay:\n\n";

  activeMovies.forEach((movie) => {
    result += `🔹 ${movie.movie_name} (${movie.genre})\n`;
  });

  return result.trim();
}

// Lấy danh sách phim sắp chiếu
async function getUpcomingMovies() {
  const snapshot = await db.ref("Movies").once("value");
  const data = snapshot.val();

  if (!data) return "Hiện tại chưa có dữ liệu phim.";

  const upcoming = Object.values(data).filter(
    (movie) => movie.status?.toLowerCase() === "upcoming"
  );

  if (upcoming.length === 0) return "Hiện tại chưa có phim nào sắp chiếu.";

  let result = "🎬 Các phim sắp chiếu:\n\n";
  upcoming.forEach((movie) => {
    result += `🔹 ${movie.movie_name}`;
    if (movie.release_date) {
      result += ` (Khởi chiếu: ${movie.release_date})`;
    }
    result += `\n`;
  });

  return result.trim();
}

// Lấy danh sách phim đang chiếu theo thể loại
async function getMoviesByGenre(genreInput) {
  const snapshot = await db.ref("Movies").once("value");
  const data = snapshot.val();
  if (!data) return "Hiện tại chưa có dữ liệu phim.";
  console.log(">>> genreInput:", genreInput);

  const target = normalizeText(genreInput);

  const matched = Object.values(data).filter((movie) => {
    if (!movie?.genre || movie.status?.toLowerCase() !== "active") return false;

    const genres = movie.genre.split(",").map((g) => normalizeText(g));
    return genres.includes(target);
  });

  if (matched.length === 0)
    return `Hiện tại chưa có phim đang chiếu nào thuộc thể loại ${genreInput}.`;

  let result = `🎬 Phim thể loại "${genreInput}" đang chiếu:\n\n`;
  matched.forEach((movie) => {
    result += `🔹 ${movie.movie_name}\n`;
  });

  return result.trim();
}

// Lấy danh sách phim theo độ tuổi xem phù hợp
async function getMoviesByViewingAge(ageCode) {
  const snapshot = await db.ref("Movies").once("value");
  const data = snapshot.val();

  if (!data) return "Hiện tại chưa có dữ liệu phim.";

  const matched = Object.values(data).filter((movie) => {
    return (
      // movie.status?.toLowerCase() === "active" &&
      movie.viewing_age?.toString() === ageCode.toString()
    );
  });

  if (matched.length === 0) {
    return `Hiện tại chưa có phim nào thuộc độ tuổi "${ageCode}".`;
  }

  let result = `🎬 Phim dành cho độ tuổi "${ageCode}":\n\n`;
  matched.forEach((movie) => {
    result += `🔹 ${movie.movie_name}\n`;
  });

  return result.trim();
}

// Lấy danh sách phim theo diễn viên
async function getMoviesByActor(actorName) {
  const snapshot = await db.ref("Movies").once("value");
  const data = snapshot.val();
  if (!data) return "Hiện tại chưa có dữ liệu phim.";

  const matched = Object.values(data).filter((movie) =>
    // movie.status?.toLowerCase() === "active" &&
    movie.actor?.toLowerCase().includes(actorName.toLowerCase())
  );

  if (matched.length === 0) return `Không tìm thấy phim nào có diễn viên "${actorName}".`;

  let result = `🎬 Các phim có diễn viên "${actorName}":\n\n`;
  matched.forEach((movie) => {
    result += `🔹 ${movie.movie_name}\n`;
  });

  return result.trim();
}

// Lấy danh sách phim theo đạo diễn
async function getMoviesByDirector(directorName) {
  const snapshot = await db.ref("Movies").once("value");
  const data = snapshot.val();
  if (!data) return "Hiện tại chưa có dữ liệu phim.";

  const matched = Object.values(data).filter((movie) =>
    // movie.status?.toLowerCase() === "active" &&
    movie.director?.toLowerCase().includes(directorName.toLowerCase())
  );

  if (matched.length === 0) return `Không tìm thấy phim nào của đạo diễn "${directorName}".`;

  let result = `🎬 Phim của đạo diễn "${directorName}":\n\n`;
  matched.forEach((movie) => {
    result += `🔹 ${movie.movie_name}\n`;
  });

  return result.trim();
}

// Tìm rạp gần nhất
const haversineDistance = (lat1, lon1, lat2, lon2) => {
  const toRad = (x) => (x * Math.PI) / 180;
  const R = 6371; // km

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

async function getNearestCinema(userLat, userLon) {
  const snapshot = await db.ref("Cinema").once("value");
  const cinemas = snapshot.val();
  if (!cinemas) return "Hiện tại chưa có dữ liệu rạp.";

  let nearest = null;
  let minDistance = Infinity;

  Object.values(cinemas).forEach((cinema) => {
    const dist = haversineDistance(userLat, userLon, cinema.latitude, cinema.longitude);
    if (dist < minDistance) {
      minDistance = dist;
      nearest = cinema;
    }
  });

  if (!nearest) return "Không tìm thấy rạp nào gần bạn.";

  return `🎬 Rạp gần bạn nhất là:\n📍 ${nearest.cinema_name}\n📌 Địa chỉ: ${nearest.location}\n📞 SĐT: ${nearest.phone_number}\n🌐 Website: ${nearest.website}`;
}

//API CHÍNH
router.post("/", async (req, res) => {
  const { queryResult } = req.body || {};

  if (!queryResult || !queryResult.intent || !queryResult.parameters) {
    return res.status(400).json({ error: "Invalid Dialogflow webhook request" });
  }

  const intentName = queryResult.intent.displayName;
  const params = queryResult.parameters;
  let responseText = "";

  try {
    switch (intentName) {
      // Danh sách rạp theo thành phố
      case "DanhSachRapTheoThanhPho":
        const city = params["thanhpho"];
        const list = await getCinemasByCity(city);
        responseText = list
          ? `📍 Các rạp ở ${city}: ${list}`
          : `Mình không tìm thấy rạp nào ở ${city}`;
        break;

      // Thông tin Rạp
      case "ThongTinRap":
        const name = params["tenrap"];
        const detail = await getCinemaDetailByName(name);
        responseText = detail || `Không tìm thấy thông tin rạp ${name}`;
        break;

      // Tìm rạp gần nhất
      case "RapGanNhat":
        let userLat, userLon;

        // Nếu gọi từ FE trực tiếp
        if (req.body.location) {
          // console.log("📍 FE gửi location:", req.body.location);
          userLat = parseFloat(req.body.location.latitude);
          userLon = parseFloat(req.body.location.longitude);
        } else {
          // Nếu gọi từ Dialogflow (qua queryResult.parameters)
          const loc = params["location"] || {};
          // console.log("📍 Dialogflow gửi location:", loc);
          userLat = parseFloat(loc.latitude);
          userLon = parseFloat(loc.longitude);
        }

        if (!userLat || !userLon) {
          responseText = `Mình không lấy được vị trí của bạn. Hãy thử "Rạp chiếu ở..." (nơi bạn đang ở)`;
        } else {
          responseText = await getNearestCinema(userLat, userLon);
        }

        break;

      // Giờ mở của rạp
      case "GioMoCuaRap":
        const detailRap = await getCinemaDetailByName(params["tenrap"]);
        responseText = detailRap
          ? `${params["tenrap"]} mở cửa lúc ${detailRap.match(/🕗 Giờ mở cửa: (.+)/)?.[1]}`
          : `Mình không tìm thấy rạp ${params["tenrap"]}`;
        break;

      // Khuyến mãi
      case "KhuyenMai":
        responseText = await getAllPromotions();
        break;

      // Chi tiết phim
      case "ThongTinPhim":
        const movieName = params["movie_title"];
        const movieDetail = await getMovieDetailByTitle(movieName);
        responseText = movieDetail || `Mình không tìm thấy thông tin về phim ${movieName}.`;
        break;

      // Gợi ý phim đang chiếu
      case "PhimDangChieu":
        responseText = await getActiveMovies();
        break;
      // Phim sắp chiếu
      case "PhimSapChieu":
        responseText = await getUpcomingMovies();
        break;

      // Phim đang chiếu theo thể loại
      case "PhimTheoTheLoai":
        const genre = params["genre"];
        responseText = await getMoviesByGenre(genre);
        break;

      // Phim theo độ tuổi xem phù hợp
      case "PhimTheoDoTuoi":
        const ageCode = params["age"];
        responseText = await getMoviesByViewingAge(ageCode);
        break;

      // Phim theo diễn viên
      case "PhimTheoDienVien":
        const actor = params["actor"];
        responseText = await getMoviesByActor(actor);
        break;

      // Phim theo đạo diễn
      case "PhimTheoDaoDien":
        const director = params["director"];
        responseText = await getMoviesByDirector(director);
        break;

      default:
        responseText = "Xin lỗi, mình chưa hỗ trợ yêu cầu này.";
    }

    if (queryResult) {
      return res.json({ fulfillmentText: responseText });
    } else {
      return res.json({ response: responseText });
    }
  } catch (error) {
    console.error(" Lỗi webhook:", error);
    responseText = "Đã xảy ra lỗi khi xử lý yêu cầu.";
  }

  res.json({ fulfillmentText: responseText });
});

module.exports = router;
