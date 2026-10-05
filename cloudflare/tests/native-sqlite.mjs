import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
const migrations = ['0001_initial.sql', '0002_integrity.sql', '0003_schedule_guards.sql', '0004_client_delivery.sql', '0005_guest_sharing.sql', '0006_academic_showcase.sql', '0007_studio_experience.sql'];
export function initializeDatabase(path) {
  const db = new DatabaseSync(path);
  try { for (const name of migrations) db.exec(readFileSync('migrations/' + name, 'utf8')); }
  finally { db.close(); }
}
export function runStatements(path, statements) {
  const db = new DatabaseSync(path);
  try {
    db.exec('PRAGMA foreign_keys=ON; BEGIN IMMEDIATE;');
    const results = statements.map(({ query, args = [] }) => {
      const statement = db.prepare(query);
      if (statement.columns().length) return { results: statement.all(...args), meta: {} };
      const info = statement.run(...args);
      return { results: [], meta: { last_row_id: Number(info.lastInsertRowid), changes: Number(info.changes) } };
    });
    db.exec('COMMIT;');
    return results;
  } catch (error) {
    try { db.exec('ROLLBACK;'); } catch {}
    throw error;
  } finally { db.close(); }
}
