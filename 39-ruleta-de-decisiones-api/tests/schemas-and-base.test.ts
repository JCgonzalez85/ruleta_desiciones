import { describe, expect, it } from "vitest";
import { GET as getHealth, runtime } from "@/app/api/health/route";
import { AppHttpError, buildErrorResponse, handleRouteError } from "@/lib/errors";
import {
  getAdminAuth,
  getAdminDb,
  getFirebaseAdminApp,
  normalizePrivateKey,
  resolveFirebaseEnv,
} from "@/lib/firebase-admin";
import { loginSchema, refreshSchema, registroSchema } from "@/schemas/auth.schema";
import { giroPutSchema, sinceQuerySchema } from "@/schemas/giro.schema";
import { hasNoDuplicateOptions, listaPutSchema, resourceIdSchema } from "@/schemas/lista.schema";

describe("GET /api/health y Firebase Admin Config", () => {
  it("GET /api/health responde 200 con runtime nodejs", async () => {
    expect(runtime).toBe("nodejs");
    const response = await getHealth();
    expect(response.status).toBe(200);
    const body: unknown = await response.json();
    expect(body).toMatchObject({
      ok: true,
      servicio: "39-ruleta-de-decisiones-api",
      estado: "activo",
    });
  });

  it("normalizePrivateKey y resolveFirebaseEnv procesan saltos de línea y emulador", () => {
    expect(normalizePrivateKey(undefined)).toBeUndefined();
    expect(normalizePrivateKey("linea1\\nlinea2")).toBe("linea1\nlinea2");

    const envConfig = resolveFirebaseEnv({
      NODE_ENV: "test",
      FIREBASE_PROJECT_ID: "test-proj",
      FIREBASE_CLIENT_EMAIL: "test@example.com",
      FIREBASE_PRIVATE_KEY: "abc\\ndef",
      FIRESTORE_EMULATOR_HOST: "127.0.0.1:8080",
    });
    expect(envConfig.projectId).toBe("test-proj");
    expect(envConfig.privateKey).toBe("abc\ndef");
    expect(envConfig.useEmulator).toBe(true);

    expect(getFirebaseAdminApp()).toBeDefined();
    expect(getAdminAuth()).toBeDefined();
    expect(getAdminDb()).toBeDefined();
  });
});

describe("Esquemas Zod de Listas", () => {
  it("listaPutSchema valida entre 2 y 12 opciones, peso 1..10, sin duplicados y descarta extras", () => {
    const valid = listaPutSchema.parse({
      nombre: "Dónde almorzar",
      opciones: [
        { texto: "Corrientazo", peso: 3 },
        { texto: "Pizza", peso: 1 },
      ],
      campo_no_declarado: "se_descarta",
    });
    expect(valid.nombre).toBe("Dónde almorzar");
    expect("campo_no_declarado" in valid).toBe(false);

    expect(() =>
      listaPutSchema.parse({
        nombre: "Solo una",
        opciones: [{ texto: "Unica", peso: 1 }],
      }),
    ).toThrow();

    expect(() =>
      listaPutSchema.parse({
        nombre: "Duplicadas",
        opciones: [
          { texto: "Pizza", peso: 1 },
          { texto: "pizza ", peso: 2 },
        ],
      }),
    ).toThrow();

    expect(
      hasNoDuplicateOptions([
        { texto: "A", peso: 1 },
        { texto: "B", peso: 2 },
      ]),
    ).toBe(true);
    expect(resourceIdSchema.parse("uuid-1234")).toBe("uuid-1234");
  });
});

describe("Esquemas Zod de Giros y Autenticación", () => {
  it("giroPutSchema y auth schemas validan entradas correctamente", () => {
    const giro = giroPutSchema.parse({
      lista_id: "lista-1",
      resultado: "Pizza",
      girado_en: "2026-11-01T15:04:05.000Z",
    });
    expect(giro.resultado).toBe("Pizza");
    expect(sinceQuerySchema.parse("2026-11-01T15:04:05.000Z")).toBe("2026-11-01T15:04:05.000Z");

    expect(
      registroSchema.parse({
        email: "user@example.com",
        password: "password123",
      }).email,
    ).toBe("user@example.com");
    expect(loginSchema.parse({ email: "user@example.com", password: "123" }).email).toBe(
      "user@example.com",
    );
    expect(refreshSchema.parse({ refreshToken: "tok-123" }).refreshToken).toBe("tok-123");
  });
});

describe("Manejador Centralizado de Errores HTTP y Zod", () => {
  it("handleRouteError formatea AppHttpError, ZodError y errores internos (500)", async () => {
    const appErrRes = handleRouteError(
      new AppHttpError(409, "El correo ya está registrado", [
        { campo: "email", mensaje: "Duplicado" },
      ]),
    );
    expect(appErrRes.status).toBe(409);

    let zodErr: unknown;
    try {
      registroSchema.parse({ email: "invalido", password: "123" });
    } catch (e) {
      zodErr = e;
    }
    expect(handleRouteError(zodErr).status).toBe(400);

    const internalRes = handleRouteError(new Error("Fallo secreto de DB"));
    expect(internalRes.status).toBe(500);
    const body500: unknown = await internalRes.json();
    expect(body500).toEqual({ error: "Error interno" });
    expect(buildErrorResponse(401, "No autorizado").status).toBe(401);
  });
});
