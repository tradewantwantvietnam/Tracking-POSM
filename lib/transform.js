// Chuyển dữ liệu thô của sheet "Data tổng" (mảng các dòng) thành mô hình cho dashboard.
// Cột cố định (0-based): 0 Mã NPP giao | 1 Tên NPP giao | 2 Mã NPP nhận | 3 Tên NPP nhận | 4 Miền | 5 Vùng
// Các cột số liệu (cần điều tiết / đã điều tiết / tồn kho hiện tại) được TÌM THEO TIÊU ĐỀ ở dòng 2,
// nên nếu bạn chèn thêm cột vào sheet thì dashboard vẫn đọc đúng.

export const ITEMS = [
  { key: "at", label: "Áo thun" },
  { key: "bl", label: "Balo" },
  { key: "kd", label: "Khay đá" },
];

const ITEM_NAME = { at: "ao thun", bl: "balo", kd: "khay da" };

const num = (v) => {
  if (v === "" || v === null || v === undefined) return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const has = (v) => v !== "" && v !== null && v !== undefined;
const str = (v) => (has(v) ? String(v).trim() : "");

// bỏ dấu tiếng Việt, về chữ thường để so khớp tiêu đề
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

// Mỗi số liệu: cách nhận diện tiêu đề + vị trí mặc định (bố cục cũ) nếu không tìm thấy
const METRICS = {
  need: {
    fallback: 6,
    test: (s) => s.includes("can dieu tiet") && !s.includes("da nhan") && !s.includes("con lai"),
  },
  done: {
    fallback: 9,
    test: (s) => s.includes("da dieu tiet") && !s.includes("da nhan"),
  },
  ton: {
    fallback: 12,
    test: (s) =>
      (s.includes("ton kho") || s.includes("ton hien tai")) &&
      !s.includes("doi chieu") &&
      !s.includes("can tru"),
  },
};

function detectLayout(rawRows) {
  const h1 = (rawRows && rawRows[0]) || [];
  const h2 = (rawRows && rawRows[1]) || [];
  const width = Math.max(h1.length, h2.length, 24);

  const groups = [];
  let cur = "";
  for (let c = 0; c < width; c++) {
    if (has(h1[c])) cur = norm(h1[c]);
    groups[c] = cur;
  }
  const sub = [];
  for (let c = 0; c < width; c++) sub[c] = norm(h2[c]);

  const layout = {};
  for (const name of Object.keys(METRICS)) {
    const m = METRICS[name];
    const idx = {};
    let detected = true;
    ITEMS.forEach((it, k) => {
      const nameItem = ITEM_NAME[it.key];
      let found = -1;
      for (let c = 0; c < width; c++) {
        if (sub[c].includes(nameItem) && m.test(sub[c])) {
          found = c;
          break;
        }
      }
      if (found < 0) {
        for (let c = 0; c < width; c++) {
          if (sub[c].includes(nameItem) && m.test(groups[c] + " " + sub[c])) {
            found = c;
            break;
          }
        }
      }
      if (found < 0) {
        found = m.fallback + k;
        detected = false;
      }
      idx[it.key] = found;
    });
    layout[name] = { idx, detected };
  }

  // thông tin để hiển thị kiểm tra
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
const addTriple = (a, b) => ({ at: a.at + b.at, bl: a.bl + b.bl, kd: a.kd + b.kd });
const zero = () => ({ at: 0, bl: 0, kd: 0 });

export function buildModel(rawRows) {
  const { layout, info } = detectLayout(rawRows);
  const L = { need: layout.need.idx, done: layout.done.idx, ton: layout.ton.idx };

  const body = (rawRows || []).slice(2); // bỏ 2 dòng tiêu đề
  const transfers = [];
  const recvMap = new Map();

  body.forEach((row, i) => {
    const maGive = str(row[0]);
    if (!maGive && !str(row[1])) return; // dòng trống

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

    if (!t.maRecv) return; // chưa có NPP nhận
    let r = recvMap.get(t.maRecv);
    if (!r) {
      r = {
        ma: t.maRecv,
        ten: t.tenRecv,
        mien: t.mien,
        vung: t.vung,
        need: zero(),
        done: zero(),
        ton: zero(),
        hasStock: false,
      };
      recvMap.set(t.maRecv, r);
    }
    r.need = addTriple(r.need, t.need);
    r.done = addTriple(r.done, t.done);
    // Dòng đầu tiên của NPP nhận mới có số tồn kho hiện tại
    if (!r.hasStock && (has(row[L.ton.at]) || has(row[L.ton.bl]) || has(row[L.ton.kd]))) {
      r.hasStock = true;
      r.ton = pick(row, L.ton);
    }
  });

  const receivers = Array.from(recvMap.values());
  return { transfers, receivers, layout: info };
}
