import React, { useCallback, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import Svg, { Circle, G, Path, Polygon, Text as SvgText } from "react-native-svg";
import { dispararTicHapticoSector } from "@/sensors/deviceCapabilities";
import type { BrilloOffset } from "@/sensors/sensorMath";
import {
  calcularSectoresRuleta,
  construirPathSectorSvg,
  obtenerSectorPorAngulo,
  planificarGiroConInercia,
  puedeGirarRuleta,
} from "@/services/ruletaMath";
import type { OpcionInput, SectorRuleta } from "@/types/domain";

export interface SvgWheelProps {
  opciones: OpcionInput[];
  brilloOffset: BrilloOffset;
  onSpinEnd: (sectorGanador: SectorRuleta) => void;
  onEditOption?: (opcion: OpcionInput, indice: number) => void;
}

const WHEEL_SIZE = 290;
const CENTER = WHEEL_SIZE / 2;
const RADIUS = 132;

function renderSectorItem(sector: SectorRuleta) {
  const d = construirPathSectorSvg(
    CENTER,
    CENTER,
    RADIUS,
    sector.startAngleDeg,
    sector.endAngleDeg,
  );
  const labelAngleRad = ((sector.midAngleDeg - 90) * Math.PI) / 180;
  const labelRadius = RADIUS * 0.63;
  const lx = CENTER + labelRadius * Math.cos(labelAngleRad);
  const ly = CENTER + labelRadius * Math.sin(labelAngleRad);
  const etiquetaCorta = sector.texto.length > 12 ? `${sector.texto.slice(0, 11)}…` : sector.texto;

  return (
    <G key={sector.id}>
      <Path d={d} fill={sector.color} stroke="#FFFFFF" strokeWidth={2} />
      <SvgText
        x={lx}
        y={ly}
        fill="#FFFFFF"
        fontSize="11"
        fontWeight="bold"
        textAnchor="middle"
        alignmentBaseline="middle"
      >
        {`${etiquetaCorta} (${sector.peso})`}
      </SvgText>
    </G>
  );
}

function WheelSvgCanvas({
  sectores,
  brilloOffset,
}: {
  sectores: SectorRuleta[];
  brilloOffset: BrilloOffset;
}) {
  return (
    <Svg width={WHEEL_SIZE} height={WHEEL_SIZE} viewBox={`0 0 ${WHEEL_SIZE} ${WHEEL_SIZE}`}>
      <Circle cx={CENTER} cy={CENTER} r={RADIUS + 6} fill="#0F172A" />
      <G>{sectores.map(renderSectorItem)}</G>
      <Circle
        cx={CENTER + brilloOffset.dx}
        cy={CENTER - 45 + brilloOffset.dy}
        r={38}
        fill="rgba(255,255,255,0.16)"
      />
      <Circle cx={CENTER} cy={CENTER} r={22} fill="#FFFFFF" stroke="#0F172A" strokeWidth={4} />
    </Svg>
  );
}

function FilaBotonesGiro({
  deshabilitado,
  girando,
  onGirarConVelocidad,
}: {
  deshabilitado: boolean;
  girando: boolean;
  onGirarConVelocidad: (vel: number) => void;
}) {
  return (
    <View style={styles.rowButtons}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Girar ruleta"
        accessibilityState={{ disabled: deshabilitado }}
        disabled={deshabilitado}
        style={[styles.primaryBtn, deshabilitado && styles.disabledBtn]}
        onPress={() => onGirarConVelocidad(1600)}
      >
        <Text style={styles.primaryBtnText}>{girando ? "Girando..." : "🎲 Girar"}</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Girar con velocidad aleatoria"
        accessibilityState={{ disabled: deshabilitado }}
        disabled={deshabilitado}
        style={[styles.secondaryBtn, deshabilitado && styles.disabledBtn]}
        onPress={() => onGirarConVelocidad(800 + Math.random() * 2600)}
      >
        <Text style={styles.secondaryBtnText}>⚡ Giro aleatorio</Text>
      </Pressable>
    </View>
  );
}

function ChipBoton({ label, text, onPress }: { label: string; text: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      style={styles.smallBtn}
      onPress={onPress}
    >
      <Text style={styles.smallBtnText}>{text}</Text>
    </Pressable>
  );
}

function BotonesAccesiblesRuleta(props: {
  habilitado: boolean;
  girando: boolean;
  opciones: OpcionInput[];
  onGirarConVelocidad: (vel: number) => void;
  onCambiarEscala: (delta: number) => void;
  onEditOption?: (opcion: OpcionInput, indice: number) => void;
}) {
  const deshabilitado = !props.habilitado || props.girando;
  const primera = props.opciones[0];
  return (
    <View style={styles.controlsBox}>
      <FilaBotonesGiro
        deshabilitado={deshabilitado}
        girando={props.girando}
        onGirarConVelocidad={props.onGirarConVelocidad}
      />
      <View style={styles.rowButtons}>
        <ChipBoton
          label="Reducir tamaño de la ruleta"
          text="🔍 - Tamaño"
          onPress={() => props.onCambiarEscala(-0.1)}
        />
        <ChipBoton
          label="Aumentar tamaño de la ruleta"
          text="🔍 + Tamaño"
          onPress={() => props.onCambiarEscala(0.1)}
        />
        {props.onEditOption && primera ? (
          <ChipBoton
            label={`Editar opción ${primera.texto}`}
            text="✏️ Editar sector"
            onPress={() => props.onEditOption?.(primera, 0)}
          />
        ) : null}
      </View>
    </View>
  );
}

function programarTicsFrenado(duracionMs: number): void {
  const pasos = 7;
  for (let i = 1; i <= pasos; i += 1) {
    const delay = Math.round((duracionMs / (pasos + 1)) * i);
    setTimeout(() => {
      dispararTicHapticoSector();
    }, delay);
  }
}

function useWheelAnimation(opciones: OpcionInput[], onSpinEnd: (s: SectorRuleta) => void) {
  const [girando, setGirando] = useState(false);
  const rotacionActualRef = useRef(0);
  const rotacionSv = useSharedValue(0);
  const escalaSv = useSharedValue(1);
  const habilitado = puedeGirarRuleta(opciones);

  const finalizarGiroJs = useCallback(
    (sectorGanador: SectorRuleta, anguloFinal: number) => {
      rotacionActualRef.current = anguloFinal;
      setGirando(false);
      onSpinEnd(sectorGanador);
    },
    [onSpinEnd],
  );

  const iniciarGiro = useCallback(
    (velocidadPxSeg: number) => {
      if (!habilitado || girando) return;
      setGirando(true);
      const plan = planificarGiroConInercia(opciones, rotacionActualRef.current, velocidadPxSeg);
      programarTicsFrenado(plan.duracionMs);
      rotacionSv.value = withTiming(
        plan.anguloFinalDeg,
        { duration: plan.duracionMs, easing: Easing.out(Easing.cubic) },
        (finished) => {
          if (finished) runOnJS(finalizarGiroJs)(plan.sectorGanador, plan.anguloFinalDeg);
        },
      );
    },
    [finalizarGiroJs, girando, habilitado, opciones, rotacionSv],
  );

  return { girando, habilitado, rotacionActualRef, rotacionSv, escalaSv, iniciarGiro };
}

function useWheelGestures(
  escalaSv: { value: number },
  iniciarGiro: (vel: number) => void,
  editarSectorBajoAguja: () => void,
) {
  return useMemo(() => {
    const pan = Gesture.Pan().onEnd((e) => {
      runOnJS(iniciarGiro)(Math.max(700, Math.hypot(e.velocityX, e.velocityY)));
    });
    const doubleTap = Gesture.Tap()
      .numberOfTaps(2)
      .onEnd(() => runOnJS(iniciarGiro)(900 + Math.random() * 2200));
    const longPress = Gesture.LongPress()
      .minDuration(550)
      .onStart(() => runOnJS(editarSectorBajoAguja)());
    const pinch = Gesture.Pinch().onUpdate((e) => {
      escalaSv.value = Math.max(0.75, Math.min(1.3, e.scale));
    });
    return Gesture.Simultaneous(pinch, Gesture.Race(doubleTap, pan, longPress));
  }, [editarSectorBajoAguja, escalaSv, iniciarGiro]);
}

export function SvgWheel({ opciones, brilloOffset, onSpinEnd, onEditOption }: SvgWheelProps) {
  const sectores = useMemo(() => calcularSectoresRuleta(opciones), [opciones]);
  const anim = useWheelAnimation(opciones, onSpinEnd);

  const cambiarEscala = useCallback(
    (delta: number) => {
      const nueva = Math.max(0.75, Math.min(1.3, anim.escalaSv.value + delta));
      anim.escalaSv.value = withTiming(nueva, { duration: 180 });
    },
    [anim.escalaSv],
  );

  const editarSectorBajoAguja = useCallback(() => {
    if (!onEditOption || sectores.length === 0) return;
    const sector = obtenerSectorPorAngulo(sectores, anim.rotacionActualRef.current);
    const idx = sector?.indice ?? 0;
    const op = opciones[idx];
    if (op) onEditOption(op, idx);
  }, [anim.rotacionActualRef, onEditOption, opciones, sectores]);

  const gestoCompuesto = useWheelGestures(anim.escalaSv, anim.iniciarGiro, editarSectorBajoAguja);
  const wheelAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: anim.escalaSv.value }, { rotate: `${anim.rotacionSv.value}deg` }],
  }));

  return (
    <View style={styles.container}>
      <View style={styles.pointerContainer} accessible accessibilityLabel="Aguja indicadora">
        <Svg width={32} height={26} viewBox="0 0 32 26">
          <Polygon points="16,26 2,2 30,2" fill="#E11D48" stroke="#FFFFFF" strokeWidth={2} />
        </Svg>
      </View>
      <GestureDetector gesture={gestoCompuesto}>
        <Animated.View style={[styles.wheelWrapper, wheelAnimStyle]}>
          <WheelSvgCanvas sectores={sectores} brilloOffset={brilloOffset} />
        </Animated.View>
      </GestureDetector>
      <Text style={styles.gestureHint}>
        Gestos: Desliza rápido para lanzar · Doble toque giro aleatorio · Pellizca tamaño · Mantén
        presionado para editar
      </Text>
      <BotonesAccesiblesRuleta
        habilitado={anim.habilitado}
        girando={anim.girando}
        opciones={opciones}
        onGirarConVelocidad={anim.iniciarGiro}
        onCambiarEscala={cambiarEscala}
        onEditOption={onEditOption}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: "center", marginVertical: 8 },
  pointerContainer: { zIndex: 10, marginBottom: -12 },
  wheelWrapper: {
    width: WHEEL_SIZE,
    height: WHEEL_SIZE,
    alignItems: "center",
    justifyContent: "center",
  },
  gestureHint: {
    fontSize: 11.5,
    color: "#475569",
    textAlign: "center",
    marginTop: 8,
    paddingHorizontal: 12,
  },
  controlsBox: { width: "100%", marginTop: 10, gap: 8 },
  rowButtons: { flexDirection: "row", justifyContent: "center", gap: 8, flexWrap: "wrap" },
  primaryBtn: {
    backgroundColor: "#0F766E",
    paddingVertical: 11,
    paddingHorizontal: 22,
    borderRadius: 10,
  },
  primaryBtnText: { color: "#FFFFFF", fontWeight: "700", fontSize: 15 },
  secondaryBtn: {
    backgroundColor: "#1E293B",
    paddingVertical: 11,
    paddingHorizontal: 16,
    borderRadius: 10,
  },
  secondaryBtnText: { color: "#FFFFFF", fontWeight: "600", fontSize: 14 },
  smallBtn: {
    backgroundColor: "#E2E8F0",
    paddingVertical: 7,
    paddingHorizontal: 11,
    borderRadius: 8,
  },
  smallBtnText: { color: "#1E293B", fontWeight: "600", fontSize: 12 },
  disabledBtn: { opacity: 0.45 },
});
