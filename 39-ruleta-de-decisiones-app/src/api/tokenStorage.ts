const KEY_ACCESS_TOKEN = "ruleta_auth_id_token";
const KEY_REFRESH_TOKEN = "ruleta_auth_refresh_token";
const KEY_USER_EMAIL = "ruleta_auth_user_email";

export interface SecureStoreLike {
  getItemAsync(key: string): Promise<string | null>;
  setItemAsync(key: string, value: string): Promise<void>;
  deleteItemAsync(key: string): Promise<void>;
}

const memoryFallback = new Map<string, string>();

const fallbackStore: SecureStoreLike = {
  getItemAsync: async (key) => memoryFallback.get(key) ?? null,
  setItemAsync: async (key, value) => {
    memoryFallback.set(key, value);
  },
  deleteItemAsync: async (key) => {
    memoryFallback.delete(key);
  },
};

let customStore: SecureStoreLike | null = null;

export function setTokenStoreAdapter(store: SecureStoreLike | null): void {
  customStore = store;
}

async function resolveStore(): Promise<SecureStoreLike> {
  if (customStore) {
    return customStore;
  }
  try {
    const secureStore = await import("expo-secure-store");
    const available = await secureStore.isAvailableAsync();
    if (available) {
      return secureStore;
    }
  } catch {
    // En entorno de pruebas Node o navegador se usa memoria volatil segura
  }
  return fallbackStore;
}

export interface StoredSessionTokens {
  token: string | null;
  refreshToken: string | null;
  email: string | null;
}

export async function getSessionTokens(): Promise<StoredSessionTokens> {
  const store = await resolveStore();
  const [token, refreshToken, email] = await Promise.all([
    store.getItemAsync(KEY_ACCESS_TOKEN),
    store.getItemAsync(KEY_REFRESH_TOKEN),
    store.getItemAsync(KEY_USER_EMAIL),
  ]);
  return { token, refreshToken, email };
}

export async function saveSessionTokens(
  token: string,
  refreshToken: string,
  email?: string,
): Promise<void> {
  const store = await resolveStore();
  await store.setItemAsync(KEY_ACCESS_TOKEN, token);
  await store.setItemAsync(KEY_REFRESH_TOKEN, refreshToken);
  if (email) {
    await store.setItemAsync(KEY_USER_EMAIL, email);
  }
}

export async function clearSessionTokens(): Promise<void> {
  const store = await resolveStore();
  await Promise.all([
    store.deleteItemAsync(KEY_ACCESS_TOKEN),
    store.deleteItemAsync(KEY_REFRESH_TOKEN),
    store.deleteItemAsync(KEY_USER_EMAIL),
  ]);
}
