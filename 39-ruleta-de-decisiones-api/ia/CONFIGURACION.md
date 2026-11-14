# Configuración de Seguridad y Contención de IA

## 1. Filosofía de Defensa en Profundidad

Una instrucción en lenguaje natural dentro de `AGENTS.md` orienta al modelo, pero **no es una barrera de seguridad**: un modelo puede alucinar o ser manipulado mediante _prompt injection_. Por ello, este repositorio combina **4 capas complementarias**:

| Capa                                                        | Mecanismo                                                                                                                                     | Qué riesgo mitiga                                                                                                                                                            | Límite conocido                                                                  |
| ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| **1. Instrucciones (`AGENTS.md`)**                          | Contexto explícito de arquitectura, reglas de negocio y prohibiciones.                                                                        | Evita errores involuntarios de estilo, arquitectura o uso de comandos peligrosos.                                                                                            | Puede ser ignorado ante _prompt injection_ si no existen capas técnicas debajo.  |
| **2. Permisos (`permissions.deny` / `ask`)**                | Reglas deterministas en `.claude/settings.json` evaluadas en orden `deny → ask → allow`.                                                      | Bloquea `Read(**/.env*)`, `*.pem`, `*.key`, `*firebase-adminsdk*.json`, `Edit(./.claude/**)` y comandos directos (`curl`, `wget`, `sudo`).                                   | `Read` no inspecciona subprocesos complejos de Bash (`sh -c` o scripts de Node). |
| **3. Hook `PreToolUse` (`.claude/hooks/pre-tool-use.mjs`)** | Script Node.js que inspecciona argumentos de archivos y cadenas de comandos antes de ejecutar cualquier herramienta, saliendo con código `2`. | Detecta rutas fuera del workspace (`..`, `~/`), variantes como `/usr/bin/curl`, acceso a `.env*` por comandos y edición de `.claude/`.                                       | No reemplaza el aislamiento a nivel de kernel del sistema operativo.             |
| **4. Sandbox + Cero secretos en disco**                     | `sandbox.enabled: true`, `filesystem.denyRead: ["~/"]`, `allowRead: ["."]`, más uso de Firebase Emulator Suite en desarrollo.                 | Impide a nivel de proceso leer fuera del repositorio o abrir conexiones de red a dominios no autorizados; y garantiza que no existan claves de producción en el disco local. | En Windows requiere WSL2 (`bubblewrap` + `socat`); en macOS usa `sandbox-exec`.  |

## 2. Justificación de Dominios de Red Permitidos

En `.claude/settings.json`, `sandbox.network.allowedDomains` solo autoriza:

- `registry.npmjs.org`: requerido exclusivamente cuando el desarrollador autoriza (`ask`) instalar o auditar paquetes con `npm`.
- `github.com`: requerido cuando el desarrollador autoriza (`ask`) operaciones remotas de Git.

Cualquier otro dominio externo queda bloqueado dentro del sandbox para impedir la exfiltración de datos.

## 3. Ajustes Realizados durante la Configuración

1. **Archivo `env.example` sin punto inicial:** La regla `Read(**/.env*)` bloquea cualquier archivo que inicie por `.env`, incluyendo `.env.example`. Por ello se publica `env.example` con valores ficticios documentados.
2. **Protección de la propia jaula:** Se añadió `Edit(./.claude/**)` en `permissions.deny` y en la lista `SECRET_FILE_PATTERNS` del hook `PreToolUse` para impedir que el agente modifique su propia configuración de seguridad.
