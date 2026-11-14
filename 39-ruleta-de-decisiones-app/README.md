# 39 · Ruleta de Decisiones — App Móvil (`39-ruleta-de-decisiones-app`)

Aplicación móvil construida con **Expo + React Native + TypeScript + Expo Router**, persistencia local **SQLite (`expo-sqlite`)**, tokens seguros en **`expo-secure-store`**, ruleta interactiva en **SVG (`react-native-svg`)**, gestos táctiles con **`react-native-gesture-handler` + `react-native-reanimated`** y sensores del dispositivo (**`expo-haptics`**, **`Accelerometer`**, **`expo-speech`** y **`Gyroscope`**).

---

## 1. Arquitectura y Regla de Oro de Seguridad

```text
[ App móvil ]  Expo + React Native + TypeScript + Expo Router
   │  SQLite local (funciona 100 % sin conexión)
   │  HTTPS + ID token de Firebase (guardado en expo-secure-store)
   ▼
[ API ]  Next.js (Route Handlers, runtime Node) desplegada en Vercel
```

- **Cero credenciales en el APK:** La aplicación no contiene `firebaseConfig` ni llaves privadas. Solo utiliza `EXPO_PUBLIC_API_URL` (HTTPS) y los tokens de sesión guardados en `expo-secure-store`.
- **Offline-first:** Todas las listas, opciones y giros se escriben primero en SQLite (`pending = 1`) y se sincronizan con la API cuando hay conexión mediante `PUT /api/lista/<id>`, `PUT /api/giro/<id>` y `GET /api/<recurso>?since=<ISO>`.

---

## 2. Pantallas y Capas (Expo Router)

| Ruta                       | Contenido                                                                                                                                                             |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `app/(tabs)/index.tsx`     | Ruleta SVG interactiva de la lista activa, **Modo Rápido de decisión directa**, modo «Eliminar opción que salió» y reto de «Eliminación por rondas hasta un ganador». |
| `app/(tabs)/listas.tsx`    | Gestión y búsqueda de listas de opciones, estado de sincronización y sesión de usuario.                                                                               |
| `app/lista/[id].tsx`       | Crear/editar opciones y pesos (entre 2 y 12 opciones, hasta 30 caracteres, sin duplicados, peso entero 1..10).                                                        |
| `app/(tabs)/historial.tsx` | Historial de resultados anteriores, estadísticas de equidad por opción y acciones de voz/compartir.                                                                   |

```text
src/
├── db/            # Apertura de SQLite, esquema y migraciones idempotentes
├── repositories/  # Consultas SQL parametrizadas (listasRepo, girosRepo)
├── services/      # Matemática pura de la ruleta (ruletaMath), validación y sincronización (syncService)
├── api/           # Cliente HTTP (fetch + Bearer token + refresh automático en 401)
├── sensors/       # Lógica pura y hooks: useShake (Accelerometer), useTiltShine (Gyroscope), haptics, speech
└── components/    # SvgWheel (ruleta SVG + 4 gestos + botones accesibles), modales de edición rápida y login
```

---

## 3. Gestos Táctiles y Alternativas de Accesibilidad (Sección 4)

| Gesto (`react-native-gesture-handler`)            | Acción en la App                                                                           | Alternativa Accesible (`accessibilityLabel`)                           |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------- |
| **Lanzamiento (`Gesture.Pan` con velocidad)**     | Gira la ruleta con velocidad inicial proporcional al impulso del dedo y frena con inercia. | Botón `Girar ruleta`                                                   |
| **Doble toque (`Gesture.Tap().numberOfTaps(2)`)** | Gira la ruleta con velocidad aleatoria.                                                    | Botón `Girar con velocidad aleatoria`                                  |
| **Mantener presionado (`Gesture.LongPress`)**     | Abre la edición rápida del sector seleccionado.                                            | Botones `Editar opción <nombre>`                                       |
| **Pellizco (`Gesture.Pinch`)**                    | Cambia el tamaño (zoom/escala) de la ruleta entre `0.75x` y `1.35x`.                       | Botones `Reducir tamaño de la ruleta` y `Aumentar tamaño de la ruleta` |

---

## 4. Sensores y Capacidades del Dispositivo (Sección 5)

| Capacidad / Sensor               | Uso en la App                                                                                                         | Alternativa si no está disponible                              |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| **`expo-haptics` (Principal)**   | Tic háptico cada vez que la aguja cruza de un sector al siguiente mientras la ruleta frena, y vibración al detenerse. | Giro visual silencioso sin interrumpir el flujo.               |
| **`Accelerometer` (`useShake`)** | Sacudir el teléfono gira la ruleta (previa comprobación `isAvailableAsync()` y activación explícita del usuario).     | Botón `Girar ruleta`.                                          |
| **`expo-speech`**                | Lee el resultado ganador en voz alta al finalizar el giro o al pulsar «Leer en voz alta».                             | Resultado visible en pantalla y compartible con `Share.share`. |
| **`Gyroscope` (`useTiltShine`)** | Inclinar el teléfono desplaza suavemente el brillo especular sobre la ruleta SVG.                                     | Renderizado SVG estático sin romper la interfaz.               |

---

## 5. Justificación de Dependencias (Sección 7)

| Paquete                                                                                     | Justificación                                                                                                 |
| ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `expo`, `react`, `react-native`, `expo-router`                                              | Base oficial de navegación por archivos y runtime móvil multiplataforma.                                      |
| `expo-sqlite`                                                                               | Base de datos relacional local para funcionamiento 100 % sin conexión (Sección 8).                            |
| `expo-secure-store`                                                                         | Almacenamiento cifrado de `token` y `refreshToken` en Keychain/Keystore (Sección 9.1).                        |
| `react-native-svg`                                                                          | Dibujo vectorial dinámico de los sectores de la ruleta proporcionales al peso (RF-02).                        |
| `react-native-gesture-handler`, `react-native-reanimated`                                   | Reconocimiento de gestos (`Pan`, `Tap`, `LongPress`, `Pinch`) y física de desaceleración fluida a 60/120 fps. |
| `expo-haptics`, `expo-sensors`, `expo-speech`                                               | Tics hápticos por sector, detección de sacudida/inclinación y anuncio por voz (Sección 5 y RF-06).            |
| `vitest`, `@vitest/coverage-v8`, `eslint`, `prettier`, `typescript`, `husky`, `lint-staged` | Verificación automática de tipos, estilo, complejidad y cobertura ≥ 80 % (`npm run check`).                   |

---

## 6. Puesta en Marcha y Generación de APK (EAS Build)

```bash
cp env.example .env
npm install
npm run test:guard
npm run check
npx expo start
```

Para generar el APK de Android con EAS Build (Hito 4):

```bash
eas build -p android --profile preview
```
