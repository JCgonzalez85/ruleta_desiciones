# 39 · Ruleta de Decisiones (`ruleta_desiciones`)

Proyecto Final de Desarrollo Móvil y Backend Serverless: **Ruleta interactiva en SVG** que gira mediante gestos táctiles con inercia y decide entre opciones ponderadas (`peso` `1..10`) de listas personalizadas o ingresadas al vuelo, con persistencia local **SQLite (`expo-sqlite`)**, sincronización bidireccional offline-first y **API REST en Next.js + Firebase Admin**.

---

## Estructura del Repositorio

* 📁 [`39-ruleta-de-decisiones-api`](./39-ruleta-de-decisiones-api): **Fase 1 y Fase 2 — Backend API REST** (Next.js 16 App Router, TypeScript estricto, Firebase Admin SDK, Zod, Vitest, ESLint, Husky y contención de IA).
* 📁 [`39-ruleta-de-decisiones-app`](./39-ruleta-de-decisiones-app): **Fase 3 — Aplicación Móvil** (Expo + React Native + TypeScript, `react-native-svg`, `react-native-gesture-handler`, `react-native-reanimated`, `expo-sqlite`, `expo-secure-store`, `expo-haptics`, `expo-sensors`, `expo-speech`).
* 📁 [`ia/`](./ia) y [`.claude/`](./.claude): Configuración de gobernanza de agentes de IA, jaula determinista (`settings.json` + hook `PreToolUse`), 10 pruebas automatizadas de contención, informe de resistencia a prompt injection y bitácora.

---

## Ejecución Rápida

### 1. Backend API (`39-ruleta-de-decisiones-api`)
```bash
cd 39-ruleta-de-decisiones-api
npm install
npm run test:guard
npm run check
npm run dev
```

### 2. App Móvil (`39-ruleta-de-decisiones-app`)
```bash
cd 39-ruleta-de-decisiones-app
npm install
npm run test:guard
npm run check
npx expo start
```
