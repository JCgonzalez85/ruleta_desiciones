import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

export interface FirebaseEnvConfig {
  projectId: string;
  clientEmail?: string;
  privateKey?: string;
  useEmulator: boolean;
}

export function normalizePrivateKey(rawKey: string | undefined): string | undefined {
  if (!rawKey) {
    return undefined;
  }
  return rawKey.replace(/\\n/g, "\n");
}

export function resolveFirebaseEnv(env: NodeJS.ProcessEnv = process.env): FirebaseEnvConfig {
  const projectId = env.FIREBASE_PROJECT_ID ?? "demo-ruleta-decisiones";
  const clientEmail = env.FIREBASE_CLIENT_EMAIL;
  const privateKey = normalizePrivateKey(env.FIREBASE_PRIVATE_KEY);
  const useEmulator = Boolean(env.FIRESTORE_EMULATOR_HOST || env.FIREBASE_AUTH_EMULATOR_HOST);

  return {
    projectId,
    clientEmail,
    privateKey,
    useEmulator,
  };
}

export function getFirebaseAdminApp(): App {
  const existingApps = getApps();
  const firstApp = existingApps[0];
  if (firstApp) {
    return firstApp;
  }

  const config = resolveFirebaseEnv();
  if (!config.useEmulator && config.clientEmail && config.privateKey) {
    return initializeApp({
      credential: cert({
        projectId: config.projectId,
        clientEmail: config.clientEmail,
        privateKey: config.privateKey,
      }),
      projectId: config.projectId,
    });
  }

  return initializeApp({
    projectId: config.projectId,
  });
}

export function getAdminAuth(): Auth {
  return getAuth(getFirebaseAdminApp());
}

export function getAdminDb(): Firestore {
  return getFirestore(getFirebaseAdminApp());
}
