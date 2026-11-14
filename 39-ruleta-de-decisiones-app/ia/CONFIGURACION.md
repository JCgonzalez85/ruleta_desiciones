# Configuración de Seguridad y Contención de IA (App Móvil)

## 1. Capas de Protección Combinadas

| Capa                                                        | Mecanismo                                               | Qué riesgo cubre en la App Móvil                                                                                                                           | Límite                                                  |
| ----------------------------------------------------------- | ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| **1. Reglas (`AGENTS.md`)**                                 | Instrucciones explícitas (≤ 100 líneas)                 | Prohíbe incluir `firebaseConfig`, usar `AsyncStorage` para tokens o crear gestos sin botón accesible.                                                      | Es orientativa; requiere las capas técnicas inferiores. |
| **2. Permisos (`permissions.deny` / `ask`)**                | `.claude/settings.json`                                 | Bloquea `Read(**/.env*)`, `*.keystore`, `*.jks`, `*.pem`, `Edit(./.claude/**)` y pide permiso (`ask`) para `eas`, `npx expo install`, `npm i`, `git push`. | No inspecciona scripts internos si no hay hook/sandbox. |
| **3. Hook `PreToolUse` (`.claude/hooks/pre-tool-use.mjs`)** | Proceso Node previo a cada herramienta                  | Sale con código `2` y `stderr` si detecta `.env*`, keystores, `..`, `~/` o variantes como `/usr/bin/curl`.                                                 | Complementa al sandbox del sistema operativo.           |
| **4. Sandbox + Cero secretos en la App**                    | `sandbox.enabled: true` + `filesystem.denyRead: ["~/"]` | La app móvil no tiene secretos ni `firebaseConfig`; los tokens viven en `expo-secure-store` en el dispositivo.                                             | En Windows requiere WSL2; en macOS usa `sandbox-exec`.  |

## 2. Dominios de Red Permitidos en el Sandbox

- `registry.npmjs.org` y `github.com`: únicos dominios permitidos cuando el usuario autoriza instalar paquetes o sincronizar Git.
