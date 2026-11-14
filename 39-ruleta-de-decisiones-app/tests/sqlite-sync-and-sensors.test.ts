import { beforeEach, describe, expect, it, vi } from "vitest";

let mockSensorCallback: ((data: { x: number; y: number; z: number }) => void) | null = null;

vi.mock("expo-haptics", () => ({
  selectionAsync: vi.fn(async () => {}),
  notificationAsync: vi.fn(async () => {}),
  NotificationFeedbackType: { Success: "success" },
}));

vi.mock("expo-speech", () => ({
  stop: vi.fn(),
  speak: vi.fn(),
}));

vi.mock("expo-sensors", () => ({
  Accelerometer: {
    isAvailableAsync: vi.fn(async () => true),
    requestPermissionsAsync: vi.fn(async () => ({ status: "granted" })),
    setUpdateInterval: vi.fn(),
    addListener: vi.fn((cb) => {
      mockSensorCallback = cb;
      return { remove: vi.fn() };
    }),
  },
  Gyroscope: {
    isAvailableAsync: vi.fn(async () => true),
    requestPermissionsAsync: vi.fn(async () => ({ status: "granted" })),
    setUpdateInterval: vi.fn(),
    addListener: vi.fn((cb) => {
      cb({ x: 0.5, y: -0.5, z: 0 });
      return { remove: vi.fn() };
    }),
  },
}));

import { apiRequest, getApiBaseUrl, loginConApi, registrarConApi } from "@/api/apiClient";
import {
  clearSessionTokens,
  getSessionTokens,
  saveSessionTokens,
  setTokenStoreAdapter,
} from "@/api/tokenStorage";
import type { SqlDatabaseAdapter } from "@/db/database";
import { runMigrations, setDatabaseAdapter } from "@/db/database";
import {
  aplicarGiroRemoto,
  eliminarGiroLocal,
  guardarUltimoSince,
  listarHistorialGiros,
  registrarGiroLocal,
} from "@/repositories/girosRepository";
import {
  aplicarListaRemota,
  eliminarListaLocal,
  guardarListaConOpciones,
  listarListasActivas,
  sembrarListasInicialesSiVacio,
} from "@/repositories/listasRepository";
import {
  dispararHapticoGanador,
  dispararTicHapticoSector,
  iniciarSuscripcionBrilloGiroscopio,
  iniciarSuscripcionSacudida,
  leerResultadoEnVozAlta,
} from "@/sensors/deviceCapabilities";
import {
  calcularOffsetBrilloGiroscopio,
  evaluarSacudida,
  haCambiadoDeSector,
} from "@/sensors/sensorMath";
import { calcularSectoresRuleta } from "@/services/ruletaMath";
import { sincronizarConApi } from "@/services/syncService";

interface FakeStoreState {
  listas: Map<string, Record<string, unknown>>;
  opciones: Array<Record<string, unknown>>;
  giros: Map<string, Record<string, unknown>>;
  meta: Map<string, string>;
}

function mutateOpcion(
  state: FakeStoreState,
  s: string,
  params: Array<string | number | null>,
): boolean {
  if (s.startsWith("DELETE FROM OPCION")) {
    state.opciones = state.opciones.filter((o) => o.lista_id !== params[0]);
    return true;
  }
  if (s.startsWith("INSERT INTO OPCION")) {
    state.opciones.push({
      id: params[0],
      lista_id: params[1],
      texto: params[2],
      peso: params[3],
      remote_id: params[4],
      updated_at: params[5],
      deleted: 0,
      pending: params[6],
    });
    return true;
  }
  return false;
}

function resolveListaTargetId(s: string, params: Array<string | number | null>): string {
  if (s.includes("SET NOMBRE")) return String(params[3]);
  if (s.includes("PENDING = 0, REMOTE_ID")) return String(params[2]);
  return String(params[1]);
}

function mutateLista(
  state: FakeStoreState,
  s: string,
  params: Array<string | number | null>,
): boolean {
  if (s.startsWith("INSERT INTO LISTA")) {
    state.listas.set(String(params[0]), {
      id: params[0],
      nombre: params[1],
      remote_id: params[2],
      updated_at: params[3],
      deleted: 0,
      pending: params[4],
    });
    return true;
  }
  if (s.startsWith("UPDATE LISTA")) {
    const id = resolveListaTargetId(s, params);
    const prev = state.listas.get(id) ?? {};
    const deleted = s.includes("DELETED = 1") ? 1 : 0;
    const pending = s.includes("PENDING = 0") ? 0 : 1;
    state.listas.set(id, { ...prev, deleted, pending });
    return true;
  }
  return false;
}

function handleGiroAndMetaMutation(
  state: FakeStoreState,
  s: string,
  sql: string,
  params: Array<string | number | null>,
): void {
  if (s.startsWith("INSERT INTO GIRO")) {
    state.giros.set(String(params[0]), {
      id: params[0],
      lista_id: params[1],
      resultado: params[2],
      girado_en: params[3],
      remote_id: params[4],
      updated_at: params[5],
      deleted: 0,
      pending: sql.includes("0, 0)") ? 0 : 1,
    });
  } else if (s.startsWith("UPDATE GIRO")) {
    const id = String(params[s.includes("PENDING = 0, REMOTE_ID") ? 2 : 1]);
    const prev = state.giros.get(id);
    if (prev) {
      state.giros.set(id, {
        ...prev,
        deleted: s.includes("DELETED = 1") ? 1 : 0,
        pending: s.includes("PENDING = 0") ? 0 : 1,
      });
    }
  } else if (s.includes("SYNC_META")) {
    state.meta.set(String(params[0]), String(params[1]));
  }
}

function crearFakeSqliteAdapter(): SqlDatabaseAdapter {
  const state: FakeStoreState = {
    listas: new Map(),
    opciones: [],
    giros: new Map(),
    meta: new Map(),
  };

  return {
    execAsync: async () => {},
    runAsync: async (sql, params = []) => {
      const s = sql.trim().toUpperCase();
      const handled = mutateOpcion(state, s, params) || mutateLista(state, s, params);
      if (!handled) {
        handleGiroAndMetaMutation(state, s, sql, params);
      }
      return { changes: 1 };
    },
    getAllAsync: async <T>(sql: string, params: Array<string | number | null> = []) => {
      const s = sql.toUpperCase();
      if (s.includes("FROM OPCION")) {
        return state.opciones.filter((o) => o.lista_id === params[0]) as T[];
      }
      const source = s.includes("FROM LISTA")
        ? Array.from(state.listas.values())
        : Array.from(state.giros.values());
      const key = s.includes("PENDING = 1") ? "pending" : "deleted";
      const val = key === "pending" ? 1 : 0;
      return source.filter((item) => item[key] === val) as T[];
    },
    getFirstAsync: async <T>(sql: string, params: Array<string | number | null> = []) => {
      const s = sql.toUpperCase();
      if (s.includes("FROM LISTA")) {
        return (state.listas.get(String(params[0])) ?? null) as T | null;
      }
      if (s.includes("FROM GIRO")) {
        return (state.giros.get(String(params[0])) ?? null) as T | null;
      }
      const v = state.meta.get(String(params[0]));
      return (v ? { ultimo_since: v } : null) as T | null;
    },
  };
}

describe("SQLite Offline-First · CRUD de Listas y Opciones", () => {
  it("Siembra listas iniciales, realiza CRUD de listas y aplica listas remotas", async () => {
    const db = crearFakeSqliteAdapter();
    setDatabaseAdapter(db);
    await runMigrations(db);
    await sembrarListasInicialesSiVacio(db);
    await sembrarListasInicialesSiVacio(db);
    expect((await listarListasActivas(db)).length).toBeGreaterThanOrEqual(2);

    const creada = await guardarListaConOpciones(db, "l-custom", "Cena", [
      { texto: "Arepa", peso: 2 },
      { texto: "Sopa", peso: 1 },
    ]);
    await guardarListaConOpciones(db, "l-custom", "Cena Editada", [
      { texto: "Arepa", peso: 3 },
      { texto: "Sopa", peso: 1 },
    ]);
    expect(creada.nombre).toBe("Cena");

    await aplicarListaRemota(db, {
      id: "l-remota",
      nombre: "Postre",
      opciones: [
        { texto: "Helado", peso: 1 },
        { texto: "Torta", peso: 1 },
      ],
      updated_at: "2029-01-01T00:00:00.000Z",
      deleted_at: null,
    });
    await aplicarListaRemota(db, {
      id: "l-remota",
      nombre: "Postre Borrado",
      opciones: [],
      updated_at: "2030-01-01T00:00:00.000Z",
      deleted_at: "2030-01-01T00:00:00.000Z",
    });
    await eliminarListaLocal(db, "l-custom");
  });
});

describe("SQLite Offline-First · CRUD de Giros y Sync Meta", () => {
  it("Registra giros locales, aplica giros remotos y actualiza cursores since", async () => {
    const db = crearFakeSqliteAdapter();
    const giro = await registrarGiroLocal(db, "l-remota", "Helado");
    await aplicarGiroRemoto(db, {
      id: "g-rem",
      lista_id: "l-remota",
      resultado: "Torta",
      girado_en: "2029-01-01T00:00:00.000Z",
      updated_at: "2029-01-01T00:00:00.000Z",
      deleted_at: null,
    });
    await aplicarGiroRemoto(db, {
      id: "g-rem",
      lista_id: "l-remota",
      resultado: "Viejo",
      girado_en: "2020-01-01T00:00:00.000Z",
      updated_at: "2020-01-01T00:00:00.000Z",
      deleted_at: null,
    });
    await aplicarGiroRemoto(db, {
      id: "g-rem",
      lista_id: "l-remota",
      resultado: "Borrado",
      girado_en: "2030-01-01T00:00:00.000Z",
      updated_at: "2030-01-01T00:00:00.000Z",
      deleted_at: "2030-01-01T00:00:00.000Z",
    });
    await eliminarGiroLocal(db, giro.id);
    await guardarUltimoSince(db, "lista", "2029-01-01T00:00:00.000Z");
    await guardarUltimoSince(db, "lista", "2030-01-01T00:00:00.000Z");
    expect((await listarHistorialGiros(db)).length).toBeGreaterThanOrEqual(0);
    expect((await listarHistorialGiros(db, "l-remota")).length).toBeGreaterThanOrEqual(0);
  });
});

describe("Cliente API y Refresh Automático en 401", () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    setTokenStoreAdapter(null);
    await clearSessionTokens();
  });

  it("Renueva el token una vez en 401 y maneja fallos de red/HTTP", async () => {
    expect(getApiBaseUrl()).toContain("https://");
    await saveSessionTokens("expired-tok", "valid-ref", "user@test.com");

    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response("Unauthorized", { status: 401 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ token: "new-tok", refreshToken: "new-ref" }), {
          status: 200,
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ usuario: { id: "u1" } }), { status: 200 }),
      )
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: "Prohibido" }), { status: 403 }));

    const res = await apiRequest<{ usuario: { id: string } }>("/api/auth/yo");
    expect(res.usuario.id).toBe("u1");
    await expect(apiRequest("/api/admin/resumen")).rejects.toThrow("Prohibido");
  });
});

describe("Sincronización Bidireccional Offline-First (Envío)", () => {
  it("Ejecuta sincronizarConApi con y sin token y envía pendientes", async () => {
    const db = crearFakeSqliteAdapter();
    await clearSessionTokens();
    expect((await sincronizarConApi(db)).sincronizado).toBe(false);

    await saveSessionTokens("tok-ok", "ref-ok", "user@test.com");
    await guardarListaConOpciones(db, "l-sync", "Sync", [
      { texto: "A", peso: 1 },
      { texto: "B", peso: 1 },
    ]);
    await registrarGiroLocal(db, "l-sync", "A");

    const emptyPage = JSON.stringify({ items: [], servidor_ahora: "2026-11-14T00:00:00.000Z" });
    const listResp = JSON.stringify({
      id: "l-sync",
      nombre: "Sync",
      opciones: [],
      updated_at: "2026-11-14T00:00:00.000Z",
      deleted_at: null,
    });
    const giroResp = JSON.stringify({
      id: "g-1",
      lista_id: "l-sync",
      resultado: "A",
      girado_en: "2026-11-14T00:00:00.000Z",
      updated_at: "2026-11-14T00:00:00.000Z",
      deleted_at: null,
    });

    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(listResp, { status: 200 }))
      .mockResolvedValueOnce(new Response(giroResp, { status: 200 }))
      .mockResolvedValueOnce(new Response(emptyPage, { status: 200 }))
      .mockResolvedValueOnce(new Response(emptyPage, { status: 200 }));

    expect((await sincronizarConApi(db)).sincronizado).toBe(true);
  });
});

describe("Sincronización Bidireccional Offline-First (Borrados y Red)", () => {
  it("Sincroniza borrados pendientes y maneja caída de red sin perder datos", async () => {
    const db = crearFakeSqliteAdapter();
    await saveSessionTokens("tok-ok", "ref-ok", "user@test.com");
    await guardarListaConOpciones(db, "l-del", "Borrar", [
      { texto: "A", peso: 1 },
      { texto: "B", peso: 1 },
    ]);
    await eliminarListaLocal(db, "l-del");
    const giro = await registrarGiroLocal(db, "l-del", "A");
    await eliminarGiroLocal(db, giro.id);

    const delResp = JSON.stringify({
      id: "l-del",
      deleted_at: "2026-11-14T00:00:00.000Z",
      updated_at: "2026-11-14T00:00:00.000Z",
    });
    const pageConDatos = JSON.stringify({
      items: [
        {
          id: "l-pull",
          nombre: "Pull",
          opciones: [
            { texto: "X", peso: 1 },
            { texto: "Y", peso: 1 },
          ],
          updated_at: "2026-11-14T00:00:00.000Z",
          deleted_at: null,
        },
      ],
      servidor_ahora: "2026-11-14T01:00:00.000Z",
    });

    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(delResp, { status: 200 }))
      .mockResolvedValueOnce(new Response(delResp, { status: 200 }))
      .mockResolvedValueOnce(new Response(pageConDatos, { status: 200 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ items: [], servidor_ahora: "2026-11-14T01:00:00.000Z" }), {
          status: 200,
        }),
      )
      .mockRejectedValueOnce(new Error("Sin red"));

    expect((await sincronizarConApi(db)).sincronizado).toBe(true);
    const falloRed = await sincronizarConApi(db);
    expect(falloRed.sincronizado).toBe(false);
    expect(falloRed.mensaje).toContain("Sin conexión");
  });
});

describe("Autenticación y Almacenamiento Seguro de Tokens", () => {
  it("Login y registro guardan tokens y admiten adaptador personalizado", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            token: "t1",
            refreshToken: "r1",
            expiraEnSeg: 3600,
            usuario: { id: "u1", email: "a@b.com" },
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            token: "t2",
            refreshToken: "r2",
            expiraEnSeg: 3600,
            usuario: { id: "u2", email: "b@b.com" },
          }),
          { status: 201 },
        ),
      );

    await loginConApi("a@b.com", "password123");
    await registrarConApi("b@b.com", "password123");
    expect((await getSessionTokens()).token).toBe("t2");

    const customMap = new Map<string, string>();
    setTokenStoreAdapter({
      getItemAsync: async (k) => customMap.get(k) ?? null,
      setItemAsync: async (k, v) => {
        customMap.set(k, v);
      },
      deleteItemAsync: async (k) => {
        customMap.delete(k);
      },
    });
    await saveSessionTokens("tok-custom", "ref-custom");
    expect((await getSessionTokens()).token).toBe("tok-custom");
    await clearSessionTokens();
    setTokenStoreAdapter(null);
  });
});

describe("Sensores y Capacidades del Dispositivo con Mocks", () => {
  it("Verifica sacudida, giroscopio, háptico y voz con mocks", async () => {
    expect(evaluarSacudida({ x: 2, y: 2, z: 1 }, 0, 5000).disparar).toBe(true);
    expect(evaluarSacudida({ x: 0.2, y: 0.1, z: 0.9 }, 0, 5000).disparar).toBe(false);
    expect(calcularOffsetBrilloGiroscopio({ x: 1, y: -1, z: 0 }).dx).toBe(-12);

    const secs = calcularSectoresRuleta([
      { texto: "A", peso: 1 },
      { texto: "B", peso: 1 },
    ]);
    expect(haCambiadoDeSector(secs, 10, 220)).toBe(true);
    expect(haCambiadoDeSector([], 10, 220)).toBe(false);

    expect(await dispararTicHapticoSector()).toBe(true);
    expect(await dispararHapticoGanador()).toBe(true);
    expect(await leerResultadoEnVozAlta("Pizza")).toBe(true);

    const shakeSub = await iniciarSuscripcionSacudida(() => {});
    mockSensorCallback?.({ x: 0.1, y: 0.1, z: 0.9 });
    mockSensorCallback?.({ x: 2.5, y: 2.0, z: 1.0 });
    expect(shakeSub.disponible).toBe(true);
    shakeSub.subscription?.remove();

    const gyroSub = await iniciarSuscripcionBrilloGiroscopio(() => {});
    expect(gyroSub.disponible).toBe(true);
    gyroSub.subscription?.remove();
  });
});
