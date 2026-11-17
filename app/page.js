"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  ResponsiveContainer,
} from "recharts";
import { ITEMS, PRICE, WEIGHT } from "../lib/transform";

const COLORS = {
  done: "#22a06b",
  ded: "#2f6fed",
  rem: "#f0a020",
  over: "#e5484d",
};

// ---------- tiện ích ----------
// Hệ số nhân theo chế độ xem: Số lượng = 1, Quy đổi = balo 2, Giá trị = đơn giá
const weightOf = (k, metric) => (metric === "value" ? PRICE[k] : metric === "conv" ? WEIGHT[k] : 1);

const keysOf = (item) => (item === "all" ? ITEMS.map((i) => i.key) : [item]);

function fmt(n, metric) {
  const v = Number(n) || 0;
  if (metric === "value") {
    const a = Math.abs(v);
    if (a >= 1e9) return (v / 1e9).toLocaleString("vi-VN", { maximumFractionDigits: 2 }) + " tỷ";
    if (a >= 1e6) return (v / 1e6).toLocaleString("vi-VN", { maximumFractionDigits: 1 }) + " tr";
    return v.toLocaleString("vi-VN");
  }
  return v.toLocaleString("vi-VN", { maximumFractionDigits: 0 });
}

const pctOf = (a, b) => (b > 0 ? (a / b) * 100 : 0);
const fmtPct = (p) => (Number.isFinite(p) ? p.toLocaleString("vi-VN", { maximumFractionDigits: 1 }) + "%" : "0%");

function shortName(s, max = 26) {
  const t = String(s || "")
    .replace(/^CÔNG TY (TRÁCH NHIỆM HỮU HẠN|TNHH|CỔ PHẦN|CP)\s*/i, "")
    .replace(/^(MỘT THÀNH VIÊN|MTV|1TV)\s*/i, "")
    .replace(/^DOANH NGHIỆP TƯ NHÂN\s*/i, "DNTN ")
    .trim();
  return t.length > max ? t.slice(0, max - 1) + "…" : t;
}

// Tính cho 1 dòng điều tiết (NPP giao -> NPP nhận)
function transCalc(t, item, metric) {
  let need = 0;
  let done = 0;
  for (const k of keysOf(item)) {
    const w = weightOf(k, metric);
    need += t.need[k] * w;
    done += t.done[k] * w;
  }
  return { need, done, rem: Math.max(need - done, 0) };
}

// Tính cho 1 NPP nhận (trừ tồn). Cắt giới hạn theo từng mặt hàng trước khi cộng.
function recvCalc(r, item, metric) {
  let need = 0, ded = 0, rem = 0, over = 0, ton = 0, sd = 0, tt = 0;
  for (const k of keysOf(item)) {
    const w = weightOf(k, metric);
    const n = r.need[k];
    const t = r.tt[k];
    need += n * w;
    ded += Math.min(t, n) * w;
    rem += Math.max(n - t, 0) * w;
    over += Math.max(t - n, 0) * w;
    ton += r.ton[k] * w;
    sd += r.sd[k] * w;
    tt += t * w;
  }
  return { need, ded, rem, over, ton, sd, tt };
}

function groupSum(list, keyFn, calcFn, fields) {
  const m = new Map();
  for (const x of list) {
    const key = keyFn(x) || "(chưa rõ)";
    const c = calcFn(x);
    if (!m.has(key)) {
      const base = { name: key };
      fields.forEach((f) => (base[f] = 0));
      m.set(key, base);
    }
    const g = m.get(key);
    fields.forEach((f) => (g[f] += c[f]));
  }
  return Array.from(m.values());
}

// ---------- thành phần nhỏ ----------
function Tip({ active, payload, label, metric, needKey }) {
  if (!active || !payload || !payload.length) return null;
  const row = payload[0].payload;
  const need = row[needKey] || 0;
  return (
    <div style={{ background: "#fff", border: "1px solid #e3e8ef", borderRadius: 8, padding: "8px 10px", fontSize: 12 }}>
      <div style={{ fontWeight: 700, marginBottom: 4 }}>{row.full || label}</div>
      {payload.map((p) => (
        <div key={p.dataKey} style={{ color: p.color }}>
          {p.name}: <b>{fmt(p.value, metric)}</b>
        </div>
      ))}
      <div style={{ marginTop: 4, color: "#6b7686" }}>Tổng cần: {fmt(need, metric)}</div>
    </div>
  );
}

function StackChart({ data, series, metric, needKey, height }) {
  if (!data.length) return <div className="empty">Không có dữ liệu</div>;
  const h = height || Math.max(180, data.length * 30 + 70);
  return (
    <ResponsiveContainer width="100%" height={h}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, left: 4, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e3e8ef" />
        <XAxis type="number" tickFormatter={(v) => fmt(v, metric)} fontSize={11} />
        <YAxis type="category" dataKey="name" width={150} fontSize={11} interval={0} />
        <Tooltip content={<Tip metric={metric} needKey={needKey} />} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        {series.map((s) => (
          <Bar key={s.key} dataKey={s.key} name={s.name} stackId="a" fill={s.color} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

function MiniBars({ rows }) {
  return (
    <div className="mini">
      {rows.map((r) => (
        <div className="r" key={r.label}>
          <span>{r.label}</span>
          <div className={"bar " + (r.blue ? "blue" : "")}>
            <i style={{ width: Math.min(100, r.pct) + "%" }} />
          </div>
          <b>{fmtPct(r.pct)}</b>
        </div>
      ))}
    </div>
  );
}

function Badge({ kind }) {
  const map = {
    done: ["b-done", "Hoàn tất"],
    part: ["b-part", "Một phần"],
    none: ["b-none", "Chưa làm"],
    over: ["b-over", "Trừ dư"],
  };
  const [cls, text] = map[kind];
  return <span className={"badge " + cls}>{text}</span>;
}

// ---------- trang chính ----------
export default function Page() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [mien, setMien] = useState("all");
  const [vung, setVung] = useState("all");
  const [item, setItem] = useState("all");
  const [metric, setMetric] = useState("qty");
  const [tab, setTab] = useState("dt");
  const [q, setQ] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setErr("");
    try {
      const res = await fetch("/api/data", { cache: "no-store" });
      if (!res.ok) throw new Error("HTTP " + res.status);
      setData(await res.json());
    } catch (e) {
      setErr(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const transfers = data ? data.transfers : [];
  const receivers = data ? data.receivers : [];

  const mienOptions = useMemo(
    () => Array.from(new Set([...transfers.map((t) => t.mien), ...receivers.map((r) => r.mien)].filter(Boolean))).sort(),
    [transfers, receivers]
  );
  const vungOptions = useMemo(
    () =>
      Array.from(
        new Set(
          [...transfers, ...receivers]
            .filter((x) => mien === "all" || x.mien === mien)
            .map((x) => x.vung)
            .filter(Boolean)
        )
      ).sort(),
    [transfers, receivers, mien]
  );

  const fT = useMemo(
    () => transfers.filter((t) => (mien === "all" || t.mien === mien) && (vung === "all" || t.vung === vung)),
    [transfers, mien, vung]
  );
  const fR = useMemo(
    () => receivers.filter((r) => (mien === "all" || r.mien === mien) && (vung === "all" || r.vung === vung)),
    [receivers, mien, vung]
  );

  const groupBy = mien === "all" ? "mien" : "vung";
  const groupLabel = mien === "all" ? "Miền" : "Vùng";

  // ----- tính toán điều tiết -----
  const dt = useMemo(() => {
    const calc = (t) => transCalc(t, item, metric);
    const total = fT.reduce(
      (a, t) => {
        const c = calc(t);
        a.need += c.need;
        a.done += c.done;
        a.rem += c.rem;
        return a;
      },
      { need: 0, done: 0, rem: 0 }
    );
    const byGroup = groupSum(fT, (t) => t[groupBy], calc, ["need", "done", "rem"]);
    const rows = fT.map((t) => ({ t, c: calc(t) }));
    const perItem = ITEMS.map((i) => {
      const n = fT.reduce((s, t) => s + t.need[i.key], 0);
      const d = fT.reduce((s, t) => s + t.done[i.key], 0);
      return { label: i.label, pct: pctOf(d, n) };
    });
    const pending = rows.filter((x) => x.c.rem > 0).length;
    const noRecv = fT.filter((t) => !t.maRecv).length;
    return { total, byGroup, rows, perItem, pending, noRecv };
  }, [fT, item, metric, groupBy]);

  // ----- tính toán trừ tồn -----
  const tt = useMemo(() => {
    const calc = (r) => recvCalc(r, item, metric);
    const total = fR.reduce(
      (a, r) => {
        const c = calc(r);
        a.need += c.need;
        a.ded += c.ded;
        a.rem += c.rem;
        a.over += c.over;
        return a;
      },
      { need: 0, ded: 0, rem: 0, over: 0 }
    );
    const byGroup = groupSum(fR, (r) => r[groupBy], calc, ["need", "ded", "rem", "over"]);
    const rows = fR.map((r) => ({ r, c: calc(r) }));
    const perItem = ITEMS.map((i) => {
      const n = fR.reduce((s, r) => s + r.need[i.key], 0);
      const d = fR.reduce((s, r) => s + Math.min(r.tt[i.key], r.need[i.key]), 0);
      return { label: i.label, pct: pctOf(d, n), blue: true };
    });
    const pending = rows.filter((x) => x.c.rem > 0).length;
    const overCount = rows.filter((x) => x.c.over > 0).length;
    return { total, byGroup, rows, perItem, pending, overCount };
  }, [fR, item, metric, groupBy]);

  const topDT = useMemo(
    () =>
      dt.rows
        .filter((x) => x.c.rem > 0)
        .sort((a, b) => b.c.rem - a.c.rem)
        .slice(0, 12)
        .map((x) => ({
          name: shortName(x.t.tenGive),
          full: x.t.tenGive + " → " + (x.t.tenRecv ? shortName(x.t.tenRecv, 30) : "chưa có NPP nhận"),
          need: x.c.need,
          done: x.c.done,
          rem: x.c.rem,
        })),
    [dt.rows]
  );

  const topTT = useMemo(
    () =>
      tt.rows
        .filter((x) => x.c.rem > 0 || x.c.over > 0)
        .sort((a, b) => b.c.rem + b.c.over - (a.c.rem + a.c.over))
        .slice(0, 12)
        .map((x) => ({
          name: shortName(x.r.ten),
          full: x.r.ten + " (" + x.r.ma + ")",
          need: x.c.need,
          ded: x.c.ded,
          rem: x.c.rem,
          over: x.c.over,
        })),
    [tt.rows]
  );

  const needle = q.trim().toLowerCase();
  const dtTable = useMemo(
    () =>
      dt.rows
        .filter(
          (x) =>
            !needle ||
            [x.t.tenGive, x.t.maGive, x.t.tenRecv, x.t.maRecv].join(" ").toLowerCase().includes(needle)
        )
        .sort((a, b) => b.c.rem - a.c.rem),
    [dt.rows, needle]
  );
  const ttTable = useMemo(
    () =>
      tt.rows
        .filter((x) => !needle || [x.r.ten, x.r.ma].join(" ").toLowerCase().includes(needle))
        .sort((a, b) => b.c.rem + b.c.over - (a.c.rem + a.c.over)),
    [tt.rows, needle]
  );

  const itemLabel = item === "all" ? "Tất cả mặt hàng" : ITEMS.find((i) => i.key === item).label;
  const unit = metric === "value" ? "VND" : metric === "conv" ? "điểm quy đổi" : "cái";

  return (
    <div className="wrap">
      <div className="top">
        <div>
          <h1>Tracking điều tiết POSM &amp; trừ tồn kho</h1>
          <div className="sub">
            {loading && !data ? "Đang tải dữ liệu…" : null}
            {data
              ? "Nguồn: " +
                (data.source === "sheet" ? "Google Sheet" : "file data/raw.json") +
                (data.updatedAt ? " · cập nhật " + new Date(data.updatedAt).toLocaleString("vi-VN") : "")
              : null}
          </div>
        </div>
        <div className="controls">
          <select value={mien} onChange={(e) => { setMien(e.target.value); setVung("all"); }}>
            <option value="all">Tất cả Miền</option>
            {mienOptions.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
          <select value={vung} onChange={(e) => setVung(e.target.value)}>
            <option value="all">Tất cả Vùng</option>
            {vungOptions.map((v) => (
              <option key={v} value={v}>{v}</option>
            ))}
          </select>
          <select value={item} onChange={(e) => setItem(e.target.value)}>
            <option value="all">Tất cả mặt hàng</option>
            {ITEMS.map((i) => (
              <option key={i.key} value={i.key}>{i.label}</option>
            ))}
          </select>
          <div className="seg">
            <button className={metric === "qty" ? "on" : ""} onClick={() => setMetric("qty")}>Số lượng</button>
            <button className={metric === "conv" ? "on" : ""} onClick={() => setMetric("conv")} title="Balo = 2, Áo thun = 1, Khay đá = 1">Quy đổi</button>
            <button className={metric === "value" ? "on" : ""} onClick={() => setMetric("value")}>Giá trị</button>
          </div>
          <button onClick={load} disabled={loading}>{loading ? "Đang tải…" : "Làm mới"}</button>
        </div>
      </div>

      {err ? <div className="warn">Lỗi tải dữ liệu: {err}</div> : null}
      {data && data.warning ? (
        <div className="warn">
          {data.warning}. Dashboard đang tạm dùng dữ liệu trong file data/raw.json.
        </div>
      ) : null}

      {data ? (
        <>
          <div className="grid kpis">
            <div className="card kpi">
              <div className="label">Tiến độ điều tiết · {itemLabel}</div>
              <div className="big">{fmtPct(pctOf(dt.total.done, dt.total.need))}</div>
              <div className="bar"><i style={{ width: Math.min(100, pctOf(dt.total.done, dt.total.need)) + "%" }} /></div>
              <div className="line2">
                Đã {fmt(dt.total.done, metric)} / cần {fmt(dt.total.need, metric)} {unit}
              </div>
              <MiniBars rows={dt.perItem} />
            </div>

            <div className="card kpi">
              <div className="label">Tiến độ trừ tồn · {itemLabel}</div>
              <div className="big">{fmtPct(pctOf(tt.total.ded, tt.total.need))}</div>
              <div className="bar blue"><i style={{ width: Math.min(100, pctOf(tt.total.ded, tt.total.need)) + "%" }} /></div>
              <div className="line2">
                Đã {fmt(tt.total.ded, metric)} / cần {fmt(tt.total.need, metric)} {unit}
              </div>
              <MiniBars rows={tt.perItem} />
            </div>

            <div className="card kpi">
              <div className="label">Còn lại cần điều tiết</div>
              <div className="big">{fmt(dt.total.rem, metric)}</div>
              <div className="line2">{unit} · {dt.pending} dòng điều tiết chưa xong</div>
              {dt.noRecv > 0 ? (
                <div className="line2">{dt.noRecv} dòng chưa có NPP nhận điều tiết</div>
              ) : null}
            </div>

            <div className="card kpi">
              <div className="label">Còn lại cần trừ tồn</div>
              <div className="big">{fmt(tt.total.rem, metric)}</div>
              <div className="line2">{unit} · {tt.pending}/{tt.rows.length} NPP nhận chưa trừ xong</div>
              {tt.overCount > 0 ? (
                <div className="line2" style={{ color: "#e5484d" }}>
                  {tt.overCount} NPP trừ dư, tổng dư {fmt(tt.total.over, metric)} {unit}
                </div>
              ) : null}
            </div>
          </div>

          <div className="grid charts">
            <div className="card">
              <h3>Tiến độ điều tiết theo {groupLabel}</h3>
              <div className="hint">Đã điều tiết vs còn lại · {itemLabel} · đơn vị: {unit}</div>
              <StackChart
                data={dt.byGroup}
                needKey="need"
                metric={metric}
                series={[
                  { key: "done", name: "Đã điều tiết", color: COLORS.done },
                  { key: "rem", name: "Còn lại", color: COLORS.rem },
                ]}
              />
            </div>

            <div className="card">
              <h3>Tiến độ trừ tồn theo {groupLabel}</h3>
              <div className="hint">Đã trừ vs còn lại cần trừ (đỏ = trừ dư) · {itemLabel} · đơn vị: {unit}</div>
              <StackChart
                data={tt.byGroup}
                needKey="need"
                metric={metric}
                series={[
                  { key: "ded", name: "Đã trừ", color: COLORS.ded },
                  { key: "rem", name: "Còn lại cần trừ", color: COLORS.rem },
                  { key: "over", name: "Trừ dư", color: COLORS.over },
                ]}
              />
            </div>

            <div className="card">
              <h3>Top dòng điều tiết còn thiếu nhiều nhất</h3>
              <div className="hint">NPP thực hiện điều tiết · 12 dòng đầu · di chuột để xem NPP nhận</div>
              <StackChart
                data={topDT}
                needKey="need"
                metric={metric}
                series={[
                  { key: "done", name: "Đã điều tiết", color: COLORS.done },
                  { key: "rem", name: "Còn lại", color: COLORS.rem },
                ]}
              />
            </div>

            <div className="card">
              <h3>Top NPP nhận còn phải trừ tồn nhiều nhất</h3>
              <div className="hint">12 NPP đầu · đơn vị: {unit}</div>
              <StackChart
                data={topTT}
                needKey="need"
                metric={metric}
                series={[
                  { key: "ded", name: "Đã trừ", color: COLORS.ded },
                  { key: "rem", name: "Còn lại cần trừ", color: COLORS.rem },
                  { key: "over", name: "Trừ dư", color: COLORS.over },
                ]}
              />
            </div>
          </div>

          <div className="card">
            <div className="tabhead">
              <div className="seg">
                <button className={tab === "dt" ? "on" : ""} onClick={() => setTab("dt")}>Chi tiết điều tiết</button>
                <button className={tab === "tt" ? "on" : ""} onClick={() => setTab("tt")}>Chi tiết trừ tồn (NPP nhận)</button>
              </div>
              <input
                type="text"
                placeholder="Tìm tên hoặc mã NPP…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>
            <div className="hint">
              {itemLabel} · đơn vị: {unit} · sắp xếp theo phần còn lại giảm dần
            </div>

            <div className="tablewrap">
              {tab === "dt" ? (
                <table>
                  <thead>
                    <tr>
                      <th className="l">NPP thực hiện điều tiết</th>
                      <th className="l">NPP nhận</th>
                      <th className="l">Vùng</th>
                      <th>Cần</th>
                      <th>Đã</th>
                      <th>Còn lại</th>
                      <th>%</th>
                      <th className="l">Trạng thái</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dtTable.map(({ t, c }) => {
                      const kind = c.need === 0 ? "none" : c.rem === 0 ? "done" : c.done > 0 ? "part" : "none";
                      return (
                        <tr key={t.id}>
                          <td className="name l">{t.tenGive}<div className="hint" style={{ margin: 0 }}>{t.maGive}</div></td>
                          <td className="name l">{t.tenRecv ? shortName(t.tenRecv, 40) : <i style={{ color: "#6b7686" }}>chưa có NPP nhận</i>}<div className="hint" style={{ margin: 0 }}>{t.maRecv}</div></td>
                          <td className="l">{t.vung}</td>
                          <td>{fmt(c.need, metric)}</td>
                          <td>{fmt(c.done, metric)}</td>
                          <td>{fmt(c.rem, metric)}</td>
                          <td>{c.need > 0 ? fmtPct(pctOf(c.done, c.need)) : "–"}</td>
                          <td className="l">{c.need === 0 ? "–" : <Badge kind={kind} />}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th className="l">NPP nhận</th>
                      <th className="l">Vùng</th>
                      <th>Cần trừ</th>
                      <th>Tồn hiện tại</th>
                      <th>Đã SD (theo SO)</th>
                      <th>Đã trừ (đối chiếu)</th>
                      <th>Còn lại</th>
                      <th>%</th>
                      <th className="l">Trạng thái</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ttTable.map(({ r, c }) => {
                      const kind = c.over > 0 ? "over" : c.need > 0 && c.rem === 0 ? "done" : c.ded > 0 ? "part" : "none";
                      return (
                        <tr key={r.ma}>
                          <td className="name l">{r.ten}<div className="hint" style={{ margin: 0 }}>{r.ma}</div></td>
                          <td className="l">{r.vung}</td>
                          <td>{fmt(c.need, metric)}</td>
                          <td>{fmt(c.ton, metric)}</td>
                          <td>{fmt(c.sd, metric)}</td>
                          <td>{fmt(c.tt, metric)}</td>
                          <td className={c.over > 0 ? "neg" : ""}>{c.over > 0 ? "-" + fmt(c.over, metric) : fmt(c.rem, metric)}</td>
                          <td>{c.need > 0 ? fmtPct(pctOf(c.ded, c.need)) : "–"}</td>
                          <td className="l"><Badge kind={kind} /></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
              {(tab === "dt" ? dtTable.length : ttTable.length) === 0 ? (
                <div className="empty">Không có dòng nào khớp bộ lọc</div>
              ) : null}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
