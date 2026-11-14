import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const verifyIdTokenMock = vi.fn();

vi.mock("@/lib/firebase-admin", () => ({
  getAdminAuth: () => ({
    verifyIdToken: verifyIdTokenMock,
  }),
  getAdminDb: vi.fn(),
  getFirebaseAdminApp: vi.fn(),
  normalizePrivateKey: (k?: string) => k?.replace(/\\n/g, "\n"),
  resolveFirebaseEnv: vi.fn(),
}));

import { GET as getAdminResumen } from "@/app/api/admin/resumen/route";
import { POST as postLogin } from "@/app/api/auth/login/route";
import { POST as postRefresh } from "@/app/api/auth/refresh/route";
import { POST as postRegistro } from "@/app/api/auth/registro/route";
import { GET as getYo } from "@/app/api/auth/yo/route";
import { checkLoginRateLimit, mapFirebaseAuthError, resetRateLimiterForTests } from "@/lib/auth";
import { parseJsonBody } from "@/lib/errors";

function makeJsonRequest(url: string, method: string, body?: unknown, token?: string): NextRequest {
  const headers = new Headers({ "Content-Type": "application/json" });
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  return new NextRequest(url, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

describe("Rutas de Autenticación · Registro (POST /api/auth/registro)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    resetRateLimiterForTests();
    process.env.FIREBASE_WEB_API_KEY = "test-web-api-key";
  });

  it("Responde 201 con token y usuario al registrar y 400/409 en error", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          idToken: "id-tok-1",
          refreshToken: "ref-tok-1",
          expiresIn: "3600",
          localId: "uid-1",
          email: "nuevo@test.com",
        }),
        { status: 200 },
      ),
    );
    const req = makeJsonRequest("http://localhost/api/auth/registro", "POST", {
      email: "nuevo@test.com",
      password: "password123",
    });
    expect((await postRegistro(req)).status).toBe(201);

    const badReq = makeJsonRequest("http://localhost/api/auth/registro", "POST", {
      email: "a@b.com",
      password: "123",
    });
    expect((await postRegistro(badReq)).status).toBe(400);

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ error: { message: "EMAIL_EXISTS" } }), {
        status: 400,
      }),
    );
    const dupReq = makeJsonRequest("http://localhost/api/auth/registro", "POST", {
      email: "dup@b.com",
      password: "password123",
    });
    expect((await postRegistro(dupReq)).status).toBe(409);
  });
});

describe("Rutas de Autenticación · Login (POST /api/auth/login)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    resetRateLimiterForTests();
    process.env.FIREBASE_WEB_API_KEY = "test-web-api-key";
  });

  it("POST /api/auth/login devuelve 200 en éxito y 401 en credenciales inválidas", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          idToken: "tok-ok",
          refreshToken: "ref-ok",
          localId: "u-1",
        }),
        { status: 200 },
      ),
    );
    const okLogin = makeJsonRequest("http://localhost/api/auth/login", "POST", {
      email: "u@b.com",
      password: "password123",
    });
    expect((await postLogin(okLogin)).status).toBe(200);

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ error: { message: "INVALID_LOGIN_CREDENTIALS" } }), {
        status: 400,
      }),
    );
    const badLogin = makeJsonRequest("http://localhost/api/auth/login", "POST", {
      email: "u@b.com",
      password: "wrong",
    });
    expect((await postLogin(badLogin)).status).toBe(401);
  });
});

describe("Rutas de Autenticación · Refresh y Perfil Yo", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    verifyIdTokenMock.mockReset();
    process.env.FIREBASE_WEB_API_KEY = "test-web-api-key";
  });

  it("POST /api/auth/refresh (200 y 401) y GET /api/auth/yo (401 y 200)", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ id_token: "new-id", refresh_token: "new-ref" }), {
        status: 200,
      }),
    );
    expect(
      (
        await postRefresh(
          makeJsonRequest("http://localhost/api/auth/refresh", "POST", {
            refreshToken: "old-ref",
          }),
        )
      ).status,
    ).toBe(200);

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({}), { status: 400 }),
    );
    expect(
      (
        await postRefresh(
          makeJsonRequest("http://localhost/api/auth/refresh", "POST", {
            refreshToken: "bad-ref",
          }),
        )
      ).status,
    ).toBe(401);

    expect((await getYo(new NextRequest("http://localhost/api/auth/yo"))).status).toBe(401);
    verifyIdTokenMock.mockRejectedValueOnce(new Error("expired"));
    expect(
      (await getYo(makeJsonRequest("http://localhost/api/auth/yo", "GET", undefined, "x"))).status,
    ).toBe(401);
    verifyIdTokenMock.mockResolvedValueOnce({ uid: "user-99" });
    expect(
      (await getYo(makeJsonRequest("http://localhost/api/auth/yo", "GET", undefined, "v"))).status,
    ).toBe(200);
  });
});

describe("Rutas de Autenticación · Rol Admin (403) y Validaciones HTTP", () => {
  beforeEach(() => {
    verifyIdTokenMock.mockReset();
    resetRateLimiterForTests();
  });

  it("GET /api/admin/resumen exige rol=admin y parseJsonBody valida 415/400", async () => {
    verifyIdTokenMock.mockResolvedValueOnce({ uid: "u1", rol: "usuario" });
    expect(
      (
        await getAdminResumen(
          makeJsonRequest("http://localhost/api/admin/resumen", "GET", undefined, "tok"),
        )
      ).status,
    ).toBe(403);

    verifyIdTokenMock.mockResolvedValueOnce({ uid: "u2", rol: "admin" });
    expect(
      (
        await getAdminResumen(
          makeJsonRequest("http://localhost/api/admin/resumen", "GET", undefined, "tok"),
        )
      ).status,
    ).toBe(200);

    await expect(
      parseJsonBody(new NextRequest("http://localhost/api", { method: "POST" })),
    ).rejects.toThrow();

    await expect(
      parseJsonBody(
        new NextRequest("http://localhost/api", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "{malformed",
        }),
      ),
    ).rejects.toThrow();

    for (let i = 0; i < 10; i += 1) {
      checkLoginRateLimit("ip-1", 1000);
    }
    expect(() => checkLoginRateLimit("ip-1", 1000)).toThrow();
    expect(mapFirebaseAuthError("WEAK_PASSWORD").statusCode).toBe(400);
    expect(mapFirebaseAuthError("TOO_MANY_ATTEMPTS_TRY_LATER").statusCode).toBe(429);
  });
});
