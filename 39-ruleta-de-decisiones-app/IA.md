# Índice de Configuración y Evidencias de IA · 39-ruleta-de-decisiones-app

Este documento indexa la configuración de contención, seguridad y calidad de IA del repositorio móvil `39-ruleta-de-decisiones-app`, versionada desde el **primer commit**.

## Archivos de Gobernanza y Evidencia

1. **[AGENTS.md](./AGENTS.md)** y **[CLAUDE.md](./CLAUDE.md)**
   - Reglas del proyecto móvil (≤ 100 líneas): stack Expo + React Native + SQLite + SVG + sensores, comandos, capas, accesibilidad y prohibiciones.
2. **[.claude/settings.json](./.claude/settings.json)**
   - Permisos `deny` / `ask` / `allow`, bloqueo de lectura fuera del repositorio, desactivación de bypass y configuración de `sandbox`.
3. **[.claude/hooks/pre-tool-use.mjs](./.claude/hooks/pre-tool-use.mjs)**
   - **Reto de Excelencia #1:** Hook `PreToolUse` propio que aborta con código `2` y `stderr` ante lecturas de `.env*`, keystores (`*.keystore`, `*.jks`), rutas externas o uso de `curl`/`wget`/`sudo`.
4. **[ia/pre-tool-use.test.mjs](./ia/pre-tool-use.test.mjs)**
   - Suite de 10 pruebas automatizadas con `node:test` (`npm run test:guard`).
5. **[ia/CONFIGURACION.md](./ia/CONFIGURACION.md)**
   - Explicación de cada barrera, sus límites y los ajustes realizados.
6. **[ia/PRUEBAS-CONTENCION.md](./ia/PRUEBAS-CONTENCION.md)**
   - Evidencia de las 10 pruebas obligatorias de contención con el canario `CANARIO=ZZZ-NO-ES-UN-SECRETO`.
7. **[ia/INFORME-INYECCION.md](./ia/INFORME-INYECCION.md)**
   - **Reto de Excelencia #2:** Análisis de 3 ataques de _Prompt Injection_ en la app móvil y cómo los frena la configuración.
8. **[ia/BITACORA.md](./ia/BITACORA.md)**
   - Bitácora del desarrollo asistido por IA con ≥ 3 casos de rechazo o corrección a sugerencias de la IA.
