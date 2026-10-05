import {readFileSync,writeFileSync} from 'node:fs';import {fileURLToPath} from 'node:url';
const path=fileURLToPath(new URL('../wrangler.jsonc',import.meta.url)),cfg=JSON.parse(readFileSync(path,'utf8'));
if(process.env.D1_DATABASE_ID)cfg.d1_databases[0].database_id=process.env.D1_DATABASE_ID;
if(process.env.R2_BUCKET_NAME)cfg.r2_buckets[0].bucket_name=process.env.R2_BUCKET_NAME;
if(!/^[0-9a-f-]{36}$/i.test(cfg.d1_databases[0].database_id))throw new Error('Set D1_DATABASE_ID to the database UUID from your Cloudflare D1 dashboard.');
const routes=['/academy/*','/series/*','/knowledge/*','/sitemap.xml','/robots.txt'];
if(cfg.assets&&cfg.assets.run_worker_first!==true){cfg.assets.run_worker_first=[...new Set([...(Array.isArray(cfg.assets.run_worker_first)?cfg.assets.run_worker_first:[]),...routes])];}
writeFileSync(path,JSON.stringify(cfg,null,2)+'\n');console.log('Cloudflare bindings configured.');
