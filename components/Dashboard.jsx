"use client";
import { useMemo, useState } from "react";
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  FunnelChart, Funnel, LabelList, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from "recharts";

const BDT = "৳";
const COLORS = ["#6366f1", "#06b6d4", "#10b981", "#f59e0b", "#ef4444",
  "#8b5cf6", "#ec4899", "#14b8a6", "#f97316", "#64748b"];
const money = (n) => `${BDT}${Math.round(n || 0).toLocaleString()}`;
const AX = { fontSize: 12, fill: "#94a3b8" };

function uniq(arr) { return [...new Set(arr.filter(Boolean))].sort(); }

const tooltipStyle = {
  contentStyle: { background: "#1e293b", border: "1px solid #334155",
    borderRadius: 8, color: "#e2e8f0", fontSize: 12 },
};

export default function Dashboard({ leads, orders }) {
  const allDates = [
    ...leads.map((l) => l.lead_date),
    ...orders.map((o) => o.order_date),
  ].filter(Boolean).sort();
  const dMin = allDates[0] || "2026-01-01";
  const dMax = allDates[allDates.length - 1] || "2026-12-31";

  const [tab, setTab] = useState(0);
  const [from, setFrom] = useState(dMin);
  const [to, setTo] = useState(dMax);
  const agents = useMemo(
    () => uniq([...leads.map((l) => l.agent), ...orders.map((o) => o.agent)]),
    [leads, orders]
  );
  const districts = useMemo(() => uniq(orders.map((o) => o.district)), [orders]);
  const [selAgents, setSelAgents] = useState(agents);
  const [selDist, setSelDist] = useState(districts);

  const toggle = (arr, set, v) =>
    set(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

  const fLeads = useMemo(
    () => leads.filter(
      (l) => l.lead_date >= from && l.lead_date <= to && selAgents.includes(l.agent)
    ),
    [leads, from, to, selAgents]
  );
  const fOrders = useMemo(
    () => orders.filter(
      (o) => o.order_date >= from && o.order_date <= to &&
        selAgents.includes(o.agent) && selDist.includes(o.district)
    ),
    [orders, from, to, selAgents, selDist]
  );

  const m = useMemo(() => {
    const nLeads = fLeads.length, nOrders = fOrders.length;
    const gross = fOrders.reduce((s, o) => s + (+o.total_amount || 0), 0);
    const net = fOrders.reduce((s, o) => s + (+o.net_revenue || 0), 0);
    const disc = fOrders.reduce((s, o) => s + (+o.discount || 0), 0);
    const connected = fLeads.filter((l) =>
      ["2. Connected", "3. Interested", "4. Ordered"].includes(l.stage)).length;
    const interested = fLeads.filter((l) =>
      ["3. Interested", "4. Ordered"].includes(l.stage)).length;
    return {
      nLeads, nOrders, gross, net, disc,
      aov: nOrders ? net / nOrders : 0,
      conv: nLeads ? (nOrders / nLeads) * 100 : 0,
      contact: nLeads ? (connected / nLeads) * 100 : 0,
      connected, interested,
    };
  }, [fLeads, fOrders]);

  return (
    <>
      <div className="filters">
        <div>
          <label>From</label>
          <input type="date" value={from} min={dMin} max={dMax}
            onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div>
          <label>To</label>
          <input type="date" value={to} min={dMin} max={dMax}
            onChange={(e) => setTo(e.target.value)} />
        </div>
        <div style={{ flex: 1 }}>
          <label>Agents</label>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {agents.map((a) => (
              <button key={a}
                className={"tab" + (selAgents.includes(a) ? " active" : "")}
                style={{ padding: "5px 10px", fontSize: 12 }}
                onClick={() => toggle(selAgents, setSelAgents, a)}>{a}</button>
            ))}
          </div>
        </div>
        <button className="btn ghost" onClick={() => {
          setFrom(dMin); setTo(dMax); setSelAgents(agents); setSelDist(districts);
        }}>Reset</button>
      </div>

      <div className="tabs">
        {["📊 Sales Overview", "🧑‍💼 Agent Performance",
          "📣 Campaigns & Products", "🗺️ Geography & Customers"].map((t, i) => (
          <div key={i} className={"tab" + (tab === i ? " active" : "")}
            onClick={() => setTab(i)}>{t}</div>
        ))}
      </div>

      {tab === 0 && <Overview m={m} leads={fLeads} orders={fOrders} />}
      {tab === 1 && <Agents leads={fLeads} orders={fOrders} />}
      {tab === 2 && <Products leads={fLeads} orders={fOrders} />}
      {tab === 3 && (
        <Geography leads={fLeads} orders={fOrders}
          districts={districts} selDist={selDist}
          setDist={(v) => toggle(selDist, setSelDist, v)} />
      )}

      <div className="foot">
        Amounts BDT ({BDT}) · Live Supabase (Google Sheet sync) ·
        Total leads {leads.length.toLocaleString()} · orders {orders.length.toLocaleString()}
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ KPI */
function Kpi({ label, value, sub }) {
  return (
    <div className="kpi">
      <div className="label">{label}</div>
      <div className="value">{value}</div>
      {sub && <div className="sub">{sub}</div>}
    </div>
  );
}

function groupSum(rows, key, valFn) {
  const map = {};
  rows.forEach((r) => {
    const k = (r[key] || "").trim(); if (!k) return;
    map[k] = (map[k] || 0) + valFn(r);
  });
  return Object.entries(map).map(([name, value]) => ({ name, value }));
}

/* -------------------------------------------------------------- OVERVIEW */
function Overview({ m, leads, orders }) {
  const trend = useMemo(() => {
    const map = {};
    orders.forEach((o) => { map[o.order_date] = (map[o.order_date] || 0) + (+o.net_revenue || 0); });
    return Object.entries(map).sort().map(([date, Revenue]) => ({ date, Revenue }));
  }, [orders]);

  const funnel = [
    { name: "Leads", value: m.nLeads, fill: COLORS[0] },
    { name: "Connected", value: m.connected, fill: COLORS[1] },
    { name: "Interested", value: m.interested, fill: COLORS[2] },
    { name: "Ordered", value: m.nOrders, fill: COLORS[3] },
  ];

  const prod = useMemo(
    () => groupSum(orders, "product", (o) => +o.net_revenue || 0)
      .sort((a, b) => b.value - a.value).slice(0, 10),
    [orders]
  );

  const topProd = prod[0];
  const notConn = leads.filter((l) => l.stage === "1. Not connected").length;

  return (
    <>
      <div className="kpis">
        <Kpi label="Total FB Leads" value={m.nLeads.toLocaleString()} />
        <Kpi label="Orders Collected" value={m.nOrders.toLocaleString()} />
        <Kpi label="Lead → Order Conv." value={m.conv.toFixed(1) + "%"} />
        <Kpi label="Contact Rate" value={m.contact.toFixed(1) + "%"}
          sub="Jader sathe kotha hoyeche" />
      </div>
      <div className="kpis" style={{ marginTop: 14 }}>
        <Kpi label="Net Revenue" value={money(m.net)} />
        <Kpi label="Gross (incl. ship)" value={money(m.gross)} />
        <Kpi label="Avg Order Value" value={money(m.aov)} />
        <Kpi label="Total Discount" value={money(m.disc)} />
      </div>

      <div className="grid2">
        <div className="panel" style={{ marginTop: 0 }}>
          <h3>Revenue trend</h3>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={trend}>
              <defs>
                <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.7} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#334155" strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={AX} />
              <YAxis tick={AX} />
              <Tooltip {...tooltipStyle} formatter={(v) => money(v)} />
              <Area type="monotone" dataKey="Revenue" stroke="#6366f1"
                fill="url(#g)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="panel" style={{ marginTop: 0 }}>
          <h3>Sales funnel</h3>
          <ResponsiveContainer width="100%" height={280}>
            <FunnelChart>
              <Tooltip {...tooltipStyle} />
              <Funnel dataKey="value" data={funnel} isAnimationActive>
                <LabelList position="right" fill="#e2e8f0" stroke="none"
                  dataKey="name" />
                <LabelList position="left" fill="#94a3b8" stroke="none"
                  dataKey="value" />
              </Funnel>
            </FunnelChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="panel">
        <h3>Product-wise revenue</h3>
        <ResponsiveContainer width="100%" height={340}>
          <BarChart data={prod} layout="vertical"
            margin={{ left: 20, right: 20 }}>
            <CartesianGrid stroke="#334155" strokeDasharray="3 3" />
            <XAxis type="number" tick={AX} />
            <YAxis type="category" dataKey="name" tick={AX} width={150} />
            <Tooltip {...tooltipStyle} formatter={(v) => money(v)} />
            <Bar dataKey="value" radius={[0, 4, 4, 0]}>
              {prod.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="panel">
        <h3>💡 Auto insights</h3>
        {m.nLeads > 0 && (
          <div className="insight">
            {m.conv.toFixed(1)}% lead order-e convert holo ({m.nOrders} / {m.nLeads}).
          </div>
        )}
        {topProd && (
          <div className="insight">
            Sobcheye beshi revenue: <b>{topProd.name}</b> ({money(topProd.value)}).
          </div>
        )}
        {m.nLeads > 0 && notConn / m.nLeads > 0.4 && (
          <div className="insight" style={{ borderLeftColor: "#f59e0b" }}>
            ⚠️ {Math.round((notConn / m.nLeads) * 100)}% lead-er sathe connect-i hoyni —
            number quality / call-timing dekho.
          </div>
        )}
      </div>
    </>
  );
}

/* ---------------------------------------------------------------- AGENTS */
function Agents({ leads, orders }) {
  const [sortKey, setSortKey] = useState("Revenue");
  const rows = useMemo(() => {
    const map = {};
    const ensure = (a) => (map[a] = map[a] ||
      { Agent: a, Leads: 0, Connected: 0, Orders: 0, Revenue: 0, Discount: 0 });
    leads.forEach((l) => {
      const r = ensure(l.agent); r.Leads++;
      if (["2. Connected", "3. Interested", "4. Ordered"].includes(l.stage)) r.Connected++;
    });
    orders.forEach((o) => {
      const r = ensure(o.agent); r.Orders++;
      r.Revenue += +o.net_revenue || 0; r.Discount += +o.discount || 0;
    });
    return Object.values(map).map((r) => ({
      ...r,
      Conversion: r.Leads ? (r.Orders / r.Leads) * 100 : 0,
      Contact: r.Leads ? (r.Connected / r.Leads) * 100 : 0,
      AvgOrder: r.Orders ? r.Revenue / r.Orders : 0,
    })).sort((a, b) => (b[sortKey] || 0) - (a[sortKey] || 0));
  }, [leads, orders, sortKey]);

  const withRev = rows.filter((r) => r.Revenue > 0);
  const top = withRev[0];
  const coaching = [...rows].filter((r) => r.Leads >= 5)
    .sort((a, b) => a.Conversion - b.Conversion)[0];

  return (
    <>
      <div className="grid2">
        {top && (
          <div className="panel" style={{ marginTop: 0, borderColor: "#10b981" }}>
            <h3>🏆 Top performer</h3>
            <div style={{ fontSize: 18, fontWeight: 700 }}>{top.Agent}</div>
            <div className="muted">{money(top.Revenue)} · {top.Conversion.toFixed(1)}% conv · {top.Orders} orders</div>
          </div>
        )}
        {coaching && (
          <div className="panel" style={{ marginTop: 0, borderColor: "#f59e0b" }}>
            <h3>📚 Needs coaching</h3>
            <div style={{ fontSize: 18, fontWeight: 700 }}>{coaching.Agent}</div>
            <div className="muted">{coaching.Conversion.toFixed(1)}% conv · {coaching.Leads} leads · {coaching.Orders} orders</div>
          </div>
        )}
      </div>

      <div className="grid2">
        <div className="panel">
          <h3>Revenue by agent</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={rows}>
              <CartesianGrid stroke="#334155" strokeDasharray="3 3" />
              <XAxis dataKey="Agent" tick={AX} />
              <YAxis tick={AX} />
              <Tooltip {...tooltipStyle} formatter={(v) => money(v)} />
              <Bar dataKey="Revenue" radius={[4, 4, 0, 0]}>
                {rows.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="panel">
          <h3>Conversion % by agent</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={rows}>
              <CartesianGrid stroke="#334155" strokeDasharray="3 3" />
              <XAxis dataKey="Agent" tick={AX} />
              <YAxis tick={AX} />
              <Tooltip {...tooltipStyle} formatter={(v) => v.toFixed(1) + "%"} />
              <Bar dataKey="Conversion" fill="#10b981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="panel">
        <h3>Agent table <span className="muted" style={{ fontWeight: 400 }}>(header click kore sort)</span></h3>
        <div style={{ overflowX: "auto" }}>
          <table>
            <thead>
              <tr>
                {["Agent", "Leads", "Connected", "Orders", "Contact", "Conversion", "Revenue", "AvgOrder", "Discount"]
                  .map((h) => <th key={h} onClick={() => setSortKey(h)}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.Agent}>
                  <td>{r.Agent}</td>
                  <td className="right">{r.Leads}</td>
                  <td className="right">{r.Connected}</td>
                  <td className="right">{r.Orders}</td>
                  <td className="right">{r.Contact.toFixed(0)}%</td>
                  <td className="right">
                    <span className={"badge " + (r.Conversion >= 8 ? "good" : "warn")}>
                      {r.Conversion.toFixed(1)}%</span>
                  </td>
                  <td className="right">{money(r.Revenue)}</td>
                  <td className="right">{money(r.AvgOrder)}</td>
                  <td className="right">{money(r.Discount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button className="btn" style={{ marginTop: 12 }}
          onClick={() => downloadCsv(rows, "agent_performance.csv")}>⬇️ Export CSV</button>
      </div>
    </>
  );
}

/* -------------------------------------------------------------- PRODUCTS */
function Products({ leads, orders }) {
  const mix = useMemo(
    () => groupSum(orders, "product", (o) => +o.net_revenue || 0)
      .sort((a, b) => b.value - a.value).slice(0, 10), [orders]);

  const sugg = useMemo(() => {
    const map = {};
    leads.forEach((l) => (l.product_sugg || "").split(",").forEach((p) => {
      const k = p.trim(); if (k) map[k] = (map[k] || 0) + 1;
    }));
    return Object.entries(map).map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value).slice(0, 12);
  }, [leads]);

  const obj = useMemo(() => {
    const map = {};
    leads.forEach((l) => { const k = (l.objection || "").trim(); if (k) map[k] = (map[k] || 0) + 1; });
    return Object.entries(map).map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [leads]);

  return (
    <>
      <div className="grid2">
        <div className="panel" style={{ marginTop: 0 }}>
          <h3>Product mix (revenue)</h3>
          <ResponsiveContainer width="100%" height={320}>
            <PieChart>
              <Tooltip {...tooltipStyle} formatter={(v) => money(v)} />
              <Pie data={mix} dataKey="value" nameKey="name" innerRadius={60}
                outerRadius={110} paddingAngle={2}>
                {mix.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Legend wrapperStyle={{ fontSize: 11, color: "#94a3b8" }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="panel" style={{ marginTop: 0 }}>
          <h3>Product suggestion frequency (leads)</h3>
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={sugg} layout="vertical" margin={{ left: 20, right: 20 }}>
              <CartesianGrid stroke="#334155" strokeDasharray="3 3" />
              <XAxis type="number" tick={AX} />
              <YAxis type="category" dataKey="name" tick={AX} width={150} />
              <Tooltip {...tooltipStyle} />
              <Bar dataKey="value" fill="#06b6d4" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="panel">
        <h3>Objection type breakdown</h3>
        {obj.length ? (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={obj} layout="vertical" margin={{ left: 20, right: 20 }}>
              <CartesianGrid stroke="#334155" strokeDasharray="3 3" />
              <XAxis type="number" tick={AX} />
              <YAxis type="category" dataKey="name" tick={AX} width={180} />
              <Tooltip {...tooltipStyle} />
              <Bar dataKey="value" fill="#ef4444" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : <div className="muted">Kono objection log kora hoyni.</div>}
      </div>
    </>
  );
}

/* ------------------------------------------------------------- GEOGRAPHY */
function Geography({ leads, orders, districts, selDist, setDist }) {
  const dist = useMemo(() => {
    const map = {};
    orders.forEach((o) => {
      const k = (o.district || "").trim(); if (!k) return;
      map[k] = map[k] || { name: k, Revenue: 0, Orders: 0 };
      map[k].Revenue += +o.net_revenue || 0; map[k].Orders++;
    });
    return Object.values(map).sort((a, b) => b.Revenue - a.Revenue);
  }, [orders]);

  const occ = useMemo(() => topCounts(leads, "occupation", 12), [leads]);
  const cls = useMemo(() => topCounts(leads, "class", 15), [leads]);
  const seg = useMemo(() => {
    const map = {};
    leads.forEach((l) => (l.parent_type || "").split(",").forEach((p) => {
      const k = p.trim(); if (k) map[k] = (map[k] || 0) + 1;
    }));
    return Object.entries(map).map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [leads]);

  return (
    <>
      <div className="panel" style={{ marginTop: 0 }}>
        <h3>District filter</h3>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {districts.map((d) => (
            <button key={d}
              className={"tab" + (selDist.includes(d) ? " active" : "")}
              style={{ padding: "5px 10px", fontSize: 12 }}
              onClick={() => setDist(d)}>{d}</button>
          ))}
        </div>
      </div>

      <div className="grid2">
        <div className="panel">
          <h3>District-wise revenue</h3>
          <ResponsiveContainer width="100%" height={360}>
            <BarChart data={dist} layout="vertical" margin={{ left: 20, right: 20 }}>
              <CartesianGrid stroke="#334155" strokeDasharray="3 3" />
              <XAxis type="number" tick={AX} />
              <YAxis type="category" dataKey="name" tick={AX} width={110} />
              <Tooltip {...tooltipStyle} formatter={(v) => money(v)} />
              <Bar dataKey="Revenue" radius={[0, 4, 4, 0]}>
                {dist.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="panel">
          <h3>Parent occupation (leads)</h3>
          <ResponsiveContainer width="100%" height={360}>
            <BarChart data={occ} layout="vertical" margin={{ left: 20, right: 20 }}>
              <CartesianGrid stroke="#334155" strokeDasharray="3 3" />
              <XAxis type="number" tick={AX} />
              <YAxis type="category" dataKey="name" tick={AX} width={130} />
              <Tooltip {...tooltipStyle} />
              <Bar dataKey="value" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid2">
        <div className="panel">
          <h3>Student class / grade (leads)</h3>
          <ResponsiveContainer width="100%" height={340}>
            <BarChart data={cls} layout="vertical" margin={{ left: 20, right: 20 }}>
              <CartesianGrid stroke="#334155" strokeDasharray="3 3" />
              <XAxis type="number" tick={AX} />
              <YAxis type="category" dataKey="name" tick={AX} width={120} />
              <Tooltip {...tooltipStyle} />
              <Bar dataKey="value" fill="#14b8a6" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="panel">
          <h3>Parent type / segment (leads)</h3>
          {seg.length ? (
            <ResponsiveContainer width="100%" height={340}>
              <BarChart data={seg} layout="vertical" margin={{ left: 20, right: 20 }}>
                <CartesianGrid stroke="#334155" strokeDasharray="3 3" />
                <XAxis type="number" tick={AX} />
                <YAxis type="category" dataKey="name" tick={AX} width={140} />
                <Tooltip {...tooltipStyle} />
                <Bar dataKey="value" fill="#f59e0b" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <div className="muted">Segment data nei.</div>}
        </div>
      </div>
    </>
  );
}

function topCounts(rows, key, n) {
  const map = {};
  rows.forEach((r) => { const k = (r[key] || "").trim(); if (k) map[k] = (map[k] || 0) + 1; });
  return Object.entries(map).map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value).slice(0, n);
}

function downloadCsv(rows, filename) {
  if (!rows.length) return;
  const keys = Object.keys(rows[0]);
  const csv = [keys.join(",")]
    .concat(rows.map((r) => keys.map((k) =>
      `"${String(r[k]).replace(/"/g, '""')}"`).join(",")))
    .join("\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = filename; a.click();
}
