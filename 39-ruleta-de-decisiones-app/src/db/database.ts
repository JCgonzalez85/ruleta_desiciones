export interface SqlStatementResult {
  changes: number;
}

export interface SqlDatabaseAdapter {
  execAsync(sql: string): Promise<void>;
  runAsync(sql: string, params?: Array<string | number | null>): Promise<SqlStatementResult>;
  getAllAsync<T>(sql: string, params?: Array<string | number | null>): Promise<T[]>;
  getFirstAsync<T>(sql: string, params?: Array<string | number | null>): Promise<T | null>;
}

export const MIGRATION_SQL = `
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS lista (
  id TEXT PRIMARY KEY,
  nombre TEXT NOT NULL UNIQUE,
  remote_id TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted INTEGER NOT NULL DEFAULT 0,
  pending INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS opcion (
  id TEXT PRIMARY KEY,
  lista_id TEXT NOT NULL REFERENCES lista(id) ON DELETE CASCADE,
  texto TEXT NOT NULL,
  peso INTEGER NOT NULL DEFAULT 1 CHECK (peso BETWEEN 1 AND 10),
  remote_id TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted INTEGER NOT NULL DEFAULT 0,
  pending INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS giro (
  id TEXT PRIMARY KEY,
  lista_id TEXT NOT NULL REFERENCES lista(id),
  resultado TEXT NOT NULL,
  girado_en TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  remote_id TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted INTEGER NOT NULL DEFAULT 0,
  pending INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS sync_meta (
  recurso TEXT PRIMARY KEY,
  ultimo_since TEXT NOT NULL
);
`;

let activeDbAdapter: SqlDatabaseAdapter | null = null;

export function setDatabaseAdapter(adapter: SqlDatabaseAdapter): void {
  activeDbAdapter = adapter;
}

export async function getDatabaseAdapter(): Promise<SqlDatabaseAdapter> {
  if (activeDbAdapter) {
    return activeDbAdapter;
  }
  const sqliteModule = await import("expo-sqlite");
  const nativeDb = await sqliteModule.openDatabaseAsync("ruleta_decisiones.db");
  activeDbAdapter = {
    execAsync: (sql) => nativeDb.execAsync(sql),
    runAsync: async (sql, params = []) => {
      const res = await nativeDb.runAsync(sql, params);
      return { changes: res.changes };
    },
    getAllAsync: <T>(sql: string, params: Array<string | number | null> = []) =>
      nativeDb.getAllAsync<T>(sql, params),
    getFirstAsync: <T>(sql: string, params: Array<string | number | null> = []) =>
      nativeDb.getFirstAsync<T>(sql, params),
  };
  return activeDbAdapter;
}

export async function runMigrations(db?: SqlDatabaseAdapter): Promise<SqlDatabaseAdapter> {
  const adapter = db ?? (await getDatabaseAdapter());
  await adapter.execAsync(MIGRATION_SQL);
  return adapter;
}
