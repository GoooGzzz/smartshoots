import sqlite3,json,sys
payload=json.load(sys.stdin);c=sqlite3.connect(payload['db']);c.row_factory=sqlite3.Row;c.execute('PRAGMA foreign_keys=ON')
try:
 results=[]
 with c:
  for s in payload['statements']:
   r=c.execute(s['query'],s.get('args',[]));rows=[dict(x) for x in r.fetchall()];results.append({'results':rows,'meta':{'last_row_id':r.lastrowid,'changes':r.rowcount}})
 print(json.dumps(results))
except Exception as e:
 print(json.dumps({'error':str(e)}))
 sys.exit(0)
