
// Chuyển dữ liệu thô của sheet "Data tổng" thành mô hình cho dashboard.
// Các cột số liệu được nhận diện theo tiêu đề ở dòng 2.
// Bố cục mới:
// - Cần điều tiết
// - Đã điều tiết
// - Tồn kho hiện tại
// - Sử dụng theo SO
// - Đối chiếu tồn kho (thực tế sử dụng = SL VP đã trừ tồn)
// - SL còn lại cần trừ tồn

export const ITEMS = [
  { key: "at", label: "Áo thun" },
  { key: "bl", label: "Balo" },
  { key: "kd", label: "Khay đá" },
];

const ITEM_NAME = {
  at: "ao thun",
  bl: "balo",
  kd: "khay da",
};

const num = (v) => {
  if (v === "" || v === null || v === undefined) return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const has = (v) => v !== "" && v !== null && v !== undefined;
const str = (v) => (has(v) ? String(v).trim() : "");

// Bỏ dấu tiếng Việt, đưa về chữ thường để so khớp tiêu đề.
const norm = (s) =>
  String(s === null || s === undefined ? "" : s)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/đ/g, "d")
    .replace(/\s+/g, " ")
    .trim();

function colLetter(i) {
  let n = i + 1;
  let s = "";

  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }

  return s;
}

// Tiêu đề nhận diện từng nhóm dữ liệu.
// Fallback là vị trí mặc định của bố cục raw.json hiện tại.
const METRICS = {
  need: {
    fallback: 6,
    test: (s) =>
      s.includes("can dieu tiet") &&
      !s.includes("da nhan") &&
      !s.includes("con lai"),
  },

  done: {
    fallback: 9,
    test: (s) =>
      s.includes("da dieu tiet") &&
      !s.includes("da nhan"),
  },

  ton: {
    fallback: 12,
    test: (s) =>
      s.includes("ton kho") &&
      !s.includes("doi chieu") &&
      !s.includes("can tru"),
  },

  used: {
    fallback: 18,
    test: (s) =>
      s.includes("thuc te su dung"),
  },

  remaining: {
    fallback: 21,
    test: (s) =>
      s.includes("can tru ton"),
  },
};

function detectLayout(rawRows) {
  const h1 = (rawRows && rawRows[0]) || [];
  const h2 = (rawRows && rawRows[1]) || [];
  const width = Math.max(h1.length, h2.length, 24);

  // Lấy tên nhóm ở dòng 1, hỗ trợ cả tiêu đề được gộp ô.
  const groups = [];
  let cur = "";

  for (let c = 0; c < width; c++) {
    if (has(h1[c])) cur = norm(h1[c]);
    groups[c] = cur;
  }

  const sub = [];

  for (let c = 0; c < width; c++) {
    sub[c] = norm(h2[c]);
  }

  const layout = {};

  for (const name of Object.keys(METRICS)) {
    const metric = METRICS[name];
    const idx = {};
    let detected = true;

    ITEMS.forEach((it) => {
      const nameItem = ITEM_NAME[it.key];
      let found = -1;

      // Ưu tiên nhận diện trực tiếp trên tiêu đề dòng 2.
      for (let c = 0; c < width; c++) {
        if (
          sub[c].includes(nameItem) &&
          metric.test(sub[c])
        ) {
          found = c;
          break;
        }
      }

      // Nếu chưa tìm thấy, kiểm tra kết hợp tiêu đề nhóm và tiêu đề con.
      if (found < 0) {
        for (let c = 0; c < width; c++) {
          if (
            sub[c].includes(nameItem) &&
            metric.test(groups[c] + " " + sub[c])
          ) {
            found = c;
            break;
          }
        }
      }

      // Không tìm thấy tiêu đề thì dùng vị trí mặc định.
      if (found < 0) {
        found = metric.fallback + ITEMS.indexOf(it);
        detected = false;
      }

      idx[it.key] = found;
    });

    layout[name] = { idx, detected };
  }

  // Thông tin để hiển thị kiểm tra cột dữ liệu.
  const info = {};

  for (const name of Object.keys(layout)) {
    info[name] = {
      detected: layout[name].detected,
      cols: ITEMS.map((it) => ({
        item: it.label,
        letter: colLetter(layout[name].idx[it.key]),
        header: str(h2[layout[name].idx[it.key]]),
      })),
    };
  }

  return { layout, info };
}

const pick = (row, idx) => ({
  at: num(row[idx.at]),
  bl: num(row[idx.bl]),
  kd: num(row[idx.kd]),
});

const addTriple = (a, b) => ({
  at: a.at + b.at,
  bl: a.bl + b.bl,
  kd: a.kd + b.kd,
});

const zero = () => ({
  at: 0,
  bl: 0,
  kd: 0,
});

// Kiểm tra một nhóm cột đã có dữ liệu hay chưa.
// Số 0 vẫn được xem là dữ liệu hợp lệ.
function hasMetric(row, idx) {
  return ITEMS.some((it) => has(row[idx[it.key]]));
}

export function buildModel(rawRows) {
  const { layout, info } = detectLayout(rawRows);

  const L = {
    need: layout.need.idx,
    done: layout.done.idx,
    ton: layout.ton.idx,
    used: layout.used.idx,
    remaining: layout.remaining.idx,
  };

  const body = (rawRows || []).slice(2);
  const transfers = [];
  const recvMap = new Map();

  body.forEach((row, i) => {
    const maGive = str(row[0]);

    if (!maGive && !str(row[1])) return;

    const t = {
      id: i,
      maGive,
      tenGive: str(row[1]),
      maRecv: str(row[2]),
      tenRecv: str(row[3]),
      mien: str(row[4]),
      vung: str(row[5]),
      need: pick(row, L.need),
      done: pick(row, L.done),
    };

    transfers.push(t);

    if (!t.maRecv) return;

    let r = recvMap.get(t.maRecv);

    if (!r) {
      r = {
        ma: t.maRecv,
        ten: t.tenRecv,
        mien: t.mien,
        vung: t.vung,

        need: zero(),
        done: zero(),

        // Tồn kho hiện tại.
        ton: zero(),

        // SL VP đã trừ tồn = thực tế sử dụng.
        used: zero(),

        // SL còn lại cần trừ tồn: đọc trực tiếp từ sheet.
        remaining: zero(),

        hasTon: false,
        hasUsed: false,
        hasRemaining: false,
      };

      recvMap.set(t.maRecv, r);
    }

    // Cộng dồn số lượng cần và đã điều tiết của các NPP giao.
    r.need = addTriple(r.need, t.need);
    r.done = addTriple(r.done, t.done);

    // Các số liệu thuộc NPP nhận chỉ lấy một lần,
    // tại dòng đầu tiên có dữ liệu của từng nhóm.
    if (!r.hasTon && hasMetric(row, L.ton)) {
      r.hasTon = true;
      r.ton = pick(row, L.ton);
    }

    if (!r.hasUsed && hasMetric(row, L.used)) {
      r.hasUsed = true;
      r.used = pick(row, L.used);
    }

    if (!r.hasRemaining && hasMetric(row, L.remaining)) {
      r.hasRemaining = true;
      r.remaining = pick(row, L.remaining);
    }
  });

  const receivers = Array.from(recvMap.values());

  return {
    transfers,
    receivers,
    layout: info,
  };
}
