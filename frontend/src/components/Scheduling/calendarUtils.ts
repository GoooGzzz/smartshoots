export const ZONE = 'Africa/Cairo';
export function cairoInput(value: string | number | Date) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: ZONE, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(value));
  const p = Object.fromEntries(parts.map(x => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}
export function cairoInstant(input: string) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(input)) throw new Error('Enter a valid date and time.');
  const nominal = Date.parse(input + ':00Z');
  const matches: number[] = [];
  // Explicit candidate offsets make nonexistent/ambiguous Cairo DST times visible.
  for (let h = -14; h <= 14; h++) { const candidate = nominal + h * 3600000; if (cairoInput(candidate) === input) matches.push(candidate); }
  if (matches.length !== 1) throw new Error('This Cairo time is invalid or repeated during a daylight-saving change. Choose another time.');
  return new Date(matches[0]).toISOString();
}
export function addDays(key: string, days: number) { const d = new Date(key + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + days); return d.toISOString().slice(0, 10); }
export function monday(key: string) { return addDays(key, -(new Date(key + 'T12:00:00Z').getUTCDay() + 6) % 7); }
export function isoWeek(key: string) { const d = new Date(key + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + 3 - (d.getUTCDay() + 6) % 7); const year = d.getUTCFullYear(); return { year, week: Math.ceil(((+d - Date.UTC(year, 0, 1, 12)) / 86400000 + 1) / 7) }; }
export function monthDays(key: string) { const first = key.slice(0, 7) + '-01'; return Array.from({ length: 42 }, (_, i) => addDays(monday(first), i)); }
export function minutes(buffer: string | undefined) { const p = (buffer || '00:15:00').split(':').map(Number); return (p[0] || 0) * 60 + (p[1] || 0) + (p[2] || 0) / 60; }
export const active = (a: any) => ['pending', 'confirmed', 'in_progress'].includes(a.status);
export function clashes(a: any, b: any) { if (!active(a) || !active(b) || a.id === b.id) return false; const ar = a.resources?.length ? a.resources.map(Number) : [1], br = b.resources?.length ? b.resources.map(Number) : [1]; return ar.some((r: number) => br.includes(r)) && Date.parse(a.start_time) - minutes(a.buffer_before) * 60000 < Date.parse(b.end_time) + minutes(b.buffer_after) * 60000 && Date.parse(b.start_time) - minutes(b.buffer_before) * 60000 < Date.parse(a.end_time) + minutes(a.buffer_after) * 60000; }
export function daySegments(items: any[], key: string) {
  const segments = items.flatMap(a => { const start = cairoInput(a.start_time), end = cairoInput(a.end_time); if (start.slice(0, 10) > key || end.slice(0, 10) < key) return []; const sm = start.slice(0, 10) < key ? 0 : Number(start.slice(11, 13)) * 60 + Number(start.slice(14)); const em = end.slice(0, 10) > key ? 1440 : Number(end.slice(11, 13)) * 60 + Number(end.slice(14)); return em > sm ? [{ a, start: sm, end: em, lane: 0 }] : []; }).sort((a, b) => a.start - b.start || b.end - a.end);
  const ends: number[] = []; for (const e of segments) { let i = ends.findIndex(end => end <= e.start); if (i < 0) i = ends.length; e.lane = i; ends[i] = Math.max(e.end, e.start + 45); }
  return { segments, lanes: Math.max(1, ends.length) };
}
