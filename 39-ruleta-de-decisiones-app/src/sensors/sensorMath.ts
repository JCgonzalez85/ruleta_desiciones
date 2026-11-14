import { obtenerSectorPorAngulo } from "@/services/ruletaMath";
import type { SectorRuleta } from "@/types/domain";

export interface Vector3D {
  x: number;
  y: number;
  z: number;
}

export interface BrilloOffset {
  dx: number;
  dy: number;
}

export function calcularMagnitudG(muestra: Vector3D): number {
  return Math.sqrt(muestra.x * muestra.x + muestra.y * muestra.y + muestra.z * muestra.z);
}

export function evaluarSacudida(
  muestra: Vector3D,
  ultimoDisparoMs: number,
  ahoraMs: number,
  umbralG = 2.15,
  cooldownMs = 1500,
): { disparar: boolean; nuevoUltimoDisparoMs: number } {
  const magnitud = calcularMagnitudG(muestra);
  if (magnitud >= umbralG && ahoraMs - ultimoDisparoMs >= cooldownMs) {
    return { disparar: true, nuevoUltimoDisparoMs: ahoraMs };
  }
  return { disparar: false, nuevoUltimoDisparoMs: ultimoDisparoMs };
}

export function calcularOffsetBrilloGiroscopio(
  muestra: Vector3D,
  maxDesplazamientoPx = 18,
): BrilloOffset {
  const clamp = (val: number) => Math.max(-maxDesplazamientoPx, Math.min(maxDesplazamientoPx, val));
  return {
    dx: Math.round(clamp(muestra.y * 12) * 100) / 100,
    dy: Math.round(clamp(muestra.x * 12) * 100) / 100,
  };
}

export function haCambiadoDeSector(
  sectores: SectorRuleta[],
  anguloAnteriorDeg: number,
  anguloActualDeg: number,
): boolean {
  const anterior = obtenerSectorPorAngulo(sectores, anguloAnteriorDeg);
  const actual = obtenerSectorPorAngulo(sectores, anguloActualDeg);
  if (!anterior || !actual) {
    return false;
  }
  return anterior.indice !== actual.indice;
}
