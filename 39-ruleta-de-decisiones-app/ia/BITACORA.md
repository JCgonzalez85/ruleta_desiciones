# Bitácora de Trabajo con IA · 39-ruleta-de-decisiones-app

## Registro de Sesiones

### Sesión 1: Configuración de Contención de IA y Reglas de Calidad (Primer Commit)

- **Propósito:** Establecer `AGENTS.md`, `.claude/settings.json`, `.claude/hooks/pre-tool-use.mjs`, `ia/pre-tool-use.test.mjs` y el pipeline de validación (`npm run check`) antes de escribir el código móvil.
- **Evidencia:** 10 pruebas en `ia/pre-tool-use.test.mjs` pasando con `npm run test:guard`.
- **Validación:** Verificación de bloqueo sobre `.env.local`, `*.keystore`, `..` y `/usr/bin/curl`.
- **Decisión:** Aceptado en el commit inicial del repositorio.

### Sesión 2: Matemática Pura de la Ruleta, SQLite Offline-First, Gestos y Sensores

- **Propósito:** Implementar la lógica pura de selección aleatoria ponderada con semilla (`src/services/ruletaMath.ts`), el repositorio SQLite con campos de sincronización (`remote_id`, `updated_at`, `deleted`, `pending`), el componente `SvgWheel` con 4 gestos + botones accesibles y los 4 sensores/capacidades (`expo-haptics`, `Accelerometer`, `expo-speech`, `Gyroscope`).
- **Evidencia:** Módulos en `src/` y pantallas en `app/`, más pruebas unitarias en `tests/`.
- **Validación:** Criterio de aceptación de 400 giros simulados (~25 % por opción), modo eliminar opción y botón accesible verificados en `npm run check`.
- **Decisión:** Aceptado e integrado.

---

## Casos en que se Rechazó o Corrigió lo Propuesto por la IA (≥ 3 Casos)

### Caso 1: Elección del ganador después del giro vs. antes de la animación (RF-04)

- **Propuesta inicial:** Calcular una rotación física libre y determinar qué sector cayó debajo de la aguja al final.
- **Por qué se rechazó/corrigió:** El requisito **RF-04** exige explícitamente: _"El resultado se elige con un generador aleatorio y la animación termina en ese sector"_.
- **Corrección aplicada:** En `src/services/ruletaMath.ts`, `planificarGiro()` elige primero la opción ganadora usando `seleccionarOpcionPonderada()` y luego calcula el ángulo final exacto (`calcularAnguloDestinoParaSector`) sumando vueltas completas según la velocidad del gesto (`fling`) para que la aguja aterrice exactamente en el sector elegido.

### Caso 2: Almacenamiento de tokens en `AsyncStorage`

- **Propuesta inicial:** Guardar `token` y `refreshToken` en `AsyncStorage` por simplicidad.
- **Por qué se rechazó/corrigió:** La Sección 9.1 y la Lista de Verificación de Seguridad (Sección 15) prohíben `AsyncStorage` para credenciales y exigen `expo-secure-store`.
- **Corrección aplicada:** En `src/api/tokenStorage.ts` se usa exclusivamente `expo-secure-store` (`getItemAsync`, `setItemAsync`, `deleteItemAsync`) con fallback en memoria solo para entornos de prueba sin hardware nativo.

### Caso 3: Uso directo de sensores sin `isAvailableAsync()` ni limpieza de suscripción

- **Propuesta inicial:** Suscribirse directamente a `Accelerometer.addListener` al montar la pantalla.
- **Por qué se rechazó/corrigió:** La Sección 5 exige: (1) llamar siempre `isAvailableAsync()` antes de usar un sensor; (2) pedir permisos solo cuando el usuario active la función explicando para qué; (3) cancelar con `subscription.remove()` al salir; (4) nunca romperse en emulador o sin permiso.
- **Corrección aplicada:** Se separó la lógica pura de detección de sacudida/inclinación (`detectarSacudida`, `calcularDesplazamientoBrillo` en `src/sensors/sensorMath.ts`) de los hooks `useShake` y `useTiltShine`, verificando siempre `isAvailableAsync()` y limpiando `subscription.remove()`.
