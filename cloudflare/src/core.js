export class HttpError extends Error { constructor(status, message, fields) { super(message); this.status=status; this.fields=fields; } }
export const fail=(status,message,fields)=>{throw new HttpError(status,message,fields)};
// Decimal arithmetic uses integers; no floating-point ledger accumulation.
export function scaled(value,places=2) {
 const s=String(value); if(!/^\d{1,12}(\.\d{1,4})?$/.test(s)) fail(400,'Invalid positive decimal amount');
 const [a,b='']=s.split('.'); const digits=(b+'0'.repeat(places+1));
 const n=BigInt(a)*10n**BigInt(places)+BigInt(digits.slice(0,places)||0)+(Number(digits[places])>=5?1n:0n);
 if(n>9007199254740991n)fail(400,'Amount is too large'); return Number(n);
}
export const money=n=>(n/100).toFixed(2);
export function orderTotal(quantity,rate) { const q=scaled(quantity),r=scaled(rate); if(q<=0||r<=0)fail(400,'Quantity and rate must be positive'); const n=(BigInt(q)*BigInt(r)+50n)/100n;if(n>9007199254740991n)fail(400,'Order total is too large');return money(Number(n)); }
export function seconds(v='00:15:00') {if(typeof v==='number')return v;const p=String(v).split(':').map(Number);if(p.length!==3||p.some(x=>!Number.isFinite(x)||x<0))fail(400,'Invalid duration');return p[0]*3600+p[1]*60+p[2];}
export function interval(a) { const s=Date.parse(a.start_time),e=Date.parse(a.end_time);if(!Number.isFinite(s)||!Number.isFinite(e)||e<=s)fail(400,'End time must be after start time');return [s-seconds(a.buffer_before)*1000,e+seconds(a.buffer_after)*1000]; }
export function overlaps(a,b) {const [s,e]=interval(a),[x,y]=interval(b);return s<y&&e>x;}
export async function digest(s) {return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)))).map(x=>x.toString(16).padStart(2,'0')).join('');}
export function equal(a,b) {let diff=a.length^b.length;for(let i=0;i<Math.max(a.length,b.length);i++)diff|=(a.charCodeAt(i)||0)^(b.charCodeAt(i)||0);return diff===0;}
export async function passwordHash(password,salt=crypto.randomUUID()) {const k=await crypto.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveBits']);const b=await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt:new TextEncoder().encode(salt),iterations:100000},k,256);return 'pbkdf2_sha256$100000$'+salt+'$'+Array.from(new Uint8Array(b)).map(x=>x.toString(16).padStart(2,'0')).join('');}
export async function verifyPassword(p,h) {if(!h?.startsWith('pbkdf2_sha256$100000$'))return false;return equal(await passwordHash(p,h.split('$')[2]),h);}
