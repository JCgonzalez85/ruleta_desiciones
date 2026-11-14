# Bitácora de Trabajo con IA · 39-ruleta-de-decisiones-api

## Metodología de Trabajo

Cada tarea se abordó en **modo plan**, definiendo primero los requisitos de validación, seguridad y pruebas antes de escribir la implementación, y verificando cada entrega con `npm run check` y `npm run test:guard`.

---

## Registro de Sesiones (Fase 1)

### Sesión 1: Diseño de Contención de IA y Calidad Automática

- **Propósito:** Configurar las barreras de seguridad (`.claude/settings.json`, hook `PreToolUse`, `AGENTS.md`) y el pipeline de calidad (`eslint.config.mjs`, `tsconfig.json`, `vitest.config.ts`) antes de escribir código de negocio.
- **Evidencia:** Archivos `.claude/settings.json`, `.claude/hooks/pre-tool-use.mjs`, `ia/pre-tool-use.test.mjs`, `eslint.config.mjs`.
- **Validación:** Ejecución de `npm run test:guard` (10/10 pruebas en verde) y `npm audit --audit-level=high` (0 vulnerabilidades altas o críticas).
- **Decisión:** Aceptado e incorporado en el primer commit.

### Sesión 2: Arquitectura Base de Firebase Admin y Esquemas Zod

- **Propósito:** Configurar la inicialización segura de Firebase Admin SDK (`src/lib/firebase-admin.ts`), el manejador estándar de errores (`src/lib/errors.ts`), los esquemas Zod (`src/schemas/`) y el endpoint `GET /api/health`.
- **Evidencia:** `src/lib/firebase-admin.ts`, `src/schemas/lista.schema.ts`, `src/schemas/giro.schema.ts`, `src/schemas/auth.schema.ts`, `src/app/api/health/route.ts`.
- **Validación:** `npm run check` con cobertura > 80 % y `npm run build` exitoso.
- **Decisión:** Aceptado para el cierre de la Fase 1.

---

## Casos en que se Rechazó o Corrigió lo Propuesto por la IA (Mínimo 3 Exigidos)

### Caso 1: Nombre del archivo de ejemplo de variables de entorno (`.env.example` vs `env.example`)

- **Propuesta inicial:** Crear un archivo `.env.example` estándar en la raíz del proyecto.
- **Por qué se rechazó/corrigió:** En la Sección 2 de la guía de Configuración de IA se especifica que la regla `permissions.deny` con `Read(**/.env*)` bloquea cualquier archivo que empiece por `.env`, haciendo inaccesible `.env.example`.
- **Corrección aplicada:** Se nombró el archivo `env.example` (sin punto inicial) y se documentó explícitamente el motivo en su encabezado y en `ia/CONFIGURACION.md`.

### Caso 2: Versiones iniciales de dependencias con vulnerabilidades en `npm audit`

- **Propuesta inicial:** Usar `next@15.3.2`, `vitest@3.1.4` y `zod@3.25.0`.
- **Por qué se rechazó/corrigió:** Al ejecutar `npm audit --audit-level=high`, esas versiones reportaban vulnerabilidades altas/críticas en dependencias transitivas (`postcss`, `tinypool`). Además, la guía exige usar `eslint .` propio de Next 16 y pasar `npm audit --audit-level=high` en cero.
- **Corrección aplicada:** Se actualizaron las dependencias a `next@16`, `vitest@4.1.12`, `@vitest/coverage-v8@4.1.12`, `firebase-admin@14`, `zod@4` y `typescript@^5.9.0`, logrando `0 high / 0 critical` en `npm audit --audit-level=high`.

### Caso 3: Regla simple `Bash(curl *)` insuficiente contra rutas absolutas

- **Propuesta inicial:** Confiar únicamente en `"Bash(curl *)"` dentro de `.claude/settings.json` para bloquear peticiones externas con `curl`.
- **Por qué se rechazó/corrigió:** Como advierte la Sección 5 de la hoja del profesor, `Bash(curl *)` no detiene `/usr/bin/curl` ni comandos encadenados con `;` o `&&`.
- **Corrección aplicada:** Se implementó en `.claude/hooks/pre-tool-use.mjs` la expresión regular `/(^|\s|[;&|])(\/usr\/bin\/|\/bin\/)?curl(\s|$)/i` y se validó en la prueba #6 de `ia/pre-tool-use.test.mjs`.
