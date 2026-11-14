import { apiRequest } from "@/api/apiClient";
import { getSessionTokens } from "@/api/tokenStorage";
import type { SqlDatabaseAdapter } from "@/db/database";
import {
  aplicarGiroRemoto,
  type GiroRemotoPayload,
  guardarUltimoSince,
  marcarGiroSincronizado,
  obtenerGirosPendientesSync,
  obtenerUltimoSince,
} from "@/repositories/girosRepository";
import {
  aplicarListaRemota,
  type ListaRemotaPayload,
  marcarListaSincronizada,
  obtenerListasPendientesSync,
} from "@/repositories/listasRepository";

const MAX_BATCH = 500;

interface SyncPageResponse<T> {
  items: T[];
  servidor_ahora: string;
}

async function enviarListasPendientes(db: SqlDatabaseAdapter): Promise<number> {
  const pendientes = await obtenerListasPendientesSync(db);
  let enviados = 0;

  for (const lista of pendientes) {
    if (lista.deleted === 1) {
      await apiRequest(`/api/lista/${encodeURIComponent(lista.id)}`, {
        method: "DELETE",
      });
      await marcarListaSincronizada(db, lista.id, new Date().toISOString());
    } else {
      const remota = await apiRequest<ListaRemotaPayload>(
        `/api/lista/${encodeURIComponent(lista.id)}`,
        {
          method: "PUT",
          body: JSON.stringify({
            nombre: lista.nombre,
            opciones: lista.opciones.map((o) => ({
              texto: o.texto,
              peso: o.peso,
            })),
          }),
        },
      );
      await marcarListaSincronizada(db, lista.id, remota.updated_at);
    }
    enviados += 1;
  }
  return enviados;
}

async function enviarGirosPendientes(db: SqlDatabaseAdapter): Promise<number> {
  const pendientes = await obtenerGirosPendientesSync(db);
  let enviados = 0;

  for (const giro of pendientes) {
    if (giro.deleted === 1) {
      await apiRequest(`/api/giro/${encodeURIComponent(giro.id)}`, {
        method: "DELETE",
      });
      await marcarGiroSincronizado(db, giro.id, new Date().toISOString());
    } else {
      const remoto = await apiRequest<GiroRemotoPayload>(
        `/api/giro/${encodeURIComponent(giro.id)}`,
        {
          method: "PUT",
          body: JSON.stringify({
            lista_id: giro.lista_id,
            resultado: giro.resultado,
            girado_en: giro.girado_en,
          }),
        },
      );
      await marcarGiroSincronizado(db, giro.id, remoto.updated_at);
    }
    enviados += 1;
  }
  return enviados;
}

async function descargarCambiosListas(db: SqlDatabaseAdapter): Promise<number> {
  let cursor = await obtenerUltimoSince(db, "lista");
  let recibidos = 0;

  while (true) {
    const query = cursor ? `?since=${encodeURIComponent(cursor)}` : "";
    const page = await apiRequest<SyncPageResponse<ListaRemotaPayload>>(`/api/lista${query}`, {
      method: "GET",
    });

    for (const item of page.items) {
      await aplicarListaRemota(db, item);
      recibidos += 1;
    }

    const lastItem = page.items[page.items.length - 1];
    const nuevoSince = lastItem ? lastItem.updated_at : page.servidor_ahora;
    await guardarUltimoSince(db, "lista", nuevoSince);

    if (page.items.length < MAX_BATCH) {
      break;
    }
    cursor = nuevoSince;
  }
  return recibidos;
}

async function descargarCambiosGiros(db: SqlDatabaseAdapter): Promise<number> {
  let cursor = await obtenerUltimoSince(db, "giro");
  let recibidos = 0;

  while (true) {
    const query = cursor ? `?since=${encodeURIComponent(cursor)}` : "";
    const page = await apiRequest<SyncPageResponse<GiroRemotoPayload>>(`/api/giro${query}`, {
      method: "GET",
    });

    for (const item of page.items) {
      await aplicarGiroRemoto(db, item);
      recibidos += 1;
    }

    const lastItem = page.items[page.items.length - 1];
    const nuevoSince = lastItem ? lastItem.updated_at : page.servidor_ahora;
    await guardarUltimoSince(db, "giro", nuevoSince);

    if (page.items.length < MAX_BATCH) {
      break;
    }
    cursor = nuevoSince;
  }
  return recibidos;
}

export interface SyncResumen {
  sincronizado: boolean;
  enviados: number;
  recibidos: number;
  mensaje: string;
}

export async function sincronizarConApi(db: SqlDatabaseAdapter): Promise<SyncResumen> {
  const { token } = await getSessionTokens();
  if (!token) {
    return {
      sincronizado: false,
      enviados: 0,
      recibidos: 0,
      mensaje: "Modo sin cuenta (local en SQLite).",
    };
  }

  try {
    const lEnv = await enviarListasPendientes(db);
    const gEnv = await enviarGirosPendientes(db);
    const lRec = await descargarCambiosListas(db);
    const gRec = await descargarCambiosGiros(db);

    return {
      sincronizado: true,
      enviados: lEnv + gEnv,
      recibidos: lRec + gRec,
      mensaje: "Sincronización completada con éxito.",
    };
  } catch {
    return {
      sincronizado: false,
      enviados: 0,
      recibidos: 0,
      mensaje: "Sin conexión con el servidor; cambios guardados en SQLite.",
    };
  }
}
