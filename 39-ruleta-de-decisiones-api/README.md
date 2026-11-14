# 39 · Ruleta de Decisiones — API (`39-ruleta-de-decisiones-api`)

Backend REST construido con **Next.js (App Router, Route Handlers en runtime Node.js)**, **Firebase Admin SDK** y **Zod**, diseñado para desplegarse en **Vercel** y servir a la aplicación móvil `39-ruleta-de-decisiones-app`.

---

## 1. Arquitectura y Regla de Oro de Seguridad

```text
[ App móvil ]  Expo + SQLite + expo-secure-store
   │  HTTPS + Authorization: Bearer <ID_TOKEN>
   ▼
[ API en Vercel ]  Next.js Route Handlers (runtime = "nodejs")
   │  Variables de entorno SOLO en Vercel
   ├──────────────▶ [ Firebase Auth REST API + Admin SDK ]
   └──────────────▶ [ Cloud Firestore ] (allow read, write: if false;)
```

- La app móvil **jamás** incluye `firebaseConfig` ni credenciales de Firebase.
- Las reglas de Firestore (`firestore.rules`) niegan todo acceso directo desde clientes (`allow read, write: if false;`).
- Toda operación sobre `usuarios/{uid}/lista/{id}` y `usuarios/{uid}/giro/{id}` pasa por esta API, que extrae `uid` únicamente del ID token verificado con `getAuth().verifyIdToken()`.

---

## 2. Documentación de Endpoints REST (Postman / Thunder Client)

### 2.1 Salud del Servidor

| Método y Ruta     | Autenticación | Respuesta                                            |
| ----------------- | ------------- | ---------------------------------------------------- |
| `GET /api/health` | Pública       | `200 { ok: true, servicio, estado, servidor_ahora }` |

### 2.2 Autenticación Mediada por la API (Sección 9.1)

| Método y Ruta             | Cuerpo (JSON)                                               | Respuesta                                                          |
| ------------------------- | ----------------------------------------------------------- | ------------------------------------------------------------------ |
| `POST /api/auth/registro` | `{ "email": "user@mail.com", "password": "password123" }`   | `201 { token, refreshToken, expiraEnSeg, usuario: { id, email } }` |
| `POST /api/auth/login`    | `{ "email": "user@mail.com", "password": "password123" }`   | `200 { token, refreshToken, expiraEnSeg, usuario: { id, email } }` |
| `POST /api/auth/refresh`  | `{ "refreshToken": "<REFRESH_TOKEN>" }`                     | `200 { token, refreshToken, expiraEnSeg }`                         |
| `GET /api/auth/yo`        | — (`Authorization: Bearer <token>`)                         | `200 { usuario: { id, email, rol? } }`                             |
| `GET /api/admin/resumen`  | — (`Authorization: Bearer <token>` con claim `rol="admin"`) | `200 { ok: true, admin_id, servidor_ahora }` (`403` sin rol admin) |

### 2.3 Sincronización de Listas y Giros (Sección 9.3 y 9.4)

Todas las rutas requieren cabecera `Authorization: Bearer <token>`:

| Método y Ruta                                         | Cuerpo / Query                                                                                             | Respuesta                                                                              |
| ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `GET /api/lista?since=<ISO>` _(alias `/api/listas`)_  | Query opcional `since` (ISO 8601 UTC)                                                                      | `200 { items: ListaDocument[], servidor_ahora }` (máx. 500, incluye borrados lógicos)  |
| `PUT /api/lista/<id>` _(alias `/api/listas/<id>`)_    | `{ "nombre": "Almuerzo", "opciones": [{ "texto": "Pizza", "peso": 2 }, { "texto": "Sushi", "peso": 1 }] }` | `200 ListaDocument` (`409` si el nombre ya existe para el usuario)                     |
| `DELETE /api/lista/<id>` _(alias `/api/listas/<id>`)_ | —                                                                                                          | `200 { ok: true }` (`404` si no existe)                                                |
| `GET /api/giro?since=<ISO>` _(alias `/api/giros`)_    | Query opcional `since` (ISO 8601 UTC)                                                                      | `200 { items: GiroDocument[], servidor_ahora }`                                        |
| `PUT /api/giro/<id>` _(alias `/api/giros/<id>`)_      | `{ "lista_id": "<uuid>", "resultado": "Pizza", "girado_en": "2026-11-01T15:04:05.000Z" }`                  | `200 GiroDocument`                                                                     |
| `DELETE /api/giro/<id>` _(alias `/api/giros/<id>`)_   | —                                                                                                          | `200 { ok: true }` (`404` si no existe)                                                |
| `GET /api/giros/estadisticas?lista=<id>`              | Query obligatoria `lista=<lista_id>`                                                                       | `200 { lista_id, total_giros, conteo_por_opcion: [{ opcion, cantidad, porcentaje }] }` |

---

## 3. Justificación de Dependencias (Sección 7)

| Paquete                                             | Tipo       | Justificación técnica                                                                                                                                                  |
| --------------------------------------------------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `next`, `react`, `react-dom`                        | Producción | Framework exigido en la especificación (Sección 9) para Route Handlers con `runtime = "nodejs"` desplegados en Vercel.                                                 |
| `firebase-admin`                                    | Producción | SDK oficial de servidor para verificar tokens JWT (`verifyIdToken`), asignar custom claims y operar sobre Firestore sin abrir permisos a clientes.                     |
| `zod`                                               | Producción | Validación de esquemas en tiempo de ejecución y descarte automático (`strip`) de campos no declarados (Sección 9.3 y 9.5).                                             |
| `typescript`, `@types/*`                            | Desarrollo | Verificación estática de tipos con `strict: true` y `noUncheckedIndexedAccess: true`.                                                                                  |
| `eslint`, `eslint-config-next`, `typescript-eslint` | Desarrollo | Linter con configuración plana (`eslint.config.mjs`) para hacer cumplir complejidad ≤ 10, ≤ 50 líneas por función, `max-depth` ≤ 3 y prohibición de `any` y `console`. |
| `prettier`                                          | Desarrollo | Formateador automático de código comprobado en `npm run format:check`.                                                                                                 |
| `vitest`, `@vitest/coverage-v8`                     | Desarrollo | Runner de pruebas unitarias e integración con validación de umbral de cobertura ≥ 80 %.                                                                                |
| `husky`, `lint-staged`                              | Desarrollo | Automatización de hooks de Git en `pre-commit` y `pre-push`.                                                                                                           |

---

## 4. Puesta en Marcha Local

1. Copie la plantilla de variables de entorno:
   ```bash
   cp env.example .env.local
   ```
2. Instale las dependencias:
   ```bash
   npm install
   ```
3. Ejecute todas las verificaciones de calidad, tipos, formato, pruebas y contención de IA:
   ```bash
   npm run test:guard
   npm run check
   ```
4. Inicie el servidor de desarrollo:
   ```bash
   npm run dev
   ```
