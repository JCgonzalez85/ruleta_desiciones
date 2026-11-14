import { describe, expect, it } from "vitest";
import {
  aplicarResultadoModoEliminacion,
  calcularEstadisticasGiros,
  calcularSectoresRuleta,
  construirPathSectorSvg,
  crearRngConSemilla,
  obtenerSectorPorAngulo,
  planificarGiroConInercia,
  puedeGirarRuleta,
  seleccionarSectorPonderado,
  validarListaYOpciones,
} from "@/services/ruletaMath";

describe("Criterio de Aceptación #1 y Selección Ponderada con Semilla Fija", () => {
  it("Tras 400 giros simulados con 4 opciones iguales, cada una sale cerca del 25 %", () => {
    const opciones = [
      { id: "1", texto: "Opción A", peso: 1 },
      { id: "2", texto: "Opción B", peso: 1 },
      { id: "3", texto: "Opción C", peso: 1 },
      { id: "4", texto: "Opción D", peso: 1 },
    ];
    const sectores = calcularSectoresRuleta(opciones);
    const rng = crearRngConSemilla("semilla-equidad-2026");
    const conteo: Record<string, number> = {
      "Opción A": 0,
      "Opción B": 0,
      "Opción C": 0,
      "Opción D": 0,
    };

    for (let i = 0; i < 400; i += 1) {
      const ganador = seleccionarSectorPonderado(sectores, rng);
      conteo[ganador.texto] = (conteo[ganador.texto] ?? 0) + 1;
    }

    for (const op of opciones) {
      const porcentaje = ((conteo[op.texto] ?? 0) / 400) * 100;
      expect(porcentaje).toBeGreaterThan(19);
      expect(porcentaje).toBeLessThan(31);
    }
  });

  it("Ángulo final -> sector con pesos distintos y planificación de giro con inercia", () => {
    const opciones = [
      { id: "p1", texto: "Peso Triple", peso: 3 },
      { id: "p2", texto: "Peso Simple", peso: 1 },
    ];
    const sectores = calcularSectoresRuleta(opciones);
    expect(sectores[0]?.sweepAngleDeg).toBe(270);
    expect(sectores[1]?.sweepAngleDeg).toBe(90);

    const enTriple = obtenerSectorPorAngulo(sectores, 200);
    expect(enTriple?.texto).toBe("Peso Triple");

    const enSimple = obtenerSectorPorAngulo(sectores, 45);
    expect(enSimple?.texto).toBe("Peso Simple");

    const rng = crearRngConSemilla("giro-fijo");
    const plan = planificarGiroConInercia(opciones, 0, 1800, rng);
    const aterrizaje = obtenerSectorPorAngulo(sectores, plan.anguloFinalDeg);
    expect(aterrizaje?.id).toBe(plan.sectorGanador.id);
    expect(plan.vueltasCompletas).toBeGreaterThanOrEqual(4);
  });
});

describe("Criterios de Aceptación #2, #3, Validación y Geometría SVG", () => {
  it("Modo eliminar y reto por rondas quitan la opción que salió hasta reiniciar", () => {
    const opciones = [
      { id: "a", texto: "Tacos", peso: 1 },
      { id: "b", texto: "Sushi", peso: 1 },
      { id: "c", texto: "Pizza", peso: 1 },
    ];
    const paso1 = aplicarResultadoModoEliminacion(opciones, "a", "eliminar_salida");
    expect(paso1.restantes).toHaveLength(2);
    expect(paso1.restantes.some((o) => o.texto === "Tacos")).toBe(false);

    const pasoRonda = aplicarResultadoModoEliminacion(paso1.restantes, "b", "rondas_ganador");
    expect(pasoRonda.restantes).toHaveLength(1);
    expect(pasoRonda.ganadorFinal?.texto).toBe("Pizza");
  });

  it("Deshabilita el giro con menos de 2 opciones, valida reglas y construye SVG", () => {
    expect(puedeGirarRuleta([{ texto: "Unica", peso: 1 }])).toBe(false);
    expect(
      puedeGirarRuleta([
        { texto: "A", peso: 1 },
        { texto: "B", peso: 1 },
      ]),
    ).toBe(true);
    expect(() => planificarGiroConInercia([{ texto: "Unica", peso: 1 }], 0, 900)).toThrow();

    const invalida = validarListaYOpciones("", [
      { texto: "Duplicada", peso: 0 },
      { texto: "duplicada", peso: 12 },
    ]);
    expect(invalida.valido).toBe(false);

    const pathSvg = construirPathSectorSvg(150, 150, 120, 0, 90);
    expect(pathSvg).toContain("M 150.00 150.00");
    expect(pathSvg).toContain("A 120.00 120.00");

    expect(calcularEstadisticasGiros([])).toEqual([]);
    const stats = calcularEstadisticasGiros(["Pizza", "Sushi", "Pizza"]);
    expect(stats[0]).toEqual({ resultado: "Pizza", conteo: 2, porcentaje: 66.67 });
  });
});
