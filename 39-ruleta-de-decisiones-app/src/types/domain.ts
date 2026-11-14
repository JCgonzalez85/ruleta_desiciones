export interface OpcionInput {
  id?: string;
  texto: string;
  peso: number;
}

export interface OpcionEntidad {
  id: string;
  lista_id: string;
  texto: string;
  peso: number;
  remote_id: string | null;
  updated_at: string;
  deleted: number;
  pending: number;
}

export interface ListaEntidad {
  id: string;
  nombre: string;
  remote_id: string | null;
  updated_at: string;
  deleted: number;
  pending: number;
  opciones: OpcionEntidad[];
}

export interface GiroEntidad {
  id: string;
  lista_id: string;
  resultado: string;
  girado_en: string;
  remote_id: string | null;
  updated_at: string;
  deleted: number;
  pending: number;
}

export interface SectorRuleta {
  indice: number;
  id: string;
  texto: string;
  peso: number;
  color: string;
  startAngleDeg: number;
  endAngleDeg: number;
  midAngleDeg: number;
  sweepAngleDeg: number;
  porcentaje: number;
}

export interface PlanGiro {
  sectorGanador: SectorRuleta;
  anguloFinalDeg: number;
  vueltasCompletas: number;
  duracionMs: number;
}

export type ModoEliminacion = "normal" | "eliminar_salida" | "rondas_ganador";

export interface ValidacionResultado {
  valido: boolean;
  errores: string[];
}

export interface EstadisticaOpcion {
  resultado: string;
  conteo: number;
  porcentaje: number;
}
