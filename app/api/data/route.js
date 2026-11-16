import { NextResponse } from "next/server";
import raw from "../../../data/raw.json";
import { buildModel } from "../../../lib/transform";

export const dynamic = "force-dynamic";

export async function GET() {
  const base = process.env.SHEET_API_URL;
  const key = process.env.SHEET_API_KEY;
  let rows = null;
  let source = "file";
  let updatedAt = null;
  let warning = null;

  if (base) {
    try {
      const url = key ? `${base}${base.includes("?") ? "&" : "?"}key=${encodeURIComponent(key)}` : base;
      const res = await fetch(url, { cache: "no-store", redirect: "follow" });
      const json = await res.json();
      if (json && json.ok && Array.isArray(json.rows)) {
        rows = json.rows;
        source = "sheet";
        updatedAt = json.updatedAt || null;
      } else {
        warning = (json && json.error) || "Apps Script trả về dữ liệu không hợp lệ";
      }
    } catch (e) {
      warning = "Không đọc được Apps Script: " + (e && e.message ? e.message : String(e));
    }
  }

  if (!rows) rows = raw;
  const model = buildModel(rows);
  return NextResponse.json({ ...model, source, updatedAt, warning });
}
