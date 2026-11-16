// Chuyển dữ liệu thô của sheet "Data tổng" (mảng các dòng, 24 cột A..X)
// thành mô hình dùng cho dashboard.
// Cột (0-based): 0 Mã NPP giao | 1 Tên NPP giao | 2 Mã NPP nhận | 3 Tên NPP nhận | 4 Miền | 5 Vùng
//   6-8   cần điều tiết (Áo thun, Balo, Khay đá)
//   9-11  đã điều tiết
//   12-14 tồn kho hiện tại (chỉ ở dòng đầu của mỗi NPP nhận)
//   15-17 SL đã sử dụng (theo SO)
//   18-20 đối chiếu tồn kho = thực tế sử dụng
//   21-23 SL còn lại cần trừ tồn

export const ITEMS = [
  { key: "at", label: "Áo thun" },
  { key: "bl", label: "Balo" },
  { key: "kd", label: "Khay đá" },
];

// Đơn giá (VND) lấy từ sheet "back up" (ô D2:F2). Sửa ở đây nếu giá đổi.
export const PRICE = { at: 27000, bl: 56000, kd: 19000 };

const num = (v) => {
  if (v === "" || v === null || v === undefined) return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const has = (v) => v !== "" && v !== null && v !== undefined;
const str = (v) => (has(v) ? String(v).trim() : "");
const triple = (row, from) => ({
  at: num(row[from]),
  bl: num(row[from + 1]),
  kd: num(row[from + 2]),
});
const addTriple = (a, b) => ({ at: a.at + b.at, bl: a.bl + b.bl, kd: a.kd + b.kd });
const zero = () => ({ at: 0, bl: 0, kd: 0 });

export function buildModel(rawRows) {
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
      need: triple(row, 6),
      done: triple(row, 9),
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
        sd: zero(),
        tt: zero(),
        truSheet: zero(),
        hasStock: false,
      };
      recvMap.set(t.maRecv, r);
    }
    r.need = addTriple(r.need, t.need);
    r.done = addTriple(r.done, t.done);
    // Dòng "đầu tiên" của NPP nhận mới có số tồn kho / sử dụng
    if (!r.hasStock && has(row[15])) {
      r.hasStock = true;
      r.ton = triple(row, 12);
      r.sd = triple(row, 15);
      r.tt = triple(row, 18);
      r.truSheet = triple(row, 21);
    }
  });

  const receivers = Array.from(recvMap.values());
  return { transfers, receivers };
}
