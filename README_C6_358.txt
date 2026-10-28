Simple C-6 baseline update

Replace C6HQOverview.tsx with this version. Keep App.tsx and other existing files if already updated.
- Exclude 25 Pattoki IDs from C-6 evaluation.
- Exclude sites without any positive billed kWh in available history.
- Keep sites with positive historical billing even when selected month is zero; mark No current consumption.
- Do not count zero-current sites as RMS justified, actionable, or RMS pending.
- The August 2026 verified baseline is 358 eligible sites (342 positive current, 16 zero-current).
- Data is not deleted from Supabase.
Run npm run build in Codespaces.
