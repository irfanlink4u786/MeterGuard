import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY);
const panel: React.CSSProperties = { background: '#fff', border: '1px solid #dcebe6', borderRadius: 12, padding: 18, marginBottom: 14 };
const field: React.CSSProperties = { width: '100%', padding: 9, borderRadius: 7, border: '1px solid #bdd6c9', boxSizing: 'border-box' };
const action: React.CSSProperties = { background: '#116d4e', color: '#fff', padding: '10px 15px', border: 0, borderRadius: 8, cursor: 'pointer' };
const evidenceNames: Record<string, string[]> = {
  theft: ['meter_total', 'meter_peak', 'meter_offpeak', 'suspected_theft', 'before_removal', 'after_removal'],
  criteria: ['omo_l1', 'omo_l2', 'omo_l3', 'omo_bb', 'field_l1', 'field_l2', 'field_l3', 'csu_equipment_load', 'csu_bb_capacity', 'csu_charging_coefficient'],
  meter_fault: ['meter_total', 'meter_peak', 'meter_offpeak', 'meter_test'],
};
type Visit = { id: string; site_id: string; visited_at: string; total_kwh: number; hourly_kwh: number | null; expected_kwh_hour: number | null; deviation_pct: number | null; grid: string | null };
const number = (v: string) => v.trim() === '' ? null : Number(v);
const pretty = (v: number | null | undefined) => v == null || !Number.isFinite(v) ? '—' : v.toFixed(2);

export default function MeterGuardFieldInvestigations({ initialSite = '', initialGrid = '', lockedMonthlyUnits = null }: { initialSite?: string; initialGrid?: string; lockedMonthlyUnits?: number | null }) {
  const [site, setSite] = useState(initialSite);
  const [grid, setGrid] = useState(initialGrid);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [current, setCurrent] = useState({ total: '', peak: '', offpeak: '', at: '', locked: lockedMonthlyUnits == null ? '' : String(lockedMonthlyUnits), days: '30', notes: '' });
  const [caseType, setCaseType] = useState<'theft' | 'criteria' | 'meter_fault'>('theft');
  const [caseDetails, setCaseDetails] = useState({ subject: '', suspectedParty: 'Owner', meterVerified: false, description: '', omoL1: '', omoL2: '', omoL3: '', omoBbAh: '', omoBbType: '', csuLoadKw: '', csuBbAh: '', chargingCoefficient: '', proposedUnits: '' });
  const [files, setFiles] = useState<Record<string, File | undefined>>({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [cases, setCases] = useState<{ id: string; case_type: string; status: string; created_at: string }[]>([]);
  const [visitRefresh, setVisitRefresh] = useState(0);
  useEffect(() => { setSite(initialSite); setGrid(initialGrid); }, [initialSite, initialGrid]);
  useEffect(() => { if (lockedMonthlyUnits != null) setCurrent(v => ({ ...v, locked: String(lockedMonthlyUnits) })); }, [lockedMonthlyUnits]);
  useEffect(() => {
    if (!site.trim()) { setVisits([]); setCases([]); return; }
    let live = true;
    (async () => {
      const [a, b] = await Promise.all([
        supabase.from('mg_field_visits').select('id,site_id,grid,visited_at,total_kwh,hourly_kwh,expected_kwh_hour,deviation_pct').eq('site_id', site.trim()).order('visited_at', { ascending: false }).limit(50),
        supabase.from('mg_investigation_cases').select('id,case_type,status,created_at').eq('site_id', site.trim()).order('created_at', { ascending: false }).limit(30),
      ]);
      if (live) { setVisits((a.data || []) as Visit[]); setCases(b.data || []); if (a.error || b.error) setMessage(a.error?.message || b.error?.message || ''); }
    })();
    return () => { live = false; };
  }, [site, visitRefresh]);
  const previous = visits[0];
  const calc = useMemo(() => {
    const total = number(current.total), at = Date.parse(current.at), prevAt = previous ? Date.parse(previous.visited_at) : NaN;
    const hours = Number.isFinite(at) && Number.isFinite(prevAt) ? (at - prevAt) / 3600000 : null;
    const delta = total != null && previous ? total - Number(previous.total_kwh) : null;
    const actual = hours != null && hours > 0 && delta != null && delta >= 0 ? delta / hours : null;
    const locked = number(current.locked), days = number(current.days);
    const expected = locked != null && days != null && days > 0 ? locked / (days * 24) : null;
    const deviation = actual != null && expected != null && expected > 0 ? (actual / expected - 1) * 100 : null;
    return { hours, delta, actual, expected, deviation };
  }, [current, previous]);
  async function userId() { const { data, error } = await supabase.auth.getUser(); if (error || !data.user) throw new Error('Please sign in before saving field investigations.'); return data.user.id; }
  async function uploadEvidence(uid: string, caseId: string, list: string[]) {
    const paths: Record<string, string> = {};
    for (const key of list) {
      const file = files[key]; if (!file) continue;
      if (file.size > 10 * 1024 * 1024 || !file.type.startsWith('image/')) throw new Error(`${key}: provide an image under 10 MB`);
      const extension = (file.name.split('.').pop() || 'jpg').replace(/[^a-z0-9]/gi, '').toLowerCase();
      const path = `${uid}/${site.trim()}/${caseId}/${key}-${crypto.randomUUID()}.${extension}`;
      const { error } = await supabase.storage.from('mg-investigation-evidence').upload(path, file, { contentType: file.type, upsert: false });
      if (error) throw error;
      paths[key] = path;
    }
    return paths;
  }
  async function saveVisit() {
    setMessage(''); setBusy(true);
    try {
      const uid = await userId(), total = number(current.total), peak = number(current.peak), offpeak = number(current.offpeak);
      if (!site.trim() || !grid.trim() || !current.at || total == null || total < 0) throw new Error('Site, grid, visit time and total meter reading are required.');
      if ([peak, offpeak].some(v => v != null && v < 0)) throw new Error('Meter readings cannot be negative.');
      if (previous && (calc.hours == null || calc.hours <= 0 || calc.delta == null || calc.delta < 0)) throw new Error('Current timestamp must be after previous visit and total meter reading must not decrease. Check meter replacement/rollover before submitting.');
      const { error } = await supabase.from('mg_field_visits').insert({ user_id: uid, site_id: site.trim(), grid: grid.trim(), visited_at: new Date(current.at).toISOString(), total_kwh: total, peak_kwh: peak, offpeak_kwh: offpeak, locked_monthly_units: number(current.locked), criteria_days: number(current.days), previous_visit_id: previous?.id || null, elapsed_hours: calc.hours, consumed_kwh: calc.delta, hourly_kwh: calc.actual, expected_kwh_hour: calc.expected, deviation_pct: calc.deviation, notes: current.notes });
      if (error) throw error;
      setMessage('Visit saved. The next reading will automatically use this visit as the baseline.'); setVisitRefresh(v => v + 1);
    } catch (e) { setMessage(e instanceof Error ? e.message : String(e)); } finally { setBusy(false); }
  }
  async function saveCase() {
    setBusy(true); setMessage('');
    try {
      const uid = await userId();
      if (!site.trim() || !caseDetails.description.trim()) throw new Error('Site and investigation description are required.');
      if (!visits.length) throw new Error('Save at least one field visit before opening an investigation.');
      if (caseType === 'theft' && !caseDetails.meterVerified) throw new Error('Verify the meter before submitting a suspected theft case.');
      if (caseType === 'criteria' && ['omoL1','omoL2','omoL3','omoBbAh'].some(k => !caseDetails[k as keyof typeof caseDetails])) throw new Error('OMO L1, L2, L3 and battery capacity are required.');
      const required = caseType === 'criteria' ? ['omo_l1','omo_l2','omo_l3','omo_bb','field_l1','field_l2','field_l3'] : caseType === 'theft' ? ['suspected_theft'] : ['meter_test'];
      const missing = required.filter(k => !files[k]); if (missing.length) throw new Error(`Missing required photographs: ${missing.join(', ')}`);
      const caseId = crypto.randomUUID();
      const evidence = await uploadEvidence(uid, caseId, evidenceNames[caseType]);
      const { error } = await supabase.from('mg_investigation_cases').insert({ id: caseId, user_id: uid, site_id: site.trim(), grid: grid.trim(), visit_id: visits[0].id, case_type: caseType, status: 'Open', suspected_party: caseType === 'theft' ? caseDetails.suspectedParty : null, meter_verified: caseDetails.meterVerified, description: caseDetails.description, technical_data: caseType === 'criteria' ? { omo_l1: number(caseDetails.omoL1), omo_l2: number(caseDetails.omoL2), omo_l3: number(caseDetails.omoL3), omo_bb_ah: number(caseDetails.omoBbAh), omo_bb_type: caseDetails.omoBbType, csu_load_kw: number(caseDetails.csuLoadKw), csu_bb_ah: number(caseDetails.csuBbAh), charging_coefficient: number(caseDetails.chargingCoefficient), proposed_monthly_units: number(caseDetails.proposedUnits), csu_available: !!files.csu_equipment_load } : {}, evidence_paths: evidence });
      if (error) throw error;
      setMessage(`Case registered (${caseId}). Evidence stored privately. Status: Open.`); setVisitRefresh(v => v + 1); setFiles({});
    } catch (e) { setMessage(e instanceof Error ? e.message : String(e)); } finally { setBusy(false); }
  }
  const inp = (label: string, key: keyof typeof caseDetails, type = 'number') => <label style={{ fontSize: 13 }}>{label}<input type={type} style={field} value={String(caseDetails[key])} onChange={e => setCaseDetails(v => ({ ...v, [key]: e.target.value }))}/></label>;
  return <div style={{ color: '#153c32' }}>
    <h2>Field Electricity Investigation</h2><p style={{ color: '#6b847a' }}>Monitor kWh/hour between timestamped site visits; investigate abnormal consumption without waiting for monthly billing. High consumption is an investigation signal, not proof of theft.</p>
    <div style={panel}><h3>1. Meter reading and hourly consumption</h3><div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 12 }}>
      <label>Site ID<input style={field} value={site} onChange={e => setSite(e.target.value)}/></label><label>Grid<input style={field} value={grid} onChange={e => setGrid(e.target.value)}/></label>
      <label>Visit time (Pakistan local)<input type="datetime-local" style={field} value={current.at} onChange={e => setCurrent(v => ({ ...v, at: e.target.value }))}/></label>
      {([['total','Total meter kWh'],['peak','Peak kWh'],['offpeak','Off-Peak kWh'],['locked','HQ locked monthly units'],['days','Criteria month days']] as const).map(([key,label]) => <label key={key}>{label}<input type="number" min="0" step="any" style={field} value={current[key]} onChange={e => setCurrent(v => ({ ...v, [key]: e.target.value }))}/></label>)}
    </div><p style={{ fontSize: 13 }}>Previous reading: <b>{previous ? `${previous.total_kwh} kWh · ${new Date(previous.visited_at).toLocaleString('en-PK')}` : 'No previous visit — baseline only'}</b></p>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 9 }}>{[['Elapsed hours',pretty(calc.hours)],['Consumed kWh',pretty(calc.delta)],['Actual kWh/hour',pretty(calc.actual)],['Expected kWh/hour',pretty(calc.expected)],['Deviation',calc.deviation == null ? '—' : `${pretty(calc.deviation)}%`]].map(([label,value]) => <div key={label} style={{ background: '#edf6f1', borderRadius: 9, padding: 12 }}><small>{label}</small><div style={{ fontSize: 20, fontWeight: 800 }}>{value}</div></div>)}</div>
    <p style={{ color: '#98631b', fontSize: 12 }}>Expected hourly usage uses locked monthly units ÷ days ÷ 24. It is a screening benchmark; charging cycles, DG operation, outages, meter replacement and peak/off-peak tariffs need investigation before classification.</p>
    <textarea placeholder="Visit observations / meter replacement notes" style={{ ...field, minHeight: 60 }} value={current.notes} onChange={e => setCurrent(v => ({ ...v, notes: e.target.value }))}/><button style={action} disabled={busy} onClick={saveVisit}>Save timestamped visit</button></div>
    <div style={panel}><h3>2. Register investigation ticket</h3><label>Case type <select style={field} value={caseType} onChange={e => { setCaseType(e.target.value as typeof caseType); setFiles({}); }}><option value="theft">Suspected owner / guard theft</option><option value="criteria">Criteria revision required</option><option value="meter_fault">Faulty meter</option></select></label>
    {caseType === 'theft' && <><label>Suspected party <select style={field} value={caseDetails.suspectedParty} onChange={e => setCaseDetails(v => ({ ...v, suspectedParty: e.target.value }))}><option>Owner</option><option>Guard</option><option>Other / Unknown</option></select></label><label style={{ display: 'block', margin: '12px 0' }}><input type="checkbox" checked={caseDetails.meterVerified} onChange={e => setCaseDetails(v => ({ ...v, meterVerified: e.target.checked }))}/> Meter accuracy verified / no known meter fault</label><p style={{ fontSize: 12 }}>Ticket is a suspected incident, not a confirmed allegation. Review before/after readings and evidence before closure.</p></>}
    {caseType === 'criteria' && <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: 12, marginTop: 12 }}>{inp('OMO L1 load (A)', 'omoL1')}{inp('OMO L2 load (A)', 'omoL2')}{inp('OMO L3 load (A)', 'omoL3')}{inp('OMO BB capacity (Ah)', 'omoBbAh')}{inp('OMO BB type', 'omoBbType', 'text')}{inp('CSU equipment load (kW)', 'csuLoadKw')}{inp('CSU BB capacity (Ah)', 'csuBbAh')}{inp('CSU charging coefficient', 'chargingCoefficient')}{inp('Proposed monthly criteria (kWh)', 'proposedUnits')}</div>}
    <h4>Evidence photographs</h4><div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(210px,1fr))', gap: 12 }}>{evidenceNames[caseType].map(key => <label key={key} style={{ fontSize: 12, fontWeight: 650 }}>{key.replace(/_/g, ' ').toUpperCase()}<input style={field} type="file" accept="image/*" onChange={e => setFiles(v => ({ ...v, [key]: e.target.files?.[0] }))}/></label>)}</div>
    {caseType === 'criteria' && <p style={{ fontSize: 12, color: '#98631b' }}>CSU evidence is requested when available; missing CSU must be explained in the description. OMO L1/L2/L3, OMO BB and field phase photographs are mandatory. Criteria changes require management approval.</p>}
    <textarea style={{ ...field, minHeight: 90, margin: '12px 0' }} placeholder="Investigation description, suspected issue, CSU availability, corrective action" value={caseDetails.description} onChange={e => setCaseDetails(v => ({ ...v, description: e.target.value }))}/><button style={action} disabled={busy} onClick={saveCase}>Register case and upload evidence</button></div>
    <div style={panel}><h3>3. Previous visits and tickets</h3><h4>Visits</h4><div style={{ overflowX: 'auto' }}><table style={{ width: '100%', textAlign: 'left' }}><thead><tr><th>Date</th><th>Total kWh</th><th>kWh/hour</th><th>Expected</th><th>Deviation</th></tr></thead><tbody>{visits.map(v => <tr key={v.id}><td>{new Date(v.visited_at).toLocaleString('en-PK')}</td><td>{v.total_kwh}</td><td>{pretty(v.hourly_kwh)}</td><td>{pretty(v.expected_kwh_hour)}</td><td>{pretty(v.deviation_pct)}%</td></tr>)}</tbody></table></div><h4>Tickets</h4>{cases.map(c => <div key={c.id} style={{ borderBottom: '1px solid #ddd', padding: 8 }}>{c.case_type} · {c.status} · {new Date(c.created_at).toLocaleDateString('en-PK')} · {c.id}</div>)}{!cases.length && <p>No tickets yet.</p>}</div>
    {message && <div role="status" style={{ ...panel, color: message.toLowerCase().includes('saved') || message.toLowerCase().includes('registered') ? '#116d4e' : '#a34225' }}>{message}</div>}
  </div>;
}
