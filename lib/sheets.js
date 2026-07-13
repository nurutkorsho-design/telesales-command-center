// ==========================================================================
// Google Sheet (public CSV) -> parsed row objects
// ==========================================================================
import crypto from "crypto";

const CSV_URL = (id) =>
  `https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:csv`;

// --- minimal RFC-4180 CSV parser (quotes, commas, newlines, unicode) --------
function parseCSV(text) {
  const rows = [];
  let row = [], field = "", inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else if (c === "\r") { /* skip */ }
    else field += c;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows;
}

function toObjects(rows) {
  if (!rows.length) return [];
  // header dedup (Sheet 2-te duplicate 'Source')
  const seen = {};
  const header = rows[0].map((h) => {
    let name = String(h).trim();
    if (name in seen) { seen[name]++; name = `${name}_${seen[name]}`; }
    else seen[name] = 0;
    return name;
  });
  return rows.slice(1).map((r) => {
    const o = {};
    header.forEach((h, i) => (o[h] = (r[i] ?? "").trim()));
    return o;
  });
}

const num = (v) => {
  const n = parseFloat(String(v ?? "").replace(/[^\d.\-]/g, ""));
  return Number.isFinite(n) ? n : 0;
};

// "11-07-2026" (DD-MM-YYYY) -> "2026-07-11" (ISO) | null
function isoDate(v) {
  const m = String(v ?? "").trim().match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (!m) return null;
  const [, d, mo, y] = m;
  return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
}

const hash = (s) => crypto.createHash("md5").update(s).digest("hex");

async function fetchCsv(id) {
  const res = await fetch(CSV_URL(id), { cache: "no-store" });
  if (!res.ok) throw new Error(`Sheet ${id} fetch failed: ${res.status}`);
  return toObjects(parseCSV(await res.text()));
}

// --- lead stage classifier (Streamlit theke port) ---------------------------
const NOT_CONNECTED = ["ধরেনি", "বন্ধ", "যাচ্ছে না", "কেটে"];
const ORDERED_KW = ["অর্ডার করেছেন"];
const INTEREST_KW = ["লিঙ্ক", "জানাবেন", "কনফার্ম", "নিবেন", "আলোচনা", "বিজি"];

function leadStage(row) {
  const outcome = String(row["Outcome"] || "").toLowerCase();
  const short = String(row["Short Code-"] || "");
  const remarks = Object.keys(row)
    .filter((k) => k.toLowerCase().includes("remark"))
    .map((k) => row[k])
    .join(" ");
  const blob = short + " " + remarks;
  if (outcome === "sold" || ORDERED_KW.some((k) => blob.includes(k)))
    return "4. Ordered";
  if (["follow-up", "not"].includes(outcome) || INTEREST_KW.some((k) => blob.includes(k)))
    return "3. Interested";
  if (NOT_CONNECTED.some((k) => short.includes(k)) && !INTEREST_KW.some((k) => short.includes(k)))
    return "1. Not connected";
  return "2. Connected";
}

export async function fetchLeads() {
  const raw = await fetchCsv(process.env.LEAD_SHEET_ID);
  return raw
    .filter((r) => isoDate(r["Date"]) && String(r["Name"] || "").trim())
    .map((r) => ({
      row_key: hash(`${r["Date"]}|${r["Name"]}|${r["Contact no."]}`),
      lead_date: isoDate(r["Date"]),
      name: r["Name"] || "",
      contact: r["Contact no."] || "",
      occupation: r["Occupation"] || "",
      campaign: r["Campaign Name"] || "",
      age: r["Age"] || "",
      class: r["Class"] || "",
      agent: (r["Agent Name"] || "").trim() || "Unassigned",
      parent_type: r["Parent Type"] || "",
      product_sugg: r["Product Suggession"] || "",
      outcome: r["Outcome"] || "",
      objection: r["Objection Type"] || "",
      short_code: r["Short Code-"] || "",
      stage: leadStage(r),
    }));
}

export async function fetchOrders() {
  const raw = await fetchCsv(process.env.ORDER_SHEET_ID);
  return raw
    .filter((r) => isoDate(r["Order Date"]) && num(r["Total Amount"]) > 0)
    .map((r) => {
      const total = num(r["Total Amount"]);
      const disc = num(r["Discount"]);
      const price = num(r["Product Price"]);
      return {
        row_key: hash(`${r["Order Date"]}|${r["Name"]}|${r["Contact Number"]}|${r["Invoice ID"]}`),
        order_date: isoDate(r["Order Date"]),
        name: r["Name"] || "",
        contact: r["Contact Number"] || "",
        address: r["Address"] || "",
        district: r["District"] || "",
        sub_district: r["Sub District"] || "",
        total_amount: total,
        shipping_charge: num(r["Shipping Charge"]),
        discount: disc,
        net_revenue: price > 0 ? price : total - disc,
        invoice_id: r["Invoice ID"] || "",
        agent: (r["Order Collector"] || "").trim() || "Unassigned",
        product: r["Product Name-1"] || "",
        product_price: num(r["Product Price-1"]),
        profession: r["Profession"] || "",
        class: r["Class"] || "",
        age: r["Age"] || "",
      };
    });
}
