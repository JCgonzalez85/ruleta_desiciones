import type { SqlDatabaseAdapter } from "@/db/database";
import { generarUuidV4 } from "@/repositories/listasRepository";
import type { GiroEntidad } from "@/types/domain";

export interface GiroRemotoPayload {
  id: string;
  lista_id: string;
  resultado: string;
  girado_en: string;
  updated_at: string;
  deleted_at: string | null;
}

export async function registrarGiroLocal(
  db: SqlDatabaseAdapter,
  listaId: string,
  resultado: string,
  id: string = generarUuidV4(),
  giradoEn: string = new Date().toISOString(),
): Promise<GiroEntidad> {
  await db.runAsync(
    `INSERT INTO giro (id, lista_id, resultado, girado_en, remote_id, updated_at, deleted, pending)
     VALUES (?, ?, ?, ?, ?, ?, 0, 1)`,
    [id, listaId, resultado.trim(), giradoEn, id, giradoEn],
  );

  return {
    id,
    lista_id: listaId,
    resultado: resultado.trim(),
    girado_en: giradoEn,
    remote_id: id,
    updated_at: giradoEn,
    deleted: 0,
    pending: 1,
  };
}

export async function listarHistorialGiros(
  db: SqlDatabaseAdapter,
  listaId?: string,
): Promise<GiroEntidad[]> {
  if (listaId) {
    return db.getAllAsync<GiroEntidad>(
      `SELECT id, lista_id, resultado, girado_en, remote_id, updated_at, deleted, pending
       FROM giro
       WHERE deleted = 0 AND lista_id = ?
       ORDER BY girado_en DESC`,
      [listaId],
    );
  }

  return db.getAllAsync<GiroEntidad>(
    `SELECT id, lista_id, resultado, girado_en, remote_id, updated_at, deleted, pending
     FROM giro
     WHERE deleted = 0
     ORDER BY girado_en DESC`,
  );
}

export async function eliminarGiroLocal(db: SqlDatabaseAdapter, id: string): Promise<void> {
  const now = new Date().toISOString();
  await db.runAsync(`UPDATE giro SET deleted = 1, pending = 1, updated_at = ? WHERE id = ?`, [
    now,
    id,
  ]);
}

export async function obtenerGirosPendientesSync(db: SqlDatabaseAdapter): Promise<GiroEntidad[]> {
  return db.getAllAsync<GiroEntidad>(
    `SELECT id, lista_id, resultado, girado_en, remote_id, updated_at, deleted, pending
     FROM giro
     WHERE pending = 1`,
  );
}

export async function marcarGiroSincronizado(
  db: SqlDatabaseAdapter,
  id: string,
  updatedAtServidor: string,
): Promise<void> {
  await db.runAsync(`UPDATE giro SET pending = 0, remote_id = ?, updated_at = ? WHERE id = ?`, [
    id,
    updatedAtServidor,
    id,
  ]);
}

export async function aplicarGiroRemoto(
  db: SqlDatabaseAdapter,
  remoto: GiroRemotoPayload,
): Promise<void> {
  const local = await db.getFirstAsync<GiroEntidad>(
    `SELECT id, lista_id, resultado, girado_en, remote_id, updated_at, deleted, pending
     FROM giro WHERE id = ?`,
    [remoto.id],
  );
  if (local && local.updated_at > remoto.updated_at) {
    return;
  }

  const deletedFlag = remoto.deleted_at !== null ? 1 : 0;
  if (local) {
    await db.runAsync(
      `UPDATE giro
       SET lista_id = ?, resultado = ?, girado_en = ?, updated_at = ?, deleted = ?, pending = 0
       WHERE id = ?`,
      [
        remoto.lista_id,
        remoto.resultado,
        remoto.girado_en,
        remoto.updated_at,
        deletedFlag,
        remoto.id,
      ],
    );
  } else if (deletedFlag === 0) {
    await db.runAsync(
      `INSERT INTO giro (id, lista_id, resultado, girado_en, remote_id, updated_at, deleted, pending)
       VALUES (?, ?, ?, ?, ?, ?, 0, 0)`,
      [
        remoto.id,
        remoto.lista_id,
        remoto.resultado,
        remoto.girado_en,
        remoto.id,
        remoto.updated_at,
      ],
    );
  }
}

export async function obtenerUltimoSince(
  db: SqlDatabaseAdapter,
  recurso: "lista" | "giro",
): Promise<string | undefined> {
  const row = await db.getFirstAsync<{ ultimo_since: string }>(
    `SELECT ultimo_since FROM sync_meta WHERE recurso = ?`,
    [recurso],
  );
  return row?.ultimo_since;
}

export async function guardarUltimoSince(
  db: SqlDatabaseAdapter,
  recurso: "lista" | "giro",
  sinceIso: string,
): Promise<void> {
  const existe = await obtenerUltimoSince(db, recurso);
  if (existe) {
    await db.runAsync(`UPDATE sync_meta SET ultimo_since = ? WHERE recurso = ?`, [
      sinceIso,
      recurso,
    ]);
  } else {
    await db.runAsync(`INSERT INTO sync_meta (recurso, ultimo_since) VALUES (?, ?)`, [
      recurso,
      sinceIso,
    ]);
  }
}
