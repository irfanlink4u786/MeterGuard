import highBillActions from './MeterGuardHighBillingActions2026.json';
import tddSites from './MeterGuardTDD2026.json';
import MeterGuardFieldInvestigations from './MeterGuardFieldInvestigations';
import hqHistoryFallback from './MeterGuardHQHistory2026.json';
/// <reference types="vite/client" />
import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Search, Download, X, ChevronRight } from 'lucide-react';

const env = import.meta.env;
const db = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_ANON_KEY);
type R = { site_id: string; grid: string; revenue: string; owner: string; final_reason: string; verification: string; hb_months: string; action_category: string; management_action: string; field_remarks: string; hq_locked: string; rms_criteria: string; aug_vs_rms: string; [key: string]: string | null | undefined };
const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const monthName = (m: string) => m.charAt(0).toUpperCase() + m.slice(1);
const num = (x: unknown): number | null => x === null || x === undefined || String(x).trim() === '' ? null : Number.isFinite(Number(x)) ? Number(x) : null;
const fmt = (x: number | null | undefined) => x == null || !Number.isFinite(x) ? '—' : Math.round(x).toLocaleString('en-US');
const pct = (x: number | null) => x === null || !Number.isFinite(x) ? '—' : `${x >= 0 ? '+' : ''}${x.toFixed(1)}%`;
const average = (a: number[]) => a.length ? a.reduce((s, x) => s + x, 0) / a.length : null;
const unit = (r: R, m: string) => num(r[`${m}_units`]);
const baselineMonths = (m: string) => { const i = months.indexOf(m); return i < 4 ? [] : months.slice(i - 4, i); };
const baseline = (r: R, m: string): number | null => { const vals = baselineMonths(m).map(x => unit(r, x)); return vals.length === 4 && vals.every(v => v !== null) ? (vals as number[]).reduce((s, v) => s + v, 0) / 4 : null; };
const excess = (r: R, m: string) => { const a = unit(r, m), b = baseline(r, m); return a === null || b === null ? null : a - b; };
const growth = (r: R, m: string) => { const a = excess(r, m), b = baseline(r, m); return a === null || b === null || b === 0 ? null : 100 * a / b; };
const hasPair = (r: R, m: string) => baseline(r, m) !== null && unit(r, m) !== null;
const isHigh = (r: R, m: string) => String(r[`${m}_flag`] || '').toLowerCase() === 'high bill';
const actionMap=new Map((highBillActions as Array<{site_id:string;grid:string;months:string[];primary_reason:string}>).filter(x=>x.grid.startsWith('C6')&&x.months.some(m=>['2026-06','2026-07','2026-08'].includes(m))).map(x=>[x.site_id,x.primary_reason]));
const actionReasonLabel:Record<string,string>={theft:'CP Theft',meter:'Faulty Meter',excess:'Excessive Units Charged',criteria:'Criteria Revision',suspected:'Suspected CP Theft'};
const reasonOf = (r: R) => (actionReasonLabel[actionMap.get(r.site_id)||''] || `${r.action_category || ''} ${r.final_reason || ''}`).toLowerCase();
const isCriteriaRevision=(r:R)=>/criteria revision|criterion revision|criteria revis/i.test(reasonOf(r));
const tddIds=new Set((tddSites as Array<{site_id:string}>).map(x=>String(x.site_id).trim()));
const reasonGroup = (r: R) => { const action=actionMap.get(r.site_id);if(action)return action==='theft'?'CP Theft':action==='meter'?'Faulty Meter':action==='criteria'?'Load / RMS':action==='excess'?'Excessive Units Charged':'Suspected CP Theft';const s=reasonOf(r);return s.includes('theft')?'CP Theft':/faulty meter|meter faulty|meter fault/.test(s)?'Faulty Meter':s.includes('rms')||s.includes('load')?'Load / RMS':'Other / Unverified'; };
const tabs = ['Executive Overview', 'Consumption History', 'CP Theft', 'Faulty Meter', 'Criteria Revision', 'TDD Sites', 'RMS vs Billing', 'Field Investigations', 'HQ High Billing History'] as const;
type Tab = typeof tabs[number];
type HQ = { site_id:string; bill_month:string; grid:string|null; billed_units:number|null; bill_amount:number|null; final_criteria_kwh:number|null; excessive_units:number|null; variance_pct:number|null; site_category:string|null; };
const historyMonths = months.slice(0,8);

const C = { green: '#116d4e', teal: '#178c71', red: '#c9573d', amber: '#c58a26', blue: '#3178b9', ink: '#153c32', muted: '#6b847a', border: '#dcebe6', bg: '#f6faf8' };
const card: React.CSSProperties = { background: '#fff', border: `1px solid ${C.border}`, borderRadius: 14, padding: 17, boxShadow: '0 4px 15px #143d3210' };
const btn: React.CSSProperties = { border: '1px solid #c7ddd2', background: '#fff', borderRadius: 8, padding: '9px 12px', cursor: 'pointer', color: C.ink };
const td: React.CSSProperties = { padding: '11px 10px', whiteSpace: 'nowrap' };
const th: React.CSSProperties = { ...td, textAlign: 'left', background: '#eaf4ef', color: '#587b6d', fontSize: 11, letterSpacing: '.025em' };

function BubbleChart({ rows, month, onSelect }: { rows: R[]; month: string; onSelect: (r: R) => void }) {
  const [hover, setHover] = useState<string | null>(null);
  const labelsCount = 3;
  const [mode, setMode] = useState<'excess' | 'units'>('excess');
  const [zoom, setZoom] = useState<'all' | 'core'>('all');
  const points = useMemo(() => rows.filter(r => hasPair(r, month)).map(r => ({ r, x: baseline(r, month)!, y: unit(r, month)!, d: excess(r, month)!, p: growth(r, month) })).sort((a, b) => a.y - b.y), [rows, month]);
  const ranked = useMemo(() => [...points].filter(p => p.d > 0).sort((a, b) => b.d - a.d || b.y - a.y), [points]);
  const labeled = useMemo(() => ranked.slice(0, labelsCount), [ranked, labelsCount]);
  const quantile = (vals: number[], q: number) => { const sorted = [...vals].sort((a,b)=>a-b); return sorted[Math.min(sorted.length-1, Math.floor(sorted.length*q))] || 1; };
  const maxX = zoom === 'core' ? quantile(points.map(p=>p.x), .95)*1.12 : Math.max(1, ...points.map(p => p.x)) * 1.12;
  const maxY = zoom === 'core' ? quantile(points.map(p=>p.y), .95)*1.12 : Math.max(1, ...points.map(p => p.y)) * 1.15;
  const visible = points.filter(p=>p.x<=maxX && p.y<=maxY);
  const W = 1040, H = 480, left = 72, top = 32, right = 24, bottom = 56;
  const pw = W - left - right, ph = H - top - bottom;
  const xx = (v: number) => left + v / maxX * pw;
  const yy = (v: number) => top + ph - v / maxY * ph;
  const radius = (p: typeof points[number]) => mode === 'units' ? 2.8 + 8 * Math.sqrt(p.y / maxY) : 2.8 + 8 * Math.sqrt(Math.max(0, p.d) / Math.max(1, ranked[0]?.d || 1));
  const color = (p: typeof points[number]) => p.d <= 0 ? C.teal : p.p !== null && p.p >= 50 ? C.red : p.p !== null && p.p >= 20 ? C.amber : C.blue;
  // Greedy labels: only top excess outliers, try multiple placements to avoid collisions.
  const placed = useMemo(() => {
    const boxes: { x: number; y: number; w: number; h: number }[] = [];
    return labeled.filter(p=>p.x<=maxX && p.y<=maxY).flatMap(p => {
      const cx = xx(p.x), cy = yy(p.y), label = `${p.r.site_id} · ${fmt(p.y)}`, w = Math.max(75, label.length * 7 + 14), h = 23;
      const tries = [[12, -36], [-w - 12, -36], [12, 14], [-w - 12, 14], [-w / 2, -48], [-w / 2, 22], [16, -12], [-w - 16, -12]];
      let found = { x: Math.max(left, Math.min(W - right - w, cx + 12)), y: Math.max(top, cy - 35), w, h };
      for (const [dx, dy] of tries) {
        const b = { x: Math.max(left, Math.min(W - right - w, cx + dx)), y: Math.max(2, Math.min(H - bottom - h, cy + dy)), w, h };
        if (!boxes.some(a => b.x < a.x + a.w + 3 && b.x + b.w + 3 > a.x && b.y < a.y + a.h + 3 && b.y + b.h + 3 > a.y)) { found = b; break; }
      }
      if (boxes.some(a => found.x < a.x+a.w+7 && found.x+found.w+7 > a.x && found.y < a.y+a.h+7 && found.y+found.h+7 > a.y)) return [];
      boxes.push(found);
      return [{ p, ...found, label, cx, cy }];
    });
  }, [labeled, maxX, maxY]);
  const focused = points.find(p => p.r.site_id === hover);
  return <div style={{ ...card, minWidth: 0 }}>
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
      <div><h3 style={{ margin: 0 }}>Site consumption outlier map</h3><small style={{ color: C.muted }}>All {points.length} sites with complete comparison · Only top 3 excess-unit outliers labeled; hover over any other bubble</small></div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}><select style={btn} value={mode} onChange={e => setMode(e.target.value as 'excess' | 'units')}><option value="excess">Bubble size: Excess units</option><option value="units">Bubble size: Current units</option></select><select style={btn} value={zoom} onChange={e=>setZoom(e.target.value as 'all'|'core')}><option value="all">All sites · full scale</option><option value="core">Zoom · typical sites (95%)</option></select></div>
    </div>
    <div style={{ overflowX: 'auto', marginTop: 10 }}><svg viewBox={`0 0 ${W} ${H}`} style={{ display: 'block', width: '100%', minWidth: 660 }} role="img" aria-label="Scatter plot of all sites, previous four-month average against current billed units">
      <rect x={left} y={top} width={pw} height={ph} fill="#f8fbf9" rx="8" />
      {Array.from({ length: 6 }, (_, i) => { const y = top + ph * i / 5, v = maxY * (5 - i) / 5; return <g key={`y${i}`}><line x1={left} y1={y} x2={W - right} y2={y} stroke="#dcebe6" strokeDasharray="4 4"/><text x={left - 10} y={y + 4} fontSize="12" textAnchor="end" fill={C.muted}>{fmt(v)}</text></g>; })}
      {Array.from({ length: 6 }, (_, i) => { const x = left + pw * i / 5; return <g key={`x${i}`}><line x1={x} y1={top} x2={x} y2={top + ph} stroke="#e4eee9" strokeDasharray="4 4"/><text x={x} y={H - bottom + 20} fontSize="12" textAnchor="middle" fill={C.muted}>{fmt(maxX * i / 5)}</text></g>; })}
      <line x1={xx(0)} y1={yy(0)} x2={xx(Math.min(maxX, maxY))} y2={yy(Math.min(maxX, maxY))} stroke={C.green} strokeWidth="2" strokeDasharray="8 6" />
      {visible.map(p => <circle key={p.r.site_id} cx={xx(p.x)} cy={yy(p.y)} r={radius(p)} fill={color(p)} fillOpacity={hover === p.r.site_id ? 1 : .38} stroke={hover === p.r.site_id ? C.ink : '#fff'} strokeWidth={hover === p.r.site_id ? 2 : .7} style={{ cursor: 'pointer' }} onMouseEnter={() => setHover(p.r.site_id)} onMouseLeave={() => setHover(null)} onClick={() => onSelect(p.r)}><title>{`Site ${p.r.site_id} | ${p.r.grid}\n4-month average: ${fmt(p.x)}\n${monthName(month)}: ${fmt(p.y)}\nExcess: ${fmt(p.d)} (${pct(p.p)})\nClick to view history`}</title></circle>)}
      {placed.map(({ p, x, y, w, h, label, cx, cy }) => <g key={p.r.site_id} onClick={() => onSelect(p.r)} style={{ cursor: 'pointer' }}><line x1={cx} y1={cy} x2={x + w / 2} y2={y + h / 2} stroke={C.red} strokeOpacity=".55"/><rect x={x} y={y} width={w} height={h} rx="5" fill={C.red} fillOpacity=".95" stroke="white"/><text x={x + w / 2} y={y + 15} textAnchor="middle" fontSize="12" fontWeight="700" fill="white">{label}</text></g>)}
      <text x={left + pw / 2} y={H - 10} fontSize="14" textAnchor="middle" fill={C.ink}>Previous four-month average billed units (kWh)</text><text transform={`translate(18 ${top + ph / 2}) rotate(-90)`} fontSize="14" textAnchor="middle" fill={C.ink}>{monthName(month)} billed units (kWh)</text>
    </svg></div>
    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', color: C.muted, fontSize: 12 }}>{[['#178c71', 'No increase'], ['#3178b9', 'Increase below 20%'], ['#c58a26', 'Increase 20–49.9%'], ['#c9573d', 'Increase ≥50%']].map(([c, l]) => <span key={l}><span style={{ color: c, fontSize: 17 }}>●</span> {l}</span>)}</div>
    {focused && <div style={{ background: '#f0f8f3', padding: 11, marginTop: 10, borderRadius: 8, fontSize: 13 }}><b>Site {focused.r.site_id} · {focused.r.grid}</b> — 4M avg {fmt(focused.x)} · {monthName(month)} {fmt(focused.y)} · excess {fmt(focused.d)} ({pct(focused.p)}) · Click bubble for details</div>}
    <small style={{ color: C.muted }}>The green diagonal means unchanged consumption. Sites above it increased. Only the top 3 excess-unit sites have permanent labels; hover for all other sites. Use zoom to inspect the dense cluster and hover for individual sites.</small>
  </div>;
}

export default function MeterGuardBillingDashboard() {
  const [data, setData] = useState<R[]>([]);
  const [liveBilling, setLiveBilling] = useState<Array<{site_id:string;grid:string|null;billed_month:string;total_units:number|null}>>([]);
  const [billingError, setBillingError] = useState('');
  const [hqRows, setHqRows] = useState<HQ[]>(hqHistoryFallback as HQ[]);
  const [hqError, setHqError] = useState('');
  const [hqSite, setHqSite] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('Executive Overview');
  const [grid, setGrid] = useState('All');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<R | null>(null);
  const [selectedGrid, setSelectedGrid] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [metric, setMetric] = useState('All');
  const [month, setMonth] = useState('aug');
  const [provisional, setProvisional] = useState(false);
  useEffect(() => {
    let active = true;
    (async () => {
      const records: Array<{site_id:string;grid:string|null;billed_month:string;total_units:number|null}> = [];
      for (let offset = 0; offset < 25000; offset += 1000) {
        const {data: batch, error: e} = await db.from('cp_billing_history')
          .select('site_id,grid,billed_month,total_units')
          .order('site_id').order('billed_month').range(offset, offset + 999);
        if (!active) return;
        if (e) { setBillingError(e.message); return; }
        records.push(...((batch || []) as typeof records));
        if (!batch || batch.length < 1000) break;
      }
      if (active) {setLiveBilling(records);setBillingError('');}
    })();
    return () => { active = false; };
  }, []);
  useEffect(() => { let alive = true; (async () => { const { data: result, error: e } = await db.from('mg_c6_billing').select('*').order('site_id').limit(5000); if (!alive) return; setData((result || []) as R[]); setError(e?.message || ''); setLoading(false); })(); return () => { alive = false; }; }, []);
  useEffect(() => { let alive = true; (async () => {
    const collected: HQ[] = [];
    for (let offset=0;offset<10000;offset+=1000) {
      const {data: batch,error:e} = await db.from('mg_hq_high_billing_2026').select('site_id,bill_month,grid,billed_units,bill_amount,final_criteria_kwh,excessive_units,variance_pct,site_category').order('bill_month').order('site_id').range(offset,offset+999);
      if(e){if(alive)setHqError(e.message);return;}
      collected.push(...((batch||[]) as HQ[]));
      if((batch||[]).length<1000)break;
    }
    if(alive && collected.length)setHqRows(collected);
  })();return()=>{alive=false}; }, []);
  const hqForMonth = (m:string) => hqRows.filter(r=>/^C6\d{3}$/.test(String(r.grid||'')) && r.bill_month.startsWith(`2026-${String(months.indexOf(m)+1).padStart(2,'0')}`) && (grid==='All'||r.grid===grid));
  const siteHq = (site:string) => hqRows.filter(r=>/^C6\d{3}$/.test(String(r.grid||'')) && r.site_id===site).sort((a,b)=>a.bill_month.localeCompare(b.bill_month));
  const effectiveUnits = (r:R,m:string) => unit(r,m) ?? (hqRows.find(h=>h.site_id===r.site_id && h.bill_month.startsWith(`2026-${String(months.indexOf(m)+1).padStart(2,'0')}`))?.billed_units ?? null);
  const eligibleData = useMemo(() => {
    // cp_billing_history is the authoritative billing site universe. Supabase provides investigation metadata.
    const byId = new Map<string, R>();
    // Live Supabase history is authoritative. C-6 only; metadata is merged below.
    for (const bill of liveBilling) {
      const site_id = String(bill.site_id || '').trim();
      const g = String(bill.grid || '').trim().toUpperCase();
      if (!site_id || !/^C6\d{3}$/.test(g)) continue;
      let item = byId.get(site_id);
      if (!item) {
        item = {site_id,grid:g,revenue:'',owner:'',final_reason:'',verification:'',hb_months:'',action_category:'',management_action:'',field_remarks:'',hq_locked:'',rms_criteria:'',aug_vs_rms:''} as R;
        byId.set(site_id,item);
      }
      // Monthly columns represent calendar 2026; September–December 2025
      // remain in cp_billing_history and are available to the Overview.
      const date = String(bill.billed_month || '');
      if (date.startsWith('2026-')) {
        const index = Number(date.slice(5,7)) - 1;
        if (index >= 0 && index < 12) item[`${months[index]}_units`] = bill.total_units == null ? null : String(bill.total_units);
      }
    }
    for (const r of data) {
      const key = String(r.site_id || '').trim();
      if (!key || ['C2006', 'C2009'].includes(String(r.grid || '').trim().toUpperCase())) continue;
      const master = byId.get(key);
      if (master) {
        // Preserve original ABS units and grid; retain HQ/investigation metadata.
        byId.set(key, { ...r, ...master,
          revenue: r.revenue || '', owner: r.owner || '', final_reason: r.final_reason || '',
          verification: r.verification || '', hb_months: r.hb_months || '',
          action_category: r.action_category || '', management_action: r.management_action || '',
          field_remarks: r.field_remarks || '', hq_locked: r.hq_locked || '',
          rms_criteria: r.rms_criteria || '', aug_vs_rms: r.aug_vs_rms || '',
        });
      }
    }
    return [...byId.values()].filter(r => /^C6\d{3}$/.test(String(r.grid || '').trim().toUpperCase()));
  }, [data, liveBilling]);
  const grids = useMemo(() => [...new Set(eligibleData.map(r => r.grid).filter((g): g is string => !!g))].sort(), [eligibleData]);
  const scope = useMemo(() => eligibleData.filter(r => grid === 'All' || r.grid === grid), [eligibleData, grid]);
  const base = useMemo(() => scope.filter(r => tab === 'CP Theft' ? actionMap.get(r.site_id) === 'theft' : tab === 'Faulty Meter' ? actionMap.get(r.site_id) === 'meter' : tab === 'Criteria Revision' ? actionMap.get(r.site_id) === 'criteria' : tab === 'TDD Sites' ? tddIds.has(r.site_id) : true), [scope, tab]);
  const coverage = useMemo(() => months.map(m => ({ m, n: eligibleData.filter(r => unit(r, m) !== null).length, comparable: eligibleData.filter(r => hasPair(r, m)).length })), [eligibleData]);
  const monthCoverage = coverage.find(x => x.m === month);
  const incomplete = monthCoverage ? monthCoverage.n < eligibleData.length : true;
  const paired = useMemo(() => base.filter(r => hasPair(r, month)), [base, month]);
  const prevAvg = average(paired.map(r => baseline(r, month)!));
  const currentAvg = average(paired.map(r => unit(r, month)!));
  const change = prevAvg !== null && prevAvg !== 0 && currentAvg !== null ? 100 * (currentAvg - prevAvg) / prevAvg : null;
  const highCount = base.filter(r => isHigh(r, month)).length;
  const totalExcess = paired.reduce((s, r) => s + (excess(r, month) || 0), 0);
  const positiveExcess = paired.reduce((s, r) => s + Math.max(0, excess(r, month) || 0), 0);
  const top = useMemo(() => [...paired].filter(r => (excess(r, month) || 0) > 0).sort((a, b) => (excess(b, month) || 0) - (excess(a, month) || 0)), [paired, month]);
  const reasons = useMemo(() => ['CP Theft', 'Faulty Meter', 'Load / RMS', 'Other / Unverified'].map(name => ({ name, rows: base.filter(r => reasonGroup(r) === name), excess: base.filter(r => reasonGroup(r) === name).reduce((s, r) => s + Math.max(0, excess(r, month) || 0), 0) })), [base, month]);
  const rows = useMemo(() => base.filter(r => (!search || [r.site_id, r.grid, r.owner, r.final_reason].some(v => String(v || '').toLowerCase().includes(search.toLowerCase()))) && (metric === 'All' || (metric === 'High Bill' && isHigh(r, month)) || (metric === 'Increase' && (excess(r, month) || 0) > 0) || (metric === 'Incomplete' && !hasPair(r, month)) || (metric === 'August Above RMS' && (num(r.aug_vs_rms) || 0) > 0))).sort((a, b) => (excess(b, month) ?? -Infinity) - (excess(a, month) ?? -Infinity)), [base, search, metric, month]);
  const kpis = [
    { name: 'C-6 Unique Billing Sites (All Months)', value: String(scope.length), sub: 'Distinct site IDs across all available months · excludes C2006/C2009', filter: 'All' },
    { name: '4-Month Baseline Avg', value: fmt(prevAvg), sub: baselineMonths(month).map(monthName).join('–') + ' · matched sites', filter: 'All' },
    { name: `${monthName(month)} Avg Units`, value: fmt(currentAvg), sub: `${pct(change)} vs 4-month baseline`, filter: 'All' },
    { name: 'High-Bill Flags', value: String(highCount), sub: 'Not confirmed theft', filter: 'High Bill' },
    { name: 'Positive Excess Units', value: fmt(positiveExcess), sub: 'Sum of positive site deviations', filter: 'Increase' },
  ];
  function exportCsv() {
    const fields = ['site_id', 'grid', 'owner', 'final_reason', ...baselineMonths(month).map(m => `${m}_units`), `${month}_units`, 'four_month_avg', 'excess_units', 'increase_pct', 'rms_criteria', 'hq_locked', 'management_action'];
    const csv = [fields.join(','), ...rows.map(r => fields.map(k => { const v = k === 'four_month_avg' ? baseline(r, month) : k === 'excess_units' ? excess(r, month) : k === 'increase_pct' ? growth(r, month) : r[k]; return '"' + String(v ?? '').replace(/"/g, '""') + '"'; }).join(','))].join('\r\n');
    const a = document.createElement('a'), url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })); a.href = url; a.download = `MeterGuard_${month}_2026_${tab.replace(/ /g, '_')}.csv`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return <div style={{ display: 'grid', gap: 18, color: C.ink, minWidth: 0 }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}><div><h2 style={{ margin: '0 0 5px' }}>Central-6 Electricity Billing Intelligence</h2><div style={{ color: C.muted, fontSize: 13 }}>Rolling 4-month comparison · Site-level outlier investigation · 2026</div></div><button onClick={exportCsv} style={{ ...btn, display: 'flex', alignItems: 'center', gap: 7, color: C.green, fontWeight: 700 }}><Download size={15}/> Export filtered CSV</button></div>
    <div style={{...card,borderLeft:`5px solid ${C.blue}`}}><b>Billing coverage — unique sites across all available months</b><div style={{display:'flex',gap:20,flexWrap:'wrap',marginTop:7}}><span><b>{eligibleData.length.toLocaleString()}</b> distinct C-6 sites in history</span><span><b>{eligibleData.filter(r=>unit(r,'aug')!==null).length.toLocaleString()}</b> August sites billed</span><span><b>{eligibleData.length-eligibleData.filter(r=>unit(r,'aug')!==null).length}</b> historical sites without August record</span><span><b>C2006 / C2009</b> excluded</span></div><small style={{color:C.muted}}>Newly on-air sites remain in the historical universe. Monthly billed-site counts vary; missing months are not treated as zero or as consumption anomalies.</small></div>
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{tabs.map(t => <button key={t} onClick={() => { setTab(t); setMetric('All'); }} style={{ ...btn, background: tab === t ? C.green : '#fff', color: tab === t ? '#fff' : C.ink, fontWeight: 750 }}>{t}</button>)}</div>
    <div style={{ ...card, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}><label style={{ fontSize: 13, fontWeight: 700 }}>Reporting month <select style={{ ...btn, marginLeft: 8 }} value={month} onChange={e => { setMonth(e.target.value); setMetric('All'); setProvisional(false); }}>{coverage.filter(x => x.n > 0).map(x => <option key={x.m} value={x.m}>{monthName(x.m)} 2026 · {x.n} sites billed</option>)}</select></label><span style={{ fontSize: 12, color: C.muted }}>Baseline: {baselineMonths(month).map(monthName).join(', ')} · Complete matched sites: {paired.length}</span>{incomplete && <span style={{ color: '#a36b13', fontSize: 12, fontWeight: 700 }}>Not all historical sites billed this month — review coverage</span>}{incomplete && <label style={{ fontSize: 12 }}><input type="checkbox" checked={provisional} onChange={e => setProvisional(e.target.checked)}/> Show management findings with partial-month coverage</label>}</div>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(175px,1fr))', gap: 12 }}>{kpis.map((k, i) => <button key={k.name} onClick={() => { setMetric(k.filter); if (k.filter === 'Incomplete') setTab('Consumption History'); }} style={{ ...card, textAlign: 'left', cursor: 'pointer', borderTop: `4px solid ${[C.green, C.blue, C.teal, C.amber, C.red][i]}` }}><div style={{ fontSize: 12, color: C.muted, fontWeight: 700 }}>{k.name}</div><div style={{ fontSize: 25, fontWeight: 850, marginTop: 9 }}>{k.value}</div><small style={{ color: C.muted }}>{k.sub}</small></button>)}</div>
    <div style={{ ...card, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}><label>Grid <select value={grid} onChange={e => setGrid(e.target.value)} style={{ ...btn, marginLeft: 8 }}><option>All</option>{grids.map(g => <option key={g}>{g}</option>)}</select></label><label style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Search size={17}/><input placeholder="Site ID, owner, reason" value={search} onChange={e => setSearch(e.target.value)} style={btn}/></label><button onClick={() => { setMetric('All'); setSearch(''); setGrid('All'); }} style={btn}>Clear filters</button><span style={{ marginLeft: 'auto', fontSize: 12, color: C.muted }}>{rows.length} sites visible</span></div>
    {loading ? <p>Loading Supabase billing records…</p> : error ? <p style={{ color: C.red }}>Database: {error}</p> : !data.length ? <p>ABS history is available. Supabase investigation metadata has not been imported yet.</p> : null}
    {tab === 'Field Investigations' && <MeterGuardFieldInvestigations/>}
    {tab === 'Executive Overview' && <>
      <div style={{...card,borderLeft:`5px solid ${C.green}`}}>
        <h2 style={{margin:'0 0 8px'}}>MeterGuard Objective — Detect and Resolve High Billing Before Month-End</h2>
        <p style={{margin:'0 0 12px',lineHeight:1.65}}>Convert HQ monthly high-billing alerts into immediate field action. Measure actual hourly electricity use from two timestamped meter readings, verify the meter and telecom load, document suspected unauthorized consumption or legitimate criteria changes, and confirm the result after corrective action — without waiting for the next electricity bill.</p>
        <h3 style={{margin:'0 0 10px'}}>Management action flow</h3>
        <div style={{display:'flex',gap:7,alignItems:'stretch',flexWrap:'wrap'}}>{[
          ['01','HQ flags high billing','Jan–Aug historical exposure'],
          ['02','Region prioritizes','Grid, excess kWh and repeat flags'],
          ['03','Field verifies hourly use','Previous/current meter readings'],
          ['04','Diagnose the cause','Meter test • theft evidence • OMO/CSU load'],
          ['05','Ticket and approve','Suspected theft / meter / criteria revision'],
          ['06','Monitor after action','Verify consumption reduction or revised baseline']
        ].map((x,i)=><div key={x[0]} style={{flex:'1 1 150px',minWidth:145,background:i%2?'#eaf4f8':'#edf7ef',border:`1px solid ${C.border}`,padding:12,borderRadius:10}}><b style={{fontSize:12,color:C.green}}>STEP {x[0]}</b><div style={{fontWeight:800,margin:'5px 0'}}>{x[1]}</div><small style={{color:C.muted}}>{x[2]}</small></div>)}</div>
        <p style={{fontSize:12,color:C.muted,marginBottom:0}}>Decision principle: an excess meter reading triggers investigation, not an automatic theft conclusion. Every closure requires dated evidence and follow-up verification.</p>
      </div>
      <div style={card}>
        <h3 style={{margin:'0 0 5px'}}>January–August 2026 · Complete billing and HQ flag overview</h3>
        <p style={{fontSize:12,color:C.muted}}>Billed units from site billing history; January/February values are available only for sites listed in the HQ report where the main billing table has no reading. HQ flags are separate monthly records, not confirmed theft.</p>
        {hqError&&<p style={{color:C.red}}>Live HQ database not accessible: {hqError}. Showing the bundled HQ source records until database import and access are completed.</p>}
        <div style={{overflowX:'auto'}}><table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}><thead><tr>{['Month','Sites with billed units','Billed units (kWh)','Avg / billed site','HQ high-billing flags','HQ excess units','HQ bill amount','HQ flagged sites · View'].map(x=><th key={x} style={th}>{x}</th>)}</tr></thead><tbody>{historyMonths.map((m,i)=>{
          const sites=scope.filter(r=>effectiveUnits(r,m)!==null);const hq=hqForMonth(m);
          const billed=sites.reduce((s,r)=>s+(effectiveUnits(r,m)||0),0);
          return <tr key={m} style={{background:i%2?C.bg:'#fff'}}><td style={{...td,fontWeight:800}}>{monthName(m)} 2026</td><td style={td}>{sites.length}/{scope.length}</td><td style={td}>{sites.length?fmt(billed):'—'}</td><td style={td}>{sites.length?fmt(billed/sites.length):'—'}</td><td style={{...td,fontWeight:800,color:C.red}}>{hq.length}</td><td style={td}>{fmt(hq.reduce((s,r)=>s+(r.excessive_units||0),0))}</td><td style={td}>{fmt(hq.reduce((s,r)=>s+(r.bill_amount||0),0))}</td><td style={td}><button style={btn} onClick={()=>{setTab('HQ High Billing History');setMonth(m)}}>View {monthName(m)} HQ</button></td></tr>})}</tbody></table></div>
        <small style={{color:C.muted}}>Billing coverage reflects sites in the existing MeterGuard site universe. HQ counts reflect the uploaded HQ report; totals are not extrapolated for missing sites.</small>
      </div>
      <div style={card}><h3 style={{marginTop:0}}>Management Intelligence · {monthName(month)} 2026</h3>{incomplete && !provisional ? <p style={{color:'#a36b13'}}>Billing for {monthName(month)} is incomplete ({monthCoverage?.n||0}/{eligibleData.length} sites). Select provisional findings to review matched-site results.</p> : <><p style={{color:C.muted,fontSize:12}}>Five management indicators · calculated from matched-site billing data</p><div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))',gap:12}}>{[
      {title:'Consumption Movement',value:pct(change),description:`${paired.length} matched sites: ${fmt(prevAvg)} kWh/site baseline versus ${fmt(currentAvg)} kWh/site in ${monthName(month)}. ${base.length-paired.length} excluded for incomplete history.`},
      {title:'High-Bill Exposure',value:`${highCount} sites`,description:`${base.length?(100*highCount/base.length).toFixed(1):'0.0'}% of ${base.length} sites flagged; this is not confirmed theft or financial loss.`},
      {title:'Positive Excess Consumption',value:`${fmt(positiveExcess)} kWh`,description:`Sum of site-level increases above baseline. Net consumption change: ${fmt(totalExcess)} kWh (including reductions).`},
      {title:'Largest Outlier',value:top.length?`Site ${top[0].site_id}`:'—',description:top.length?`${fmt(unit(top[0],month))} kWh billed vs ${fmt(baseline(top[0],month))} kWh baseline; excess ${fmt(excess(top[0],month))} kWh (${pct(growth(top[0],month))}).`:'No positive outlier available.'},
      {title:'Investigation Priorities',value:`${reasons[0].rows.length} / ${reasons[1].rows.length} / ${reasons[2].rows.length}`,description:`CP theft / faulty meter / load-RMS classifications. Validate field evidence and RMS load before revising HQ criteria.`}
    ].map((item,i)=><div key={item.title} style={{background:C.bg,border:'1px solid #deebe5',borderRadius:12,padding:15,borderTop:`3px solid ${[C.blue,C.red,C.amber,C.red,C.teal][i]}`}}><b style={{fontSize:12}}>{item.title}</b><div style={{fontSize:23,fontWeight:850,margin:'8px 0'}}>{item.value}</div><div style={{fontSize:12,lineHeight:1.6,color:C.muted}}>{item.description}</div></div>)}</div><p style={{fontSize:12,color:C.muted,marginBottom:0}}><b>Management action:</b> Investigate the largest site-level increases first; validate CP meter evidence and RMS expected load, and confirm resolution with subsequent completed billing. {incomplete?'These findings are provisional.':''}</p></>}</div>
      <BubbleChart rows={base} month={month} onSelect={setSelected}/>
      <div style={card}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:10}}><div><h3 style={{margin:'0 0 6px'}}>Grid-wise monthly electricity consumption</h3><small style={{color:C.muted}}>Total billed kWh by grid · all available months · C2006 and C2009 excluded · View opens full grid history</small></div><small style={{color:C.muted}}>Missing months shown as —; partial month coverage indicated</small></div>
        <div style={{overflowX:'auto',marginTop:14}}><table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}><thead><tr>{['Grid','Sites',...months.map(monthName),'4M Avg/site',`${monthName(month)} Avg/site`,'Change %','Details'].map(h=><th key={h} style={th}>{h}</th>)}</tr></thead><tbody>{grids.filter(g=>grid==='All'||grid===g).map((g,i)=>{const sites=scope.filter(r=>r.grid===g);const pairedSites=sites.filter(r=>hasPair(r,month));const p=average(pairedSites.map(r=>baseline(r,month)!));const a=average(pairedSites.map(r=>unit(r,month)!));return <tr key={g} style={{background:i%2?C.bg:'#fff',borderBottom:'1px solid #e3eee9'}}><td style={{...td,fontWeight:800}}>{g}</td><td style={td}>{sites.length}</td>{months.map(m=>{const available=sites.filter(r=>effectiveUnits(r,m)!==null);const total=available.reduce((v,r)=>v+(effectiveUnits(r,m)||0),0);return <td key={m} title={`${available.length}/${sites.length} sites billed`} style={{...td,background:m===month?'#e4f4eb':undefined,fontWeight:m===month?800:400}}>{available.length?fmt(total):'—'}{available.length>0&&available.length<sites.length?<span style={{color:C.amber}}> *</span>:null}</td>})}<td style={td}>{fmt(p)}</td><td style={{...td,fontWeight:750}}>{fmt(a)}</td><td style={{...td,color:p!==null&&a!==null&&a>p?C.red:C.green,fontWeight:700}}>{p!==null&&p!==0&&a!==null?pct(100*(a-p)/p):'—'}</td><td style={td}><button style={{...btn,padding:'6px 10px',background:'#e2f4e9'}} onClick={()=>setSelectedGrid(g)}>View</button></td></tr>})}</tbody></table></div>
        <small style={{color:C.muted}}>Monthly figures are grid totals (not per-site averages). An asterisk (*) means only part of the grid has billing records for that month. The comparison columns use only sites with a complete four-month baseline and selected reporting month.</small>
      </div>
      <div style={card}><h3 style={{ marginTop: 0 }}>Top 15 excess-consumption sites</h3><div style={{ overflowX: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}><thead><tr>{['Rank', 'Site', 'Grid', '4M avg', monthName(month), 'Excess kWh', 'Increase', 'Reason', 'Details'].map(h => <th key={h} style={th}>{h}</th>)}</tr></thead><tbody>{top.slice(0, 15).map((r, i) => <tr key={r.site_id} style={{ background: i % 2 ? C.bg : 'white' }}><td style={td}>{i + 1}</td><td style={{ ...td, fontWeight: 800 }}>{r.site_id}</td><td style={td}>{r.grid}</td><td style={td}>{fmt(baseline(r, month))}</td><td style={td}>{fmt(unit(r, month))}</td><td style={{ ...td, color: C.red, fontWeight: 800 }}>{fmt(excess(r, month))}</td><td style={td}>{pct(growth(r, month))}</td><td style={td}>{r.final_reason}</td><td style={td}><button style={btn} onClick={() => setSelected(r)}>View</button></td></tr>)}</tbody></table></div></div>
    </>}
    {tab === 'HQ High Billing History' && <div style={card}>
      <h2 style={{marginTop:0}}>HQ-Parked High Billing · January–August 2026</h2>
      <p style={{color:C.muted}}>Source: HQ High Billing history report. Select a reporting month and grid above. Each row is an HQ-flagged site-month, not a confirmed theft case.</p>
      {hqError&&<p style={{color:C.red}}>Bundled HQ source records are displayed. Live database: {hqError}</p>}
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))',gap:10,marginBottom:16}}>{historyMonths.map(m=><button key={m} style={{...btn,background:month===m?'#d7f1e1':'#fff',textAlign:'left'}} onClick={()=>setMonth(m)}><b>{monthName(m)}</b><div style={{fontSize:21,fontWeight:850}}>{hqForMonth(m).length}</div><small>HQ flags</small></button>)}</div>
      <div style={{display:'flex',gap:12,flexWrap:'wrap',marginBottom:10}}><b>{monthName(month)} HQ flagged sites: {hqForMonth(month).length}</b><span>Excess: {fmt(hqForMonth(month).reduce((s,r)=>s+(r.excessive_units||0),0))} kWh</span><span>Repeated sites (Jan–Aug): {new Set(hqRows.filter(h=>hqRows.filter(x=>x.site_id===h.site_id).length>1).map(h=>h.site_id)).size}</span></div>
      <div style={{overflowX:'auto'}}><table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}><thead><tr>{['Site ID','Grid','Billed kWh','HQ criterion kWh','Excess kWh','Variance','Bill amount','Repeat flags Jan–Aug','History'].map(x=><th key={x} style={th}>{x}</th>)}</tr></thead><tbody>{hqForMonth(month).sort((a,b)=>(b.excessive_units||0)-(a.excessive_units||0)).map((h,i)=><tr key={`${h.site_id}-${h.bill_month}`} style={{background:i%2?C.bg:'#fff'}}><td style={{...td,fontWeight:800}}>{h.site_id}</td><td style={td}>{h.grid}</td><td style={td}>{fmt(h.billed_units)}</td><td style={td}>{fmt(h.final_criteria_kwh)}</td><td style={{...td,color:C.red,fontWeight:800}}>{fmt(h.excessive_units)}</td><td style={td}>{h.variance_pct==null?'—':`${(h.variance_pct*100).toFixed(1)}%`}</td><td style={td}>{fmt(h.bill_amount)}</td><td style={td}>{siteHq(h.site_id).length}</td><td style={td}><button style={btn} onClick={()=>setHqSite(h.site_id)}>View</button></td></tr>)}</tbody></table></div>
      {!hqRows.length&&!hqError&&<p>No HQ records are visible. Import the HQ history file into Supabase and ensure the signed-in user has read access.</p>}
    </div>}
    {tab === 'RMS vs Billing' && <div style={{ ...card, display: 'flex', gap: 24, flexWrap: 'wrap' }}><div><small>August above RMS</small><h2>{base.filter(r => (num(r.aug_vs_rms) || 0) > 0).length}</h2><button style={btn} onClick={() => setMetric('August Above RMS')}>View above RMS <ChevronRight size={14}/></button></div><div><small>Average RMS criterion</small><h2>{fmt(average(base.map(r => num(r.rms_criteria)).filter((x): x is number => x !== null)))} kWh</h2></div><div><small>Average HQ locked</small><h2>{fmt(average(base.map(r => num(r.hq_locked)).filter((x): x is number => x !== null)))} kWh</h2></div><small style={{ alignSelf: 'center', color: C.muted }}>RMS values are from existing August-specific fields.</small></div>}
    {tab !== 'Field Investigations' && tab !== 'HQ High Billing History' && <div style={{ ...card, overflowX: 'auto' }}><h3 style={{ marginTop: 0 }}>{tab === 'Consumption History' ? `${monthName(month)} vs ${baselineMonths(month).map(monthName).join('–')} consumption history` : `${tab} · Site investigation records`}</h3><table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 13 }}><thead><tr>{(tab === 'Consumption History' ? ['Site', 'Grid', 'Owner', ...baselineMonths(month).map(m => `${monthName(m)} units`), '4M avg', `${monthName(month)} units`, 'Excess units', 'Increase %', 'Reason', 'Details'] : ['Site', 'Grid', 'Owner', 'Reason', 'HB months', '4M avg', monthName(month), 'Excess units', 'RMS', 'Aug − RMS', 'Status', 'Details']).map(h => <th key={h} style={th}>{h}</th>)}</tr></thead><tbody>{rows.map((r, i) => <tr key={r.site_id} style={{ background: i % 2 ? C.bg : 'white', borderBottom: '1px solid #e7f0e9' }}><td style={{ ...td, fontWeight: 800 }}>{r.site_id}</td><td style={td}>{r.grid}</td><td style={td}>{r.owner}</td>{tab === 'Consumption History' ? <>{baselineMonths(month).map(m => <td key={m} style={td}>{fmt(unit(r, m))}</td>)}<td style={td}>{fmt(baseline(r, month))}</td><td style={td}>{fmt(unit(r, month))}</td><td style={{ ...td, fontWeight: 700, color: (excess(r, month) || 0) > 0 ? C.red : C.green }}>{fmt(excess(r, month))}</td><td style={td}>{pct(growth(r, month))}</td><td style={td}>{r.final_reason}</td></> : <><td style={td}>{r.final_reason}</td><td style={td}>{r.hb_months}</td><td style={td}>{fmt(baseline(r, month))}</td><td style={td}>{fmt(unit(r, month))}</td><td style={{ ...td, color: (excess(r, month) || 0) > 0 ? C.red : C.green, fontWeight: 750 }}>{fmt(excess(r, month))}</td><td style={td}>{fmt(num(r.rms_criteria))}</td><td style={td}>{fmt(num(r.aug_vs_rms))}</td><td style={td}>{isHigh(r, month) ? 'High bill flagged' : 'Not high-bill flagged'}</td></>}<td style={td}><button onClick={() => setSelected(r)} style={{ ...btn, background: '#e2f4e9', color: C.green, border: 0 }}>View</button></td></tr>)}</tbody></table>{rows.length === 0 && <p>No matching sites.</p>}</div>}
    {hqSite && <div role="dialog" aria-modal="true" style={{position:'fixed',inset:0,background:'#0b201a99',display:'grid',placeItems:'center',zIndex:9999,padding:16}}><div style={{...card,width:'min(850px,95vw)',maxHeight:'90vh',overflow:'auto'}}><div style={{display:'flex',justifyContent:'space-between'}}><h2>Site {hqSite} · HQ high-billing history</h2><button style={btn} onClick={()=>setHqSite(null)}><X size={18}/></button></div><table style={{width:'100%',borderCollapse:'collapse'}}><thead><tr>{['Month','Billed units','HQ criterion','Excess units','Variance','Bill amount'].map(x=><th key={x} style={th}>{x}</th>)}</tr></thead><tbody>{siteHq(hqSite).map(h=><tr key={h.bill_month}><td style={td}>{h.bill_month}</td><td style={td}>{fmt(h.billed_units)}</td><td style={td}>{fmt(h.final_criteria_kwh)}</td><td style={td}>{fmt(h.excessive_units)}</td><td style={td}>{h.variance_pct==null?'—':`${(h.variance_pct*100).toFixed(1)}%`}</td><td style={td}>{fmt(h.bill_amount)}</td></tr>)}</tbody></table></div></div>}
    {selectedGrid && <div role="dialog" aria-modal="true" style={{position:'fixed',inset:0,background:'#0b201a99',display:'grid',placeItems:'center',zIndex:9998,padding:16}}><div style={{...card,width:'min(1180px,96vw)',maxHeight:'90vh',overflow:'auto'}}><div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}><h2>{selectedGrid} · Complete monthly consumption history</h2><button aria-label="Close grid history" style={btn} onClick={()=>setSelectedGrid(null)}><X size={18}/></button></div>{(()=>{const sites=eligibleData.filter(r=>r.grid===selectedGrid);return <><p style={{color:C.muted}}>{sites.length} sites · total billed units by month, average per billed site, and billing coverage. Click a site to inspect its history.</p><div style={{overflowX:'auto'}}><table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}><thead><tr>{['Month','Sites billed','Total units (kWh)','Average/site (kWh)','MoM change'].map(h=><th key={h} style={th}>{h}</th>)}</tr></thead><tbody>{months.map((m,i)=>{const valid=sites.filter(r=>effectiveUnits(r,m)!==null);const total=valid.reduce((sum,r)=>sum+(effectiveUnits(r,m)||0),0);const prev= i>0?sites.filter(r=>unit(r,months[i-1])!==null):[];const prevTotal=prev.reduce((sum,r)=>sum+(unit(r,months[i-1])||0),0);const change=i>0&&prevTotal>0&&valid.length===sites.length&&prev.length===sites.length?100*(total-prevTotal)/prevTotal:null;return <tr key={m} style={{background:i%2?C.bg:'#fff'}}><td style={td}>{monthName(m)} 2026</td><td style={td}>{valid.length}/{sites.length}</td><td style={{...td,fontWeight:700}}>{valid.length?fmt(total):'—'}</td><td style={td}>{valid.length?fmt(total/valid.length):'—'}</td><td style={td}>{pct(change)}</td></tr>})}</tbody></table></div><h3>Site-wise billing history</h3><div style={{overflowX:'auto'}}><table style={{borderCollapse:'collapse',width:'100%',fontSize:12}}><thead><tr>{['Site','Owner',...months.map(monthName),'View'].map(h=><th key={h} style={th}>{h}</th>)}</tr></thead><tbody>{sites.map((r,i)=><tr key={r.site_id} style={{background:i%2?C.bg:'#fff'}}><td style={{...td,fontWeight:700}}>{r.site_id}</td><td style={td}>{r.owner}</td>{months.map(m=><td key={m} style={td}>{fmt(effectiveUnits(r,m))}</td>)}<td style={td}><button style={btn} onClick={()=>{setSelectedGrid(null);setSelected(r)}}>View</button></td></tr>)}</tbody></table></div></>})()}</div></div>}
    {selected && <div role="dialog" aria-modal="true" style={{ position: 'fixed', inset: 0, background: '#0b201a99', display: 'grid', placeItems: 'center', zIndex: 9999, padding: 16 }}><div style={{ ...card, width: 'min(900px,95vw)', maxHeight: '88vh', overflow: 'auto' }}><div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}><h2>Site {selected.site_id} · {selected.grid}</h2><button aria-label="Close" onClick={() => setSelected(null)} style={{ border: 0, background: 'transparent', cursor: 'pointer' }}><X/></button></div><p><b>Owner:</b> {selected.owner} · <b>Reason:</b> {selected.final_reason}</p><p><b>Verification:</b> {selected.verification || '—'}</p><h3>Monthly billing history (kWh)</h3><div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(92px,1fr))', gap: 7 }}>{months.filter(m => unit(selected, m) !== null || ['apr', 'may', 'jun', 'jul', 'aug'].includes(m)).map(m => <div key={m} style={{ background: m === month ? '#dff3e7' : '#edf6f1', borderRadius: 8, padding: 10, textAlign: 'center' }}><b>{monthName(m)}</b><div style={{ fontSize: 18, fontWeight: 800, marginTop: 6 }}>{fmt(unit(selected, m))}</div><small>{selected[`${m}_flag`] || ''}</small></div>)}</div><div style={{ marginTop: 15, padding: 12, borderRadius: 9, background: '#f0f8f3' }}><b>Four-month baseline:</b> {fmt(baseline(selected, month))} kWh · <b>{monthName(month)}:</b> {fmt(unit(selected, month))} kWh · <b>Excess:</b> {fmt(excess(selected, month))} kWh · <b>Growth:</b> {pct(growth(selected, month))}</div><p><b>RMS criterion:</b> {fmt(num(selected.rms_criteria))} · <b>HQ locked:</b> {fmt(num(selected.hq_locked))} · <b>August − RMS:</b> {fmt(num(selected.aug_vs_rms))}</p><p><b>Management action:</b> {selected.management_action || '—'}</p><p><b>Field remarks:</b> {selected.field_remarks || '—'}</p><small>Resolution requires dated field action and subsequent validated normal billing.</small></div></div>}
  </div>;
}
