import { AppHttpError } from "@/lib/errors";
import { getAdminDb } from "@/lib/firebase-admin";
import type { GiroPutInput } from "@/schemas/giro.schema";
import type { ListaPutInput } from "@/schemas/lista.schema";
import type { GiroDocument, ListaDocument, SyncListResponse } from "@/types/models";

const MAX_SYNC_ITEMS = 500;

export interface OpcionEstadistica {
  opcion: string;
  cantidad: number;
  porcentaje: number;
}

export interface EstadisticasGirosResponse {
  lista_id: string;
  total_giros: number;
  conteo_por_opcion: OpcionEstadistica[];
}

function getCollectionRef(uid: string, resource: "lista" | "giro") {
  return getAdminDb().collection("usuarios").doc(uid).collection(resource);
}

export async function listSyncResources<T>(
  uid: string,
  resource: "lista" | "giro",
  since?: string,
): Promise<SyncListResponse<T>> {
  const col = getCollectionRef(uid, resource);
  let query = col.orderBy("updated_at", "asc").limit(MAX_SYNC_ITEMS);

  if (since) {
    query = col.where("updated_at", ">", since).orderBy("updated_at", "asc").limit(MAX_SYNC_ITEMS);
  }

  const snapshot = await query.get();
  const items: T[] = [];
  snapshot.forEach((docSnap) => {
    const data = docSnap.data();
    if (data) {
      items.push(data as T);
    }
  });

  return {
    items,
    servidor_ahora: new Date().toISOString(),
  };
}

async function assertUniqueListaName(
  uid: string,
  currentId: string,
  nombre: string,
): Promise<void> {
  const col = getCollectionRef(uid, "lista");
  const snapshot = await col.where("deleted_at", "==", null).get();
  const target = nombre.trim().toLocaleLowerCase("es");

  snapshot.forEach((docSnap) => {
    const data = docSnap.data();
    const existingName =
      typeof data?.nombre === "string" ? data.nombre.trim().toLocaleLowerCase("es") : "";
    if (docSnap.id !== currentId && existingName === target) {
      throw new AppHttpError(409, "Ya existe una lista con ese nombre para este usuario");
    }
  });
}

export async function upsertLista(
  uid: string,
  id: string,
  input: ListaPutInput,
): Promise<ListaDocument> {
  await assertUniqueListaName(uid, id, input.nombre);

  const docRef = getCollectionRef(uid, "lista").doc(id);
  const existingSnap = await docRef.get();
  const existingData = existingSnap.exists ? existingSnap.data() : undefined;
  const now = new Date().toISOString();
  const createdAt = typeof existingData?.created_at === "string" ? existingData.created_at : now;

  const doc: ListaDocument = {
    id,
    nombre: input.nombre,
    opciones: input.opciones.map((op) => ({
      texto: op.texto,
      peso: op.peso,
    })),
    created_at: createdAt,
    updated_at: now,
    deleted_at: null,
  };

  await docRef.set(doc);
  return doc;
}

export async function upsertGiro(
  uid: string,
  id: string,
  input: GiroPutInput,
): Promise<GiroDocument> {
  const docRef = getCollectionRef(uid, "giro").doc(id);
  const existingSnap = await docRef.get();
  const existingData = existingSnap.exists ? existingSnap.data() : undefined;
  const now = new Date().toISOString();
  const createdAt = typeof existingData?.created_at === "string" ? existingData.created_at : now;

  const doc: GiroDocument = {
    id,
    lista_id: input.lista_id,
    resultado: input.resultado,
    girado_en: input.girado_en,
    created_at: createdAt,
    updated_at: now,
    deleted_at: null,
  };

  await docRef.set(doc);
  return doc;
}

export async function softDeleteResource(
  uid: string,
  resource: "lista" | "giro",
  id: string,
): Promise<{ ok: true }> {
  const docRef = getCollectionRef(uid, resource).doc(id);
  const existingSnap = await docRef.get();
  const existingData = existingSnap.exists ? existingSnap.data() : undefined;

  if (!existingSnap.exists || existingData?.deleted_at !== null) {
    throw new AppHttpError(404, "Recurso no encontrado");
  }

  const now = new Date().toISOString();
  await docRef.update({
    updated_at: now,
    deleted_at: now,
  });

  return { ok: true };
}

export function computeStatisticsFromResults(
  listaId: string,
  resultados: string[],
): EstadisticasGirosResponse {
  const counts = new Map<string, number>();
  for (const res of resultados) {
    counts.set(res, (counts.get(res) ?? 0) + 1);
  }

  const total = resultados.length;
  const conteoPorOpcion: OpcionEstadistica[] = Array.from(counts.entries())
    .map(([opcion, cantidad]) => ({
      opcion,
      cantidad,
      porcentaje: total > 0 ? Math.round((cantidad / total) * 10000) / 100 : 0,
    }))
    .sort((a, b) => b.cantidad - a.cantidad);

  return {
    lista_id: listaId,
    total_giros: total,
    conteo_por_opcion: conteoPorOpcion,
  };
}

export async function getGiroStatsForLista(
  uid: string,
  listaId: string,
): Promise<EstadisticasGirosResponse> {
  const col = getCollectionRef(uid, "giro");
  const snapshot = await col.where("lista_id", "==", listaId).where("deleted_at", "==", null).get();

  const resultados: string[] = [];
  snapshot.forEach((docSnap) => {
    const data = docSnap.data();
    if (typeof data?.resultado === "string") {
      resultados.push(data.resultado);
    }
  });

  return computeStatisticsFromResults(listaId, resultados);
}
