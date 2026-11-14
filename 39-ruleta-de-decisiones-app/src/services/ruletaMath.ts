import type {
  EstadisticaOpcion,
  ModoEliminacion,
  OpcionInput,
  PlanGiro,
  SectorRuleta,
  ValidacionResultado,
} from "@/types/domain";

const PALETA_SECTORES = [
  "#0F766E",
  "#1D4ED8",
  "#B45309",
  "#BE123C",
  "#6D28D9",
  "#15803D",
  "#0369A1",
  "#A21CAF",
  "#C2410C",
  "#4338CA",
  "#047857",
  "#B91C1C",
];

export function crearRngConSemilla(semilla: string): () => number {
  let h1 = 1779033703;
  let h2 = 3144134277;
  let h3 = 1013904242;
  let h4 = 2773480762;
  for (let i = 0; i < semilla.length; i += 1) {
    const k = semilla.charCodeAt(i);
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
  }
  let a = Math.imul(h3 ^ (h1 >>> 18), 597399067) >>> 0;
  let b = Math.imul(h4 ^ (h2 >>> 22), 2869860233) >>> 0;
  let c = Math.imul(h1 ^ (h3 >>> 17), 951274213) >>> 0;
  let d = Math.imul(h2 ^ (h4 >>> 19), 2716044179) >>> 0;

  return () => {
    const t = (a + b + d) | 0;
    d = (d + 1) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = ((c << 21) | (c >>> 11)) + t;
    return (t >>> 0) / 4294967296;
  };
}

function validarOpcionIndividual(op: OpcionInput, vistos: Set<string>): string[] {
  const errs: string[] = [];
  const txt = op.texto.trim();
  if (txt.length === 0 || txt.length > 30) {
    errs.push("Cada opción debe tener entre 1 y 30 caracteres.");
  }
  const clave = txt.toLocaleLowerCase("es");
  if (txt.length > 0 && vistos.has(clave)) {
    errs.push(`La opción "${txt}" está duplicada.`);
  }
  vistos.add(clave);
  if (!Number.isInteger(op.peso) || op.peso < 1 || op.peso > 10) {
    errs.push("El peso de cada opción debe ser un entero entre 1 y 10.");
  }
  return errs;
}

export function validarListaYOpciones(
  nombre: string,
  opciones: OpcionInput[],
): ValidacionResultado {
  const errores: string[] = [];
  if (nombre.trim().length === 0 || nombre.trim().length > 50) {
    errores.push("El nombre de la lista es obligatorio (máx. 50 caracteres).");
  }
  if (opciones.length < 2 || opciones.length > 12) {
    errores.push("La lista debe tener entre 2 y 12 opciones.");
  }
  const vistos = new Set<string>();
  for (const op of opciones) {
    errores.push(...validarOpcionIndividual(op, vistos));
  }
  return { valido: errores.length === 0, errores };
}

export function puedeGirarRuleta(opciones: OpcionInput[]): boolean {
  return opciones.length >= 2;
}

export function calcularSectoresRuleta(opciones: OpcionInput[]): SectorRuleta[] {
  if (opciones.length === 0) {
    return [];
  }
  const pesoTotal = opciones.reduce((acc, op) => acc + Math.max(1, op.peso), 0);
  let cursorDeg = 0;

  return opciones.map((op, index) => {
    const pesoLimpio = Math.max(1, Math.min(10, Math.round(op.peso)));
    const proporcion = pesoLimpio / pesoTotal;
    const sweepAngleDeg = proporcion * 360;
    const startAngleDeg = cursorDeg;
    const endAngleDeg = index === opciones.length - 1 ? 360 : cursorDeg + sweepAngleDeg;
    const midAngleDeg = startAngleDeg + (endAngleDeg - startAngleDeg) / 2;
    cursorDeg = endAngleDeg;

    return {
      indice: index,
      id: op.id ?? `op-${index}`,
      texto: op.texto.trim(),
      peso: pesoLimpio,
      color: PALETA_SECTORES[index % PALETA_SECTORES.length] ?? "#0F766E",
      startAngleDeg,
      endAngleDeg,
      midAngleDeg,
      sweepAngleDeg: endAngleDeg - startAngleDeg,
      porcentaje: Math.round(proporcion * 10000) / 100,
    };
  });
}

export function normalizarAnguloDeg(anguloDeg: number): number {
  const mod = anguloDeg % 360;
  return mod < 0 ? mod + 360 : mod;
}

export function obtenerSectorPorAngulo(
  sectores: SectorRuleta[],
  rotacionRuletaDeg: number,
): SectorRuleta | null {
  if (sectores.length === 0) {
    return null;
  }
  const anguloBajoAguja = normalizarAnguloDeg(360 - normalizarAnguloDeg(rotacionRuletaDeg));
  for (const sector of sectores) {
    if (anguloBajoAguja >= sector.startAngleDeg && anguloBajoAguja < sector.endAngleDeg) {
      return sector;
    }
  }
  return sectores[sectores.length - 1] ?? null;
}

export function seleccionarSectorPonderado(
  sectores: SectorRuleta[],
  rng: () => number = Math.random,
): SectorRuleta {
  const first = sectores[0];
  if (!first) {
    throw new Error("Se requieren al menos 2 opciones para girar la ruleta.");
  }
  const pesoTotal = sectores.reduce((acc, s) => acc + s.peso, 0);
  const umbral = rng() * pesoTotal;
  let acumulado = 0;

  for (const sector of sectores) {
    acumulado += sector.peso;
    if (umbral < acumulado) {
      return sector;
    }
  }
  return sectores[sectores.length - 1] ?? first;
}

export function planificarGiroConInercia(
  opciones: OpcionInput[],
  rotacionActualDeg: number,
  velocidadGestoPxSeg: number,
  rng: () => number = Math.random,
): PlanGiro {
  if (!puedeGirarRuleta(opciones)) {
    throw new Error("No se puede girar con menos de 2 opciones.");
  }
  const sectores = calcularSectoresRuleta(opciones);
  const sectorGanador = seleccionarSectorPonderado(sectores, rng);

  const velAbs = Math.min(4000, Math.max(400, Math.abs(velocidadGestoPxSeg)));
  const vueltasCompletas = Math.max(4, Math.min(12, Math.round(velAbs / 350)));
  const offsetInterno = (rng() - 0.5) * sectorGanador.sweepAngleDeg * 0.55;
  const anguloObjetivoEnRueda = sectorGanador.midAngleDeg + offsetInterno;

  const rotacionObjetivoMod = normalizarAnguloDeg(360 - anguloObjetivoEnRueda);
  const rotacionActualMod = normalizarAnguloDeg(rotacionActualDeg);
  const deltaPositivo = normalizarAnguloDeg(rotacionObjetivoMod - rotacionActualMod);

  const anguloFinalDeg = rotacionActualDeg + vueltasCompletas * 360 + deltaPositivo;
  const duracionMs = Math.round(2400 + vueltasCompletas * 220);

  return {
    sectorGanador,
    anguloFinalDeg,
    vueltasCompletas,
    duracionMs,
  };
}

export function aplicarResultadoModoEliminacion<T extends OpcionInput>(
  opcionesActivas: T[],
  ganadoraIdOTexto: string,
  modo: ModoEliminacion,
): { restantes: T[]; ganadorFinal: T | null } {
  if (modo === "normal") {
    return { restantes: opcionesActivas, ganadorFinal: null };
  }
  const restantes = opcionesActivas.filter(
    (op) => op.id !== ganadoraIdOTexto && op.texto !== ganadoraIdOTexto,
  );
  const ganadorFinal =
    modo === "rondas_ganador" && restantes.length === 1 ? (restantes[0] ?? null) : null;

  return { restantes, ganadorFinal };
}

export function construirPathSectorSvg(
  cx: number,
  cy: number,
  radio: number,
  startAngleDeg: number,
  endAngleDeg: number,
): string {
  const startRad = ((startAngleDeg - 90) * Math.PI) / 180;
  const endRad = ((endAngleDeg - 90) * Math.PI) / 180;
  const x1 = cx + radio * Math.cos(startRad);
  const y1 = cy + radio * Math.sin(startRad);
  const x2 = cx + radio * Math.cos(endRad);
  const y2 = cy + radio * Math.sin(endRad);
  const largeArcFlag = endAngleDeg - startAngleDeg > 180 ? 1 : 0;

  return [
    `M ${cx.toFixed(2)} ${cy.toFixed(2)}`,
    `L ${x1.toFixed(2)} ${y1.toFixed(2)}`,
    `A ${radio.toFixed(2)} ${radio.toFixed(2)} 0 ${largeArcFlag} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`,
    "Z",
  ].join(" ");
}

export function calcularEstadisticasGiros(resultados: string[]): EstadisticaOpcion[] {
  if (resultados.length === 0) return [];
  const conteos = new Map<string, number>();
  for (const r of resultados) {
    conteos.set(r, (conteos.get(r) ?? 0) + 1);
  }
  const total = resultados.length;
  return Array.from(conteos.entries())
    .map(([resultado, conteo]) => ({
      resultado,
      conteo,
      porcentaje: Math.round((conteo / total) * 10000) / 100,
    }))
    .sort((a, b) => b.conteo - a.conteo);
}
