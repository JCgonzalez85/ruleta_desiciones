import { clearSessionTokens, getSessionTokens, saveSessionTokens } from "@/api/tokenStorage";

const DEFAULT_API_URL = "https://39-ruleta-de-decisiones-api.vercel.app";

export function getApiBaseUrl(): string {
  const raw = process.env.EXPO_PUBLIC_API_URL ?? DEFAULT_API_URL;
  return raw.replace(/\/+$/, "");
}

export interface ApiAuthPayload {
  token: string;
  refreshToken: string;
  expiraEnSeg: number;
  usuario: { id: string; email: string };
}

export class ApiClientError extends Error {
  public readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiClientError";
    this.status = status;
  }
}

async function tryRefreshOnce(): Promise<string | null> {
  const { refreshToken, email } = await getSessionTokens();
  if (!refreshToken) {
    return null;
  }
  const url = `${getApiBaseUrl()}/api/auth/refresh`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken }),
  });

  if (!response.ok) {
    await clearSessionTokens();
    return null;
  }

  const data = (await response.json()) as {
    token?: string;
    refreshToken?: string;
  };
  if (!data.token || !data.refreshToken) {
    await clearSessionTokens();
    return null;
  }

  await saveSessionTokens(data.token, data.refreshToken, email ?? undefined);
  return data.token;
}

async function executeFetch(
  path: string,
  options: RequestInit,
  bearerToken: string | null,
): Promise<Response> {
  const headers = new Headers(options.headers);
  if (!headers.has("Content-Type") && options.body) {
    headers.set("Content-Type", "application/json");
  }
  if (bearerToken) {
    headers.set("Authorization", `Bearer ${bearerToken}`);
  }
  return fetch(`${getApiBaseUrl()}${path}`, {
    ...options,
    headers,
  });
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
  requiresAuth = true,
): Promise<T> {
  const { token } = requiresAuth ? await getSessionTokens() : { token: null };

  let response = await executeFetch(path, options, token);

  if (response.status === 401 && requiresAuth) {
    const newToken = await tryRefreshOnce();
    if (newToken) {
      response = await executeFetch(path, options, newToken);
    }
  }

  if (!response.ok) {
    let errMsg = `Error HTTP ${response.status}`;
    try {
      const errBody = (await response.json()) as { error?: string };
      if (errBody.error) {
        errMsg = errBody.error;
      }
    } catch {
      // Ignorar si no es JSON
    }
    throw new ApiClientError(response.status, errMsg);
  }

  return (await response.json()) as T;
}

export async function loginConApi(email: string, password: string): Promise<ApiAuthPayload> {
  const res = await apiRequest<ApiAuthPayload>(
    "/api/auth/login",
    {
      method: "POST",
      body: JSON.stringify({ email, password }),
    },
    false,
  );
  await saveSessionTokens(res.token, res.refreshToken, res.usuario.email);
  return res;
}

export async function registrarConApi(email: string, password: string): Promise<ApiAuthPayload> {
  const res = await apiRequest<ApiAuthPayload>(
    "/api/auth/registro",
    {
      method: "POST",
      body: JSON.stringify({ email, password }),
    },
    false,
  );
  await saveSessionTokens(res.token, res.refreshToken, res.usuario.email);
  return res;
}
