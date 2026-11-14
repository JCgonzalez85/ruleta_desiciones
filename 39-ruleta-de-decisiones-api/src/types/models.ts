export interface BaseDocument {
  id: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface OpcionItem {
  texto: string;
  peso: number;
}

export interface ListaDocument extends BaseDocument {
  nombre: string;
  opciones: OpcionItem[];
}

export interface GiroDocument extends BaseDocument {
  lista_id: string;
  resultado: string;
  girado_en: string;
}

export interface UsuarioAuth {
  id: string;
  email: string;
  rol?: string;
}

export interface AuthSuccessResponse {
  token: string;
  refreshToken: string;
  expiraEnSeg: number;
  usuario: {
    id: string;
    email: string;
  };
}

export interface RefreshSuccessResponse {
  token: string;
  refreshToken: string;
  expiraEnSeg: number;
}

export interface SyncListResponse<T> {
  items: T[];
  servidor_ahora: string;
}

export interface ApiErrorDetail {
  campo: string;
  mensaje: string;
}

export interface ApiErrorResponse {
  error: string;
  detalles?: ApiErrorDetail[];
}
