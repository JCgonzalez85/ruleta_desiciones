import type { NextRequest } from "next/server";
import { z } from "zod";
import { AppHttpError } from "@/lib/errors";
import { getAdminAuth } from "@/lib/firebase-admin";
import type { AuthSuccessResponse, RefreshSuccessResponse, UsuarioAuth } from "@/types/models";

const INVALID_CREDENTIALS_MSG = "Credenciales inválidas";
const RATE_LIMIT_WINDOW_MS = 60_000;
const MAX_ATTEMPTS_PER_WINDOW = 10;

interface RateEntry {
  count: number;
  resetAt: number;
}

const loginAttempts = new Map<string, RateEntry>();

const identityResponseSchema = z.object({
  idToken: z.string().optional(),
  refreshToken: z.string().optional(),
  expiresIn: z.string().optional(),
  localId: z.string().optional(),
  email: z.string().optional(),
  error: z.object({ message: z.string().optional() }).optional(),
});

const secureTokenResponseSchema = z.object({
  id_token: z.string().optional(),
  refresh_token: z.string().optional(),
  expires_in: z.string().optional(),
  error: z.object({ message: z.string().optional() }).optional(),
});

export function resetRateLimiterForTests(): void {
  loginAttempts.clear();
}

export function checkLoginRateLimit(key: string, now = Date.now()): void {
  const existing = loginAttempts.get(key);
  if (!existing || now > existing.resetAt) {
    loginAttempts.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return;
  }
  if (existing.count >= MAX_ATTEMPTS_PER_WINDOW) {
    throw new AppHttpError(429, "Demasiados intentos. Intente de nuevo más tarde");
  }
  existing.count += 1;
}

function getWebApiKey(): string {
  const apiKey = process.env.FIREBASE_WEB_API_KEY;
  if (!apiKey) {
    throw new AppHttpError(500, "Error interno");
  }
  return apiKey;
}

export function mapFirebaseAuthError(errorCode: string): AppHttpError {
  if (errorCode.includes("EMAIL_EXISTS")) {
    return new AppHttpError(409, "El correo electrónico ya está registrado");
  }
  if (errorCode.includes("WEAK_PASSWORD")) {
    return new AppHttpError(400, "La contraseña es demasiado débil");
  }
  if (errorCode.includes("TOO_MANY_ATTEMPTS")) {
    return new AppHttpError(429, "Demasiados intentos. Intente de nuevo más tarde");
  }
  return new AppHttpError(401, INVALID_CREDENTIALS_MSG);
}

async function callIdentityToolkit(
  endpoint: "accounts:signUp" | "accounts:signInWithPassword",
  email: string,
  password: string,
): Promise<AuthSuccessResponse> {
  const apiKey = getWebApiKey();
  const url = `https://identitytoolkit.googleapis.com/v1/${endpoint}?key=${encodeURIComponent(apiKey)}`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  });

  const raw: unknown = await response.json();
  const parsed = identityResponseSchema.safeParse(raw);
  const data = parsed.success ? parsed.data : {};

  if (!response.ok || !data.idToken || !data.refreshToken || !data.localId) {
    throw mapFirebaseAuthError(data.error?.message ?? "INVALID_CREDENTIALS");
  }

  return {
    token: data.idToken,
    refreshToken: data.refreshToken,
    expiraEnSeg: Number(data.expiresIn ?? 3600),
    usuario: {
      id: data.localId,
      email: data.email ?? email,
    },
  };
}

export async function firebaseSignUp(
  email: string,
  password: string,
): Promise<AuthSuccessResponse> {
  return callIdentityToolkit("accounts:signUp", email, password);
}

export async function firebaseSignIn(
  email: string,
  password: string,
): Promise<AuthSuccessResponse> {
  return callIdentityToolkit("accounts:signInWithPassword", email, password);
}

export async function firebaseRefreshIdToken(
  refreshToken: string,
): Promise<RefreshSuccessResponse> {
  const apiKey = getWebApiKey();
  const url = `https://securetoken.googleapis.com/v1/token?key=${encodeURIComponent(apiKey)}`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });

  const raw: unknown = await response.json();
  const parsed = secureTokenResponseSchema.safeParse(raw);
  const data = parsed.success ? parsed.data : {};

  if (!response.ok || !data.id_token || !data.refresh_token) {
    throw mapFirebaseAuthError(data.error?.message ?? "INVALID_REFRESH_TOKEN");
  }

  return {
    token: data.id_token,
    refreshToken: data.refresh_token,
    expiraEnSeg: Number(data.expires_in ?? 3600),
  };
}

export function extractBearerToken(req: NextRequest): string {
  const header = req.headers.get("authorization") ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  const token = match?.[1]?.trim();
  if (!token) {
    throw new AppHttpError(401, "Token de autenticación ausente o inválido");
  }
  return token;
}

export async function verifyBearerToken(req: NextRequest): Promise<UsuarioAuth> {
  const token = extractBearerToken(req);
  try {
    const decoded = await getAdminAuth().verifyIdToken(token);
    const rolClaim = typeof decoded.rol === "string" ? decoded.rol : undefined;
    return {
      id: decoded.uid,
      email: decoded.email ?? "",
      rol: rolClaim,
    };
  } catch {
    throw new AppHttpError(401, "Token de autenticación inválido o expirado");
  }
}

export async function requireAdmin(req: NextRequest): Promise<UsuarioAuth> {
  const usuario = await verifyBearerToken(req);
  if (usuario.rol !== "admin") {
    throw new AppHttpError(403, "Se requiere rol de administrador");
  }
  return usuario;
}
