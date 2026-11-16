import { NextResponse } from "next/server";
import raw from "../../../data/raw.json";
import { buildModel } from "../../../lib/transform";

export const dynamic = "force-dynamic";

export async function GET() {
  const base = (process.env.SHEET_API_URL || "").trim();
  const key = (process.env.SHEET_API_KEY || "").trim();
  let rows = null;
  let source = "file";
  let updatedAt = null;
  let warning = null;

  if (base) {
    let status = "";
    let finalUrl = "";
    let text = "";
    try {
      const url = key ? `${base}${base.includes("?") ? "&" : "?"}key=${encodeURIComponent(key)}` : base;
      const res = await fetch(url, { cache: "no-store", redirect: "follow" });
      status = String(res.status);
      finalUrl = res.url || "";
      text = await res.text();
      let json = null;
      try {
        json = JSON.parse(text);
      } catch (e) {
        json = null;
      }
      if (json && json.ok && Array.isArray(json.rows)) {
        rows = json.rows;
        source = "sheet";
        updatedAt = json.updatedAt || null;
      } else if (json) {
        warning = "Apps Script báo: " + (json.error || "dữ liệu không hợp lệ");
      } else {
        const head = text.replace(/\s+/g, " ").slice(0, 160);
        let host = "";
        try {
          host = new URL(finalUrl).host;
        } catch (e) {
          host = finalUrl;
        }
        warning =
          "Link Apps Script trả về trang web thay vì JSON (HTTP " + status + ", nơi trả về: " + host +
          "). URL đang dùng bắt đầu bằng: " + base.slice(0, 60) + "… và có " +
          (base.endsWith("/exec") ? "đuôi /exec" : "ĐUÔI KHÔNG PHẢI /exec") +
          ". Nội dung đầu: " + head;
      }
    } catch (e) {
      warning = "Không gọi được Apps Script: " + (e && e.message ? e.message : String(e));
    }
  }

  if (!rows) rows = raw;
  const model = buildModel(rows);
  return NextResponse.json({ ...model, source, updatedAt, warning });
}
