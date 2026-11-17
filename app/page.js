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
  got: "#2f6fed",
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
    .replace(/^DOANH NGHIỆP T
