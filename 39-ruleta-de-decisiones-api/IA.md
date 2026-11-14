# Índice de Configuración y Evidencias de IA · 39-ruleta-de-decisiones-api

Este documento sirve como índice de la arquitectura de contención, calidad y auditoría de Inteligencia Artificial implementada en el repositorio `39-ruleta-de-decisiones-api` desde el **primer commit**.

## Estructura de Archivos de Gobernanza de IA

1. **[AGENTS.md](./AGENTS.md)** y **[CLAUDE.md](./CLAUDE.md)**
   - Reglas del proyecto para asistentes de IA (≤ 100 líneas): stack, comandos, capas, reglas de calidad, prohibiciones de seguridad y defensa contra _prompt injection_.
2. **[.claude/settings.json](./.claude/settings.json)**
   - Configuración determinista de permisos (`deny` → `ask` → `allow`), bloqueo de lecturas fuera del repositorio (`blockReadsOutsideWorkingDirectories: true`), desactivación de bypass (`disableBypassPermissionsMode: "disable"`) y configuración de `sandbox` de sistema de archivos y red.
3. **[.claude/hooks/pre-tool-use.mjs](./.claude/hooks/pre-tool-use.mjs)**
   - **Reto de Excelencia #1:** Hook `PreToolUse` propio que inspecciona cada llamada a herramientas antes de su ejecución y aborta con código de salida `2` y mensaje en `stderr` ante intentos de leer `.env*`, claves, salir del repositorio o ejecutar comandos prohibidos (`curl`, `wget`, `sudo`, `git push --force`, `git reset --hard`).
4. **[ia/pre-tool-use.test.mjs](./ia/pre-tool-use.test.mjs)**
   - Suite de 10 pruebas automatizadas con `node:test` (`npm run test:guard`) que verifica el bloqueo del hook `PreToolUse`.
5. **[ia/CONFIGURACION.md](./ia/CONFIGURACION.md)**
   - Análisis de defensa en profundidad: qué riesgo cubre cada capa, sus límites técnicos y la justificación de dominios y rutas.
6. **[ia/PRUEBAS-CONTENCION.md](./ia/PRUEBAS-CONTENCION.md)**
   - Registro de las 10 pruebas obligatorias de contención con el canario `CANARIO=ZZZ-NO-ES-UN-SECRETO`.
7. **[ia/INFORME-INYECCION.md](./ia/INFORME-INYECCION.md)**
   - **Reto de Excelencia #2:** Informe técnico de 3 vectores de ataque de _Prompt Injection_ (archivo malicioso, respuesta de API y dependencia externa) y cómo las capas deterministas detienen la exfiltración.
8. **[ia/BITACORA.md](./ia/BITACORA.md)**
   - Bitácora del proceso de ingeniería asistida por IA (propósito, evidencia, validación, decisión y casos documentados de corrección/rechazo a propuestas de la IA).
