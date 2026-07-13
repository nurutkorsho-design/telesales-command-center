import Dashboard from "@/components/Dashboard";
import { supabaseRead } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const revalidate = 0;

async function getData() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return { error: "Supabase env-var (URL / ANON KEY) set kora nei." };
  try {
    const sb = supabaseRead();
    const [{ data: leads, error: e1 }, { data: orders, error: e2 }] =
      await Promise.all([
        sb.from("leads").select("*").limit(20000),
        sb.from("orders").select("*").limit(20000),
      ]);
    if (e1 || e2) throw e1 || e2;
    return { leads: leads || [], orders: orders || [] };
  } catch (e) {
    return { error: String(e.message || e) };
  }
}

export default async function Page() {
  const data = await getData();
  return (
    <div className="wrap">
      <div className="header">
        <h1>📞 TeleSales Command Center</h1>
        <p>Bigganbaksho EdTech · COO view · Facebook Ad → Telesales → Delivery</p>
      </div>
      {data.error ? (
        <div className="err" style={{ marginTop: 20 }}>
          <b>Data load hoyni:</b> {data.error}
          <div style={{ marginTop: 8, fontSize: 13 }}>
            Ekbar <code>/api/sync?secret=YOUR_CRON_SECRET</code> hit koro (prothom
            data load), ar Supabase env-var thik ache kina check koro.
          </div>
        </div>
      ) : (
        <Dashboard leads={data.leads} orders={data.orders} />
      )}
    </div>
  );
}
