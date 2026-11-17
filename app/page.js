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
import { ITEMS } from "../lib/transform";

const COLORS = {
  done: "#22a06b",
  rem: "#f0a020",
  need: "#2f6fed",
  ton: "#22a06b",
};

const NO_LIST = "ASM chưa chốt DS điều tiết";

// ---------- tiện ích ----------
const keysOf = (item) => (item === "all" ? ITEMS.map((i) => i.key) : [item]);
const fmt = (n) => (Number(n) || 0).toLocaleString("vi-VN", { maximumFractionDigits: 0 });
const pctOf = (a, b) => (b > 0 ? (a / b) * 100 : 0);
const fmtPct = (p) =>
  Number.isFinite(p) ? p.toLocaleString("vi-VN", { maximumFractionDigits: 1 }) + "%" : "0%";
const trio = (o) => fmt(o.at) + " / " + fmt(o.bl) + " / " + fmt(o.kd);

function shortName(s, max = 26) {
  const t = String(s || "")
    .replace(/^CÔNG TY (TRÁCH NHIỆM HỮU HẠN|TNHH|CỔ PHẦN|CP)\s*/i, "")
    .replace(/^(MỘT THÀNH VIÊN|MTV|1TV)\s*/i, "")
    .replace(/^DOANH NGHIỆP TƯ NHÂN\s*/i, "DNTN ")
    .trim();
  return t.length > max ? t.slice(0, max - 1) + "…" : t;
}

// 1 dòng điều tiết (NPP giao -> NPP nhận)
function transCalc(t, item) {
  let need = 0;
  let done = 0;
  for (const k of keysOf(item)) {
    need += t.need[k];
    done += t.done[k];
  }
  return { need, done, rem: Math.max(need - done, 0) };
}

// 1 NPP nhận: nhận điều tiết vs tồn hiện tại
function recvCalc(r, item) {
  const keys = keysOf(item);
  let need = 0, got = 0, ton = 0, covered = 0;
  let short = false;
  for (const k of keys) {
    need += r.need[k];
    got += r.done[k];
    ton += r.ton[k];
    covered += Math.min(r.ton[k], r.need[k]);
    if (r.need[k] > 0 && r.ton[k] < r.need[k]) short = true;
  }
  let status = "none";
  if (need > 0) status = !short ? "ok" : covered === 0 ? "out" : "low";
  return { need, got, ton, pct: pctOf(ton, need), status };
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
function Tip({ active, payload, label, needKey }) {
  if (!active || !payload || !payload.length) return null;
  const row = payload[0].payload;
  return (
    <div style={{ background: "#fff", border: "1px solid #e3e8ef", borderRadius: 8, padding: "8px 10px", fontSize: 12 }}>
      <div style={{ fontWeight: 700, marginBottom: 4 }}>{row.full || label}</div>
      {payload.map((p) => (
        <div key={p.dataKey} style={{ color: p.color }}>
          {p.name}: <b>{fmt(p.value)}</b>
        </div>
      ))}
      {needKey ? <div style={{ marginTop: 4, color: "#6b7686" }}>Tổng cần: {fmt(row[needKey] || 0)}</div> : null}
    </div>
  );
}

function BarsChart({ data, series, stacked, needKey, height, onPick }) {
  if (!data.length) return <div className="empty">Không có dữ liệu</div>;
  const perRow = stacked ? 30 : 46;
  const h = height || Math.max(180, data.length * perRow + 70);
  return (
    <ResponsiveContainer width="100%" height={h}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, left: 4, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e3e8ef" />
        <XAxis type="number" tickFormatter={(v) => fmt(v)} fontSize={11} />
        <YAxis type="category" dataKey="name" width={170} fontSize={11} interval={0} />
        <Tooltip content={<Tip needKey={needKey} />} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        {series.map((s) => (
          <Bar
            key={s.key}
            dataKey={s.key}
            name={s.name}
            fill={s.color}
            stackId={stacked ? "a" : undefined}
            cursor={onPick ? "pointer" : undefined}
            onClick={
              onPick
                ? (d) => {
                    const row = (d && d.payload) || d;
                    if (row && row.ma) onPick(row.ma);
                  }
                : undefined
            }
          />
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
    ok: ["b-done", "Đủ tồn"],
    low: ["b-part", "Thiếu tồn"],
    out: ["b-over", "Hết tồn"],
    pend: ["b-warn", NO_LIST],
    gdone: ["b-done", "Đã điều tiết"],
    gpart: ["b-part", "Một phần"],
    gnone: ["b-over", "Chưa điều tiết"],
    none: ["b-none", "–"],
  };
  const [cls, text] = map[kind] || map.none;
  return <span className={"badge " + cls}>{text}</span>;
}

function Modal({ title, sub, onClose, children }) {
  useEffect(() => {
    const h = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);
  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="mhead">
          <h3>{title}</h3>
          <button onClick={onClose}>Đóng</button>
        </div>
        {sub ? <div className="msub">{sub}</div> : null}
        {children}
      </div>
    </div>
  );
}

function giverKind(t) {
  const need = t.need.at + t.need.bl + t.need.kd;
  const done = t.done.at + t.done.bl + t.done.kd;
  if (need > 0 && done >= need) return "gdone";
  if (done > 0) return "gpart";
  return "gnone";
}

// Cửa sổ chi tiết của 1 NPP nhận
function RecvDetail({ r, givers, tab, setTab, onClose }) {
  const sorted = [...givers].sort((a, b) => {
    const rank = { gnone: 0, gpart: 1, gdone: 2 };
    return rank[giverKind(a)] - rank[giverKind(b)];
  });
  const nDone = givers.filter((t) => giverKind(t) === "gdone").length;
  const nPart = givers.filter((t) => giverKind(t) === "gpart").length;
  const nNone = givers.length - nDone - nPart;

  return (
    <Modal title={r.ten} sub={r.ma + " · " + r.vung + " · " + r.mien} onClose={onClose}>
      <div className="seg">
        <button className={tab === "recv" ? "on" : ""} onClick={() => setTab("recv")}>SL nhận điều tiết</button>
        <button className={tab === "stock" ? "on" : ""} onClick={() => setTab("stock")}>Tồn kho hiện tại</button>
      </div>

      {tab === "stock" ? (
        <>
          <div className="stats">
            {ITEMS.map((i) => (
              <div className="stat" key={i.key}>
                <div className="k">{i.label} còn trong kho</div>
                <div className="v">{fmt(r.ton[i.key])}</div>
              </div>
            ))}
          </div>
          <div className="tablewrap">
            <table>
              <thead>
                <tr>
                  <th className="l">Mặt hàng</th>
                  <th>Tồn hiện tại</th>
                  <th>SL nhận điều tiết</th>
                  <th>Tồn − nhận</th>
                  <th className="l">Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {ITEMS.map((i) => {
                  const ton = r.ton[i.key];
                  const need = r.need[i.key];
                  const kind = need === 0 ? "none" : ton >= need ? "ok" : ton === 0 ? "out" : "low";
                  return (
                    <tr key={i.key}>
                      <td className="l">{i.label}</td>
                      <td>{fmt(ton)}</td>
                      <td>{fmt(need)}</td>
                      <td className={ton - need < 0 ? "neg" : ""}>{fmt(ton - need)}</td>
                      <td className="l"><Badge kind={kind} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <>
          <div className="summary">
            <span className="badge b-done">Đã điều tiết: {nDone} NPP</span>
            <span className="badge b-part">Một phần: {nPart} NPP</span>
            <span className="badge b-over">Chưa điều tiết: {nNone} NPP</span>
          </div>
          <div className="hint" style={{ color: "#6b7686", fontSize: 12, marginBottom: 8 }}>
            Số hiển thị theo thứ tự: Áo thun / Balo / Khay đá
          </div>
          <div className="tablewrap">
            <table>
              <thead>
                <tr>
                  <th className="l">NPP thực hiện điều tiết</th>
                  <th>Cần điều tiết</th>
                  <th>Đã điều tiết</th>
                  <th className="l">Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((t) => (
                  <tr key={t.id}>
                    <td className="name l">{t.tenGive}<div style={{ color: "#6b7686", fontSize: 12 }}>{t.maGive}</div></td>
                    <td>{trio(t.need)}</td>
                    <td>{trio(t.done)}</td>
                    <td className="l"><Badge kind={giverKind(t)} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </Modal>
  );
}

// Cửa sổ chi tiết của vùng chưa chốt DS điều tiết
function PendDetail({ p, onClose }) {
  return (
    <Modal title={"Vùng " + p.vung + ": " + NO_LIST} sub={p.mien} onClose={onClose}>
      <div className="hint" style={{ color: "#6b7686", fontSize: 12, marginBottom: 8 }}>
        Các NPP cần điều tiết nhưng ASM chưa chốt NPP nhận. Số hiển thị theo thứ tự: Áo thun / Balo / Khay đá
      </div>
      <div className="tablewrap">
        <table>
          <thead>
            <tr>
              <th className="l">NPP cần điều tiết</th>
              <th>Cần điều tiết</th>
            </tr>
          </thead>
          <tbody>
            {p.givers.map((t) => (
              <tr key={t.id}>
                <td className="name l">{t.tenGive}<div style={{ color: "#6b7686", fontSize: 12 }}>{t.maGive}</div></td>
                <td>{trio(t.need)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Modal>
  );
}

// ---------- trang chính ----------
export default function Page() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [mien, setMien] = useState("all");
  const [vung, setVung] = useState("all");
  const [item, setItem] = useState("all");
  const [q, setQ] = useState("");
  const [modal, setModal] = useState(null); // {kind:'recv', ma, tab} | {kind:'pend', vung}

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
  const itemLabel = item === "all" ? "Tất cả mặt hàng" : ITEMS.find((i) => i.key === item).label;

  // ----- điều tiết -----
  const dt = useMemo(() => {
    const calc = (t) => transCalc(t, item);
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
    return { total, byGroup, rows, perItem, pending };
  }, [fT, item, groupBy]);

  // ----- vùng chưa chốt DS điều tiết (NPP chưa có NPP nhận) -----
  const pendGroups = useMemo(() => {
    const m = new Map();
    for (const t of fT) {
      if (t.maRecv) continue;
      const key = t.vung || "(chưa rõ)";
      if (!m.has(key)) m.set(key, { vung: key, mien: t.mien, givers: [], need: 0 });
      const g = m.get(key);
      g.givers.push(t);
      g.need += transCalc(t, item).need;
    }
    return Array.from(m.values());
  }, [fT, item]);

  // ----- trừ tồn (NPP nhận) -----
  const rrows = useMemo(() => fR.map((r) => ({ r, c: recvCalc(r, item) })), [fR, item]);

  const tt = useMemo(() => {
    const need = rrows.reduce((s, x) => s + x.c.need, 0);
    const ton = rrows.reduce((s, x) => s + x.c.ton, 0);
    const perItem = ITEMS.map((i) => {
      const n = fR.reduce((s, r) => s + r.need[i.key], 0);
      const t = fR.reduce((s, r) => s + r.ton[i.key], 0);
      return { label: i.label, pct: pctOf(t, n), blue: true };
    });
    const tonByItem = ITEMS.map((i) => ({
      label: i.label,
      v: fR.reduce((s, r) => s + r.ton[i.key], 0),
    }));
    const lowCount = rrows.filter((x) => x.c.status === "low" || x.c.status === "out").length;
    return { need, ton, perItem, tonByItem, lowCount };
  }, [rrows, fR]);

  const byGroupStock = useMemo(
    () => groupSum(fR, (r) => r[groupBy], (r) => recvCalc(r, item), ["need", "ton"]),
    [fR, groupBy, item]
  );

  const nppChart = useMemo(
    () =>
      [...rrows]
        .sort((a, b) => b.c.need - b.c.ton - (a.c.need - a.c.ton))
        .map((x) => ({
          ma: x.r.ma,
          name: shortName(x.r.ten, 26) + " (" + x.r.ma.replace("WWG_GT_", "") + ")",
          full: x.r.ten + " (" + x.r.ma + ")",
          need: x.c.need,
          ton: x.c.ton,
        })),
    [rrows]
  );

  const topDT = useMemo(
    () =>
      dt.rows
        .filter((x) => x.c.rem > 0)
        .sort((a, b) => b.c.rem - a.c.rem)
        .slice(0, 12)
        .map((x) => ({
          name: shortName(x.t.tenGive),
          full:
            x.t.tenGive +
            " → " +
            (x.t.tenRecv ? shortName(x.t.tenRecv, 30) : "Vùng " + x.t.vung + ": " + NO_LIST),
          need: x.c.need,
          done: x.c.done,
          rem: x.c.rem,
        })),
    [dt.rows]
  );

  // ----- bảng chi tiết trừ tồn NPP -----
  const needle = q.trim().toLowerCase();
  const tableRows = useMemo(() => {
    const rank = { out: 0, low: 1, ok: 2, none: 3 };
    return rrows
      .filter((x) => !needle || [x.r.ten, x.r.ma, x.r.vung].join(" ").toLowerCase().includes(needle))
      .sort(
        (a, b) =>
          rank[a.c.status] - rank[b.c.status] || b.c.need - b.c.ton - (a.c.need - a.c.ton)
      );
  }, [rrows, needle]);
  const pendRows = useMemo(
    () => pendGroups.filter((p) => !needle || (p.vung + " " + NO_LIST).toLowerCase().includes(needle)),
    [pendGroups, needle]
  );

  const givenOf = (ma) => transfers.filter((t) => t.maRecv === ma);
  const modalRecv = modal && modal.kind === "recv" ? receivers.find((r) => r.ma === modal.ma) : null;
  const modalPend = modal && modal.kind === "pend" ? pendGroups.find((p) => p.vung === modal.vung) : null;
  const closeModal = useCallback(() => setModal(null), []);

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
          {pendGroups.length > 0 ? (
            <div className="notice">
              <b>{NO_LIST}:</b>
              <ul>
                {pendGroups.map((p) => (
                  <li key={p.vung}>
                    Vùng {p.vung} chưa chốt DS điều tiết ({p.givers.length} NPP, cần điều tiết {fmt(p.need)} cái)
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="grid kpis">
            <div className="card kpi">
              <div className="label">Tiến độ điều tiết · {itemLabel}</div>
              <div className="big">{fmtPct(pctOf(dt.total.done, dt.total.need))}</div>
              <div className="bar"><i style={{ width: Math.min(100, pctOf(dt.total.done, dt.total.need)) + "%" }} /></div>
              <div className="line2">
                Đã {fmt(dt.total.done)} / cần {fmt(dt.total.need)} cái
              </div>
              <MiniBars rows={dt.perItem} />
            </div>

            <div className="card kpi">
              <div className="label">Tiến độ trừ tồn · {itemLabel}</div>
              <div className="big">{fmtPct(pctOf(tt.ton, tt.need))}</div>
              <div className="bar blue"><i style={{ width: Math.min(100, pctOf(tt.ton, tt.need)) + "%" }} /></div>
              <div className="line2">
                Tồn hiện tại {fmt(tt.ton)} / SL nhận điều tiết {fmt(tt.need)} cái
              </div>
              <MiniBars rows={tt.perItem} />
            </div>

            <div className="card kpi">
              <div className="label">Còn lại cần điều tiết</div>
              <div className="big">{fmt(dt.total.rem)}</div>
              <div className="line2">cái · {dt.pending} dòng điều tiết chưa xong</div>
            </div>

            <div className="card kpi">
              <div className="label">Còn lại cần trừ tồn (= tồn kho hiện tại)</div>
              <div className="big">{fmt(tt.ton)}</div>
              <div className="line2">
                {tt.tonByItem.map((x) => x.label + " " + fmt(x.v)).join(" · ")}
              </div>
              <div className="line2">
                {tt.lowCount}/{rrows.length} NPP nhận chưa đủ tồn so với SL nhận điều tiết
              </div>
            </div>
          </div>

          <div className="grid charts">
            <div className="card">
              <h3>Tiến độ điều tiết theo {groupLabel}</h3>
              <div className="hint">Đã điều tiết vs còn lại · {itemLabel} · đơn vị: cái</div>
              <BarsChart
                data={dt.byGroup}
                needKey="need"
                stacked
                series={[
                  { key: "done", name: "Đã điều tiết", color: COLORS.done },
                  { key: "rem", name: "Còn lại", color: COLORS.rem },
                ]}
              />
            </div>

            <div className="card">
              <h3>Tồn hiện tại so với SL nhận điều tiết theo {groupLabel}</h3>
              <div className="hint">Chỉ tính NPP đã có danh sách nhận điều tiết · {itemLabel} · đơn vị: cái</div>
              <BarsChart
                data={byGroupStock}
                series={[
                  { key: "need", name: "SL nhận điều tiết", color: COLORS.need },
                  { key: "ton", name: "Tồn hiện tại", color: COLORS.ton },
                ]}
              />
            </div>

            <div className="card">
              <h3>Top dòng điều tiết còn thiếu nhiều nhất</h3>
              <div className="hint">NPP thực hiện điều tiết · 12 dòng đầu · di chuột để xem NPP nhận</div>
              <BarsChart
                data={topDT}
                needKey="need"
                stacked
                series={[
                  { key: "done", name: "Đã điều tiết", color: COLORS.done },
                  { key: "rem", name: "Còn lại", color: COLORS.rem },
                ]}
              />
            </div>

            <div className="card cardfull">
              <h3>Kiểm tra tồn kho hiện tại của từng NPP nhận điều tiết</h3>
              <div className="hint">
                Sắp xếp NPP thiếu tồn nhiều nhất lên đầu · {itemLabel} · bấm vào cột để xem tồn từng mặt hàng
              </div>
              <BarsChart
                data={nppChart}
                onPick={(ma) => setModal({ kind: "recv", ma, tab: "stock" })}
                series={[
                  { key: "need", name: "SL nhận điều tiết", color: COLORS.need },
                  { key: "ton", name: "Tồn hiện tại", color: COLORS.ton },
                ]}
              />
            </div>
          </div>

          <div className="card">
            <div className="tabhead">
              <div>
                <h3 style={{ margin: 0 }}>Chi tiết trừ tồn NPP</h3>
                <div className="hint" style={{ margin: 0 }}>
                  {itemLabel} · đơn vị: cái · bấm vào số để xem chi tiết · tiến độ = tồn hiện tại / SL nhận điều tiết
                </div>
              </div>
              <input
                type="text"
                placeholder="Tìm tên, mã NPP hoặc vùng…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>

            <div className="tablewrap">
              <table>
                <thead>
                  <tr>
                    <th className="l">NPP nhận điều tiết</th>
                    <th className="l">Vùng</th>
                    <th>SL đã nhận / cần nhận</th>
                    <th>Tồn hiện tại</th>
                    <th>Tiến độ trừ tồn</th>
                    <th className="l">Trạng thái</th>
                  </tr>
                </thead>
                <tbody>
                  {tableRows.map(({ r, c }) => (
                    <tr key={r.ma}>
                      <td className="name l">
                        {r.ten}
                        <div style={{ color: "#6b7686", fontSize: 12 }}>{r.ma}</div>
                      </td>
                      <td className="l">{r.vung}</td>
                      <td>
                        <button className="lnk" onClick={() => setModal({ kind: "recv", ma: r.ma, tab: "recv" })}>
                          {fmt(c.got)} / {fmt(c.need)}
                        </button>
                      </td>
                      <td>
                        <button className="lnk" onClick={() => setModal({ kind: "recv", ma: r.ma, tab: "stock" })}>
                          {fmt(c.ton)}
                        </button>
                      </td>
                      <td>
                        {c.need > 0 ? (
                          <div style={{ display: "flex", gap: 8, alignItems: "center", justifyContent: "flex-end" }}>
                            <div className="bar blue" style={{ width: 70 }}>
                              <i style={{ width: Math.min(100, c.pct) + "%" }} />
                            </div>
                            <b>{fmtPct(c.pct)}</b>
                          </div>
                        ) : (
                          "–"
                        )}
                      </td>
                      <td className="l"><Badge kind={c.status} /></td>
                    </tr>
                  ))}
                  {pendRows.map((p) => (
                    <tr key={"pend-" + p.vung} className="pend">
                      <td className="name l">
                        <i>Vùng {p.vung}</i>
                        <div style={{ color: "#6b7686", fontSize: 12 }}>{p.givers.length} NPP cần điều tiết</div>
                      </td>
                      <td className="l">{p.vung}</td>
                      <td>
                        <button className="lnk" onClick={() => setModal({ kind: "pend", vung: p.vung })}>
                          – / {fmt(p.need)}
                        </button>
                      </td>
                      <td>–</td>
                      <td>–</td>
                      <td className="l"><Badge kind="pend" /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {tableRows.length + pendRows.length === 0 ? (
                <div className="empty">Không có dòng nào khớp bộ lọc</div>
              ) : null}
            </div>
          </div>
        </>
      ) : null}

      {modalRecv ? (
        <RecvDetail
          r={modalRecv}
          givers={givenOf(modalRecv.ma)}
          tab={modal.tab}
          setTab={(tab) => setModal({ ...modal, tab })}
          onClose={closeModal}
        />
      ) : null}
      {modalPend ? <PendDetail p={modalPend} onClose={closeModal} /> : null}
    </div>
  );
}
