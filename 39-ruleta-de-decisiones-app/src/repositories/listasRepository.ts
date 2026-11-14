import type { SqlDatabaseAdapter } from "@/db/database";
import { validarListaYOpciones } from "@/services/ruletaMath";
import type { ListaEntidad, OpcionEntidad, OpcionInput } from "@/types/domain";

interface ListaRow {
  id: string;
  nombre: string;
  remote_id: string | null;
  updated_at: string;
  deleted: number;
  pending: number;
}

export interface ListaRemotaPayload {
  id: string;
  nombre: string;
  opciones: Array<{ texto: string; peso: number }>;
  updated_at: string;
  deleted_at: string | null;
}

export function generarUuidV4(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = Math.floor(Math.random() * 16);
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

async function cargarOpcionesDeLista(
  db: SqlDatabaseAdapter,
  listaId: string,
): Promise<OpcionEntidad[]> {
  return db.getAllAsync<OpcionEntidad>(
    `SELECT id, lista_id, texto, peso, remote_id, updated_at, deleted, pending
     FROM opcion
     WHERE lista_id = ? AND deleted = 0
     ORDER BY rowid ASC`,
    [listaId],
  );
}

export async function listarListasActivas(
  db: SqlDatabaseAdapter,
  busqueda = "",
): Promise<ListaEntidad[]> {
  const filtro = `%${busqueda.trim()}%`;
  const rows = await db.getAllAsync<ListaRow>(
    `SELECT id, nombre, remote_id, updated_at, deleted, pending
     FROM lista
     WHERE deleted = 0 AND nombre LIKE ?
     ORDER BY updated_at DESC`,
    [filtro],
  );

  const resultado: ListaEntidad[] = [];
  for (const row of rows) {
    const opciones = await cargarOpcionesDeLista(db, row.id);
    resultado.push({ ...row, opciones });
  }
  return resultado;
}

export async function obtenerListaPorId(
  db: SqlDatabaseAdapter,
  id: string,
): Promise<ListaEntidad | null> {
  const row = await db.getFirstAsync<ListaRow>(
    `SELECT id, nombre, remote_id, updated_at, deleted, pending
     FROM lista
     WHERE id = ? AND deleted = 0`,
    [id],
  );
  if (!row) {
    return null;
  }
  const opciones = await cargarOpcionesDeLista(db, row.id);
  return { ...row, opciones };
}

async function reemplazarOpcionesDeLista(
  db: SqlDatabaseAdapter,
  listaId: string,
  opciones: OpcionInput[],
  now: string,
  pending: number,
): Promise<void> {
  await db.runAsync(`DELETE FROM opcion WHERE lista_id = ?`, [listaId]);
  for (let i = 0; i < opciones.length; i += 1) {
    const op = opciones[i];
    if (!op) continue;
    const opId = op.id ?? `${listaId}-op-${i + 1}`;
    await db.runAsync(
      `INSERT INTO opcion (id, lista_id, texto, peso, remote_id, updated_at, deleted, pending)
       VALUES (?, ?, ?, ?, ?, ?, 0, ?)`,
      [opId, listaId, op.texto.trim(), op.peso, opId, now, pending],
    );
  }
}

export async function guardarListaConOpciones(
  db: SqlDatabaseAdapter,
  id: string,
  nombre: string,
  opciones: OpcionInput[],
  pending = 1,
): Promise<ListaEntidad> {
  const validacion = validarListaYOpciones(nombre, opciones);
  if (!validacion.valido) {
    throw new Error(validacion.errores.join(" "));
  }

  const now = new Date().toISOString();
  const existente = await db.getFirstAsync<ListaRow>(`SELECT id FROM lista WHERE id = ?`, [id]);

  if (existente) {
    await db.runAsync(
      `UPDATE lista
       SET nombre = ?, updated_at = ?, deleted = 0, pending = ?
       WHERE id = ?`,
      [nombre.trim(), now, pending, id],
    );
  } else {
    await db.runAsync(
      `INSERT INTO lista (id, nombre, remote_id, updated_at, deleted, pending)
       VALUES (?, ?, ?, ?, 0, ?)`,
      [id, nombre.trim(), id, now, pending],
    );
  }

  await reemplazarOpcionesDeLista(db, id, opciones, now, pending);
  const guardada = await obtenerListaPorId(db, id);
  if (!guardada) {
    throw new Error("No se pudo recuperar la lista guardada.");
  }
  return guardada;
}

export async function eliminarListaLocal(db: SqlDatabaseAdapter, id: string): Promise<void> {
  const now = new Date().toISOString();
  await db.runAsync(`UPDATE lista SET deleted = 1, pending = 1, updated_at = ? WHERE id = ?`, [
    now,
    id,
  ]);
  await db.runAsync(
    `UPDATE opcion SET deleted = 1, pending = 1, updated_at = ? WHERE lista_id = ?`,
    [now, id],
  );
}

export async function obtenerListasPendientesSync(db: SqlDatabaseAdapter): Promise<ListaEntidad[]> {
  const rows = await db.getAllAsync<ListaRow>(
    `SELECT id, nombre, remote_id, updated_at, deleted, pending
     FROM lista
     WHERE pending = 1`,
  );
  const pendientes: ListaEntidad[] = [];
  for (const row of rows) {
    const opciones = await cargarOpcionesDeLista(db, row.id);
    pendientes.push({ ...row, opciones });
  }
  return pendientes;
}

export async function marcarListaSincronizada(
  db: SqlDatabaseAdapter,
  id: string,
  updatedAtServidor: string,
): Promise<void> {
  await db.runAsync(`UPDATE lista SET pending = 0, remote_id = ?, updated_at = ? WHERE id = ?`, [
    id,
    updatedAtServidor,
    id,
  ]);
  await db.runAsync(`UPDATE opcion SET pending = 0, updated_at = ? WHERE lista_id = ?`, [
    updatedAtServidor,
    id,
  ]);
}

export async function aplicarListaRemota(
  db: SqlDatabaseAdapter,
  remota: ListaRemotaPayload,
): Promise<void> {
  const local = await db.getFirstAsync<ListaRow>(
    `SELECT id, nombre, remote_id, updated_at, deleted, pending FROM lista WHERE id = ?`,
    [remota.id],
  );
  if (local && local.updated_at > remota.updated_at) {
    return;
  }

  if (remota.deleted_at !== null) {
    await db.runAsync(`UPDATE lista SET deleted = 1, pending = 0, updated_at = ? WHERE id = ?`, [
      remota.updated_at,
      remota.id,
    ]);
    return;
  }

  await guardarListaConOpciones(db, remota.id, remota.nombre, remota.opciones, 0);
  await marcarListaSincronizada(db, remota.id, remota.updated_at);
}

export async function sembrarListasInicialesSiVacio(db: SqlDatabaseAdapter): Promise<void> {
  const existentes = await listarListasActivas(db);
  if (existentes.length > 0) {
    return;
  }
  await guardarListaConOpciones(
    db,
    "lista-almuerzo-inicial",
    "¿Dónde almorzamos hoy?",
    [
      { id: "op-alm-1", texto: "Corrientazo casero", peso: 3 },
      { id: "op-alm-2", texto: "Pizzería napolitana", peso: 2 },
      { id: "op-alm-3", texto: "Tacos mexicanos", peso: 2 },
      { id: "op-alm-4", texto: "Hamburguesas", peso: 1 },
    ],
    1,
  );
  await guardarListaConOpciones(
    db,
    "lista-platos-inicial",
    "¿Quién lava los platos?",
    [
      { id: "op-pla-1", texto: "Juan Carlos", peso: 1 },
      { id: "op-pla-2", texto: "Mariana", peso: 1 },
      { id: "op-pla-3", texto: "Sebastián", peso: 1 },
      { id: "op-pla-4", texto: "Valentina", peso: 1 },
    ],
    1,
  );
}
