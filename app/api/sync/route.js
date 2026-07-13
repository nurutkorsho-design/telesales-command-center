// ==========================================================================
// /api/sync  —  Google Sheet -> Supabase mirror
// Vercel Cron proti 15 min-e ei route hit kore (vercel.json).
// Manual: GET /api/sync?secret=CRON_SECRET
// ==========================================================================
import { NextResponse } from "next/server";
import { fetchLeads, fetchOrders } from "@/lib/sheets";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(req) {
  const auth = req.headers.get("authorization") || "";
  const url = new URL(req.url);
  const qs = url.searchParams.get("secret") || "";
  const secret = process.env.CRON_SECRET;
  if (!secret) return true; // secret set na thakle open (dev)
  return auth === `Bearer ${secret}` || qs === secret;
}

async function mirror(sb, table, rows) {
  // full refresh: purono row muche notun boshai (Google Sheet-i source of truth)
  const del = await sb.from(table).delete().neq("id", 0);
  if (del.error) throw del.error;
  for (let i = 0; i < rows.length; i += 500) {
    const chunk = rows.slice(i, i + 500);
    const { error } = await sb.from(table).insert(chunk);
    if (error) throw error;
  }
  return rows.length;
}

export async function GET(req) {
  if (!authorized(req))
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  try {
    const [leads, orders] = await Promise.all([fetchLeads(), fetchOrders()]);
    const sb = supabaseAdmin();
    const nLeads = await mirror(sb, "leads", leads);
    const nOrders = await mirror(sb, "orders", orders);
    return NextResponse.json({
      ok: true, leads: nLeads, orders: nOrders, at: new Date().toISOString(),
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e.message || e) }, { status: 500 });
  }
}
