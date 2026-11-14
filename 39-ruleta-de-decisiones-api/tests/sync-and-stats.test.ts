import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

type StoredDoc = Record<string, unknown>;
const fakeStore = new Map<string, StoredDoc>();
const verifyIdTokenMock = vi.fn();

function createMockCollection(uid: string, resource: string) {
  const prefix = `usuarios/${uid}/${resource}/`;
  const matchingDocs = () =>
    Array.from(fakeStore.entries())
      .filter(([key]) => key.startsWith(prefix))
      .map(([key, data]) => ({
        id: key.slice(prefix.length),
        exists: true,
        data: () => data,
      }));

  const buildQuery = (filters: Array<{ field: string; op: string; val: unknown }> = []) => ({
    where: (field: string, op: string, val: unknown) =>
      buildQuery([...filters, { field, op, val }]),
    orderBy: () => buildQuery(filters),
    limit: () => buildQuery(filters),
    get: async () => {
      const docs = matchingDocs().filter((d) => {
        const rec = d.data();
        return filters.every((f) =>
          f.op === "==" ? rec[f.field] === f.val : String(rec[f.field] ?? "") > String(f.val),
        );
      });
      return {
        forEach: (cb: (doc: (typeof docs)[number]) => void) => docs.forEach(cb),
      };
    },
  });

  return {
    ...buildQuery(),
    doc: (id: string) => {
      const fullKey = `${prefix}${id}`;
      return {
        get: async () => ({
          id,
          exists: fakeStore.has(fullKey),
          data: () => fakeStore.get(fullKey),
        }),
        set: async (data: StoredDoc) => {
          fakeStore.set(fullKey, { ...data });
        },
        update: async (patch: StoredDoc) => {
          const prev = fakeStore.get(fullKey) ?? {};
          fakeStore.set(fullKey, { ...prev, ...patch });
        },
      };
    },
  };
}

vi.mock("@/lib/firebase-admin", () => ({
  getAdminAuth: () => ({ verifyIdToken: verifyIdTokenMock }),
  getAdminDb: () => ({
    collection: () => ({
      doc: (uid: string) => ({
        collection: (resource: string) => createMockCollection(uid, resource),
      }),
    }),
  }),
  getFirebaseAdminApp: vi.fn(),
  normalizePrivateKey: (k?: string) => k?.replace(/\\n/g, "\n"),
  resolveFirebaseEnv: vi.fn(),
}));

import { DELETE as deleteGiro, PUT as putGiro } from "@/app/api/giros/[id]/route";
import { GET as getStats } from "@/app/api/giros/estadisticas/route";
import { GET as getGiros } from "@/app/api/giros/route";
import { DELETE as deleteLista, PUT as putLista } from "@/app/api/listas/[id]/route";
import { GET as getListas } from "@/app/api/listas/route";

function authReq(url: string, method: string, token: string, body?: unknown): NextRequest {
  const headers = new Headers({
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  });
  return new NextRequest(url, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

describe("Sincronización y Aislamiento entre Usuarios · Listas (PUT y GET)", () => {
  beforeEach(() => {
    fakeStore.clear();
    verifyIdTokenMock.mockReset();
  });

  it("Aísla datos entre usuarios, actualiza lista existente y bloquea nombres duplicados (409)", async () => {
    verifyIdTokenMock.mockResolvedValue({ uid: "uid-A", email: "a@test.com" });
    const payload = {
      nombre: "Almuerzo",
      opciones: [
        { texto: "Tacos", peso: 2 },
        { texto: "Sushi", peso: 1 },
      ],
    };
    const u1 = "http://localhost/api/listas/lista-1";
    const p1 = { params: Promise.resolve({ id: "lista-1" }) };
    expect((await putLista(authReq(u1, "PUT", "tok-A", payload), p1)).status).toBe(200);
    expect((await putLista(authReq(u1, "PUT", "tok-A", payload), p1)).status).toBe(200);

    const dupNameReq = authReq("http://localhost/api/listas/lista-2", "PUT", "tok-A", {
      nombre: "almuerzo",
      opciones: [
        { texto: "Pizza", peso: 1 },
        { texto: "Pasta", peso: 1 },
      ],
    });
    expect(
      (
        await putLista(dupNameReq, {
          params: Promise.resolve({ id: "lista-2" }),
        })
      ).status,
    ).toBe(409);

    verifyIdTokenMock.mockResolvedValue({ uid: "uid-B", email: "b@test.com" });
    const resGetB = await getListas(authReq("http://localhost/api/listas", "GET", "tok-B"));
    const bodyB = (await resGetB.json()) as { items: unknown[] };
    expect(bodyB.items).toHaveLength(0);
  });
});

describe("Borrado Lógico de Listas (DELETE /api/listas/[id])", () => {
  beforeEach(() => {
    fakeStore.clear();
    verifyIdTokenMock.mockResolvedValue({ uid: "uid-A", email: "a@test.com" });
  });

  it("Realiza borrado lógico (DELETE) de lista y devuelve 404 si ya estaba borrada", async () => {
    const uDel = "http://localhost/api/listas/lista-del";
    const pDel = { params: Promise.resolve({ id: "lista-del" }) };
    await putLista(
      authReq(uDel, "PUT", "tok-A", {
        nombre: "Borrar",
        opciones: [
          { texto: "Op1", peso: 1 },
          { texto: "Op2", peso: 1 },
        ],
      }),
      pDel,
    );
    expect((await deleteLista(authReq(uDel, "DELETE", "tok-A"), pDel)).status).toBe(200);
    expect((await deleteLista(authReq(uDel, "DELETE", "tok-A"), pDel)).status).toBe(404);
  });
});

describe("Sincronización de Giros y Endpoint GET /api/giros/estadisticas", () => {
  beforeEach(() => {
    fakeStore.clear();
    verifyIdTokenMock.mockResolvedValue({ uid: "uid-1", email: "u1@test.com" });
  });

  it("Registra giros, sincroniza con/sin since y calcula estadísticas de equidad", async () => {
    const uEmpty = "http://localhost/api/giros/estadisticas?lista=lista-vacia";
    expect((await getStats(authReq(uEmpty, "GET", "tok-1"))).status).toBe(200);
    const uMissing = "http://localhost/api/giros/estadisticas";
    expect((await getStats(authReq(uMissing, "GET", "tok-1"))).status).toBe(400);

    const giroPayload = {
      lista_id: "lista-1",
      resultado: "Tacos",
      girado_en: "2026-11-01T15:00:00.000Z",
    };
    const uGiro1 = "http://localhost/api/giros/giro-1";
    const pGiro1 = { params: Promise.resolve({ id: "giro-1" }) };
    await putGiro(authReq(uGiro1, "PUT", "tok-1", giroPayload), pGiro1);
    await putGiro(authReq(uGiro1, "PUT", "tok-1", giroPayload), pGiro1);

    const uGiros = "http://localhost/api/giros";
    expect((await getGiros(authReq(uGiros, "GET", "tok-1"))).status).toBe(200);
    const uSince = "http://localhost/api/giros?since=2020-01-01T00:00:00.000Z";
    expect((await getGiros(authReq(uSince, "GET", "tok-1"))).status).toBe(200);
    const uStats = "http://localhost/api/giros/estadisticas?lista=lista-1";
    expect((await getStats(authReq(uStats, "GET", "tok-1"))).status).toBe(200);
    expect((await deleteGiro(authReq(uGiro1, "DELETE", "tok-1"), pGiro1)).status).toBe(200);
  });
});
