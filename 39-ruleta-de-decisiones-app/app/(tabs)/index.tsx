import React, { useCallback, useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { SvgWheel } from "@/components/SvgWheel";
import { leerResultadoEnVozAlta } from "@/sensors/deviceCapabilities";
import { useGyroTiltShine, useShakeToSpin } from "@/sensors/useSensors";
import { useAppContext } from "@/services/AppContext";
import { calcularSectoresRuleta, seleccionarSectorPonderado } from "@/services/ruletaMath";
import type { ListaEntidad, ModoEliminacion, OpcionInput, SectorRuleta } from "@/types/domain";

function SelectorListaYModoRapido(props: {
  listas: ListaEntidad[];
  listaActivaId: string | undefined;
  modoRapidoActivo: boolean;
  onSelectLista: (id: string) => void;
  onAplicarRapido: (textoCsv: string) => void;
}) {
  const [csvTexto, setCsvTexto] = useState("Pizza, Sushi, Tacos, Hamburguesa");
  return (
    <View style={styles.card}>
      <Text style={styles.sectionTitle}>Lista activa o Modo Rápido</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pillsScroll}>
        {props.listas.map((l) => {
          const activa = !props.modoRapidoActivo && l.id === props.listaActivaId;
          return (
            <Pressable
              key={l.id}
              accessibilityRole="button"
              accessibilityLabel={`Seleccionar lista ${l.nombre}`}
              style={[styles.pill, activa && styles.pillActive]}
              onPress={() => props.onSelectLista(l.id)}
            >
              <Text style={[styles.pillText, activa && styles.pillTextActive]}>{l.nombre}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
      <View style={styles.quickRow}>
        <TextInput
          accessibilityLabel="Opciones rápidas separadas por coma"
          style={styles.input}
          value={csvTexto}
          onChangeText={setCsvTexto}
          placeholder="Ej: Opción A, Opción B, Opción C"
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Activar modo rápido"
          style={styles.quickBtn}
          onPress={() => props.onAplicarRapido(csvTexto)}
        >
          <Text style={styles.quickBtnText}>Modo Rápido</Text>
        </Pressable>
      </View>
    </View>
  );
}

function TarjetaGanador({
  ultimoGanador,
  campeonReto,
}: {
  ultimoGanador: string | null;
  campeonReto: string | null;
}) {
  if (!ultimoGanador && !campeonReto) return null;
  const textoMostrar = campeonReto ? `🏆 Campeón del reto: ${campeonReto}` : `🎉 ${ultimoGanador}`;
  const hablar = () => {
    leerResultadoEnVozAlta(campeonReto ?? ultimoGanador ?? "");
  };
  const compartir = () => {
    Share.share({ message: `La Ruleta de Decisiones eligió: ${campeonReto ?? ultimoGanador}` });
  };
  return (
    <View style={styles.winnerCard}>
      <Text style={styles.winnerTitle}>{textoMostrar}</Text>
      <View style={styles.rowActions}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Leer resultado en voz alta"
          style={styles.actionChip}
          onPress={hablar}
        >
          <Text style={styles.actionChipText}>🔊 Escuchar voz</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Compartir resultado"
          style={styles.actionChip}
          onPress={compartir}
        >
          <Text style={styles.actionChipText}>📤 Compartir</Text>
        </Pressable>
      </View>
    </View>
  );
}

function PanelModosEliminacion({
  modo,
  eliminadasCount,
  onSelectModo,
  onReset,
}: {
  modo: ModoEliminacion;
  eliminadasCount: number;
  onSelectModo: (m: ModoEliminacion) => void;
  onReset: () => void;
}) {
  const modos: Array<{ id: ModoEliminacion; label: string }> = [
    { id: "normal", label: "Normal" },
    { id: "eliminar_salida", label: "Eliminar ganadora" },
    { id: "rondas_ganador", label: "Reto hasta 1" },
  ];
  return (
    <View style={styles.card}>
      <Text style={styles.sectionTitle}>Modo de Juego / Eliminación</Text>
      <View style={styles.rowWrap}>
        {modos.map((m) => (
          <Pressable
            key={m.id}
            accessibilityRole="button"
            accessibilityLabel={`Modo ${m.label}`}
            style={[styles.pill, modo === m.id && styles.pillActive]}
            onPress={() => onSelectModo(m.id)}
          >
            <Text style={[styles.pillText, modo === m.id && styles.pillTextActive]}>{m.label}</Text>
          </Pressable>
        ))}
        {eliminadasCount > 0 ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Restaurar opciones eliminadas"
            style={styles.resetBtn}
            onPress={onReset}
          >
            <Text style={styles.resetBtnText}>↺ Restaurar ({eliminadasCount})</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

function PanelSensores({
  vozActiva,
  shakeActivo,
  brilloActivo,
  onToggleVoz,
  onToggleShake,
  onToggleBrillo,
}: {
  vozActiva: boolean;
  shakeActivo: boolean;
  brilloActivo: boolean;
  onToggleVoz: (v: boolean) => void;
  onToggleShake: (v: boolean) => void;
  onToggleBrillo: (v: boolean) => void;
}) {
  return (
    <View style={styles.card}>
      <Text style={styles.sectionTitle}>Sensores y Capacidades Nativas</Text>
      <View style={styles.sensorRow}>
        <Text style={styles.sensorLabel}>🔊 Anunciar ganador con voz (Speech)</Text>
        <Switch
          accessibilityLabel="Activar anuncio con voz"
          value={vozActiva}
          onValueChange={onToggleVoz}
        />
      </View>
      <View style={styles.sensorRow}>
        <Text style={styles.sensorLabel}>📱 Sacudir teléfono para girar (Acelerómetro)</Text>
        <Switch
          accessibilityLabel="Activar sacudir para girar"
          value={shakeActivo}
          onValueChange={onToggleShake}
        />
      </View>
      <View style={styles.sensorRow}>
        <Text style={styles.sensorLabel}>✨ Brillo visual al inclinar (Giroscopio)</Text>
        <Switch
          accessibilityLabel="Activar brillo con giroscopio"
          value={brilloActivo}
          onValueChange={onToggleBrillo}
        />
      </View>
    </View>
  );
}

function convertirCsvAOpciones(textoCsv: string): OpcionInput[] {
  const partes = textoCsv
    .split(",")
    .map((s) => s.trim().slice(0, 30))
    .filter((s) => s.length > 0);
  const unicas = Array.from(new Set(partes)).slice(0, 12);
  return unicas.map((texto, idx) => ({ id: `rapida-${idx}`, texto, peso: 1 }));
}

function useOpcionesRuletaActivas(ctx: ReturnType<typeof useAppContext>) {
  const opcionesBase = useMemo<OpcionInput[]>(() => {
    if (ctx.opcionesRapidas && ctx.opcionesRapidas.length >= 2) return ctx.opcionesRapidas;
    return ctx.listaActiva?.opciones.map((o) => ({ id: o.id, texto: o.texto, peso: o.peso })) ?? [];
  }, [ctx.listaActiva, ctx.opcionesRapidas]);

  return useMemo(() => {
    if (ctx.modoEliminacion === "normal") {
      return { activas: opcionesBase, campeon: null as OpcionInput | null };
    }
    const activas = opcionesBase.filter((o) => !ctx.eliminadasIds.includes(o.id ?? o.texto));
    const campeon =
      ctx.modoEliminacion === "rondas_ganador" && activas.length === 1
        ? (activas[0] ?? null)
        : null;
    return { activas, campeon };
  }, [ctx.eliminadasIds, ctx.modoEliminacion, opcionesBase]);
}

function useControladorGiroYSensores(
  ctx: ReturnType<typeof useAppContext>,
  activas: OpcionInput[],
) {
  const [ultimoGanador, setUltimoGanador] = useState<string | null>(null);
  const alTerminarGiro = useCallback(
    (s: SectorRuleta) => {
      setUltimoGanador(s.texto);
      ctx.procesarGanadorGiro(s.id, s.texto);
    },
    [ctx],
  );
  const girarPorSacudida = useCallback(() => {
    if (activas.length >= 2) {
      alTerminarGiro(seleccionarSectorPonderado(calcularSectoresRuleta(activas)));
    }
  }, [activas, alTerminarGiro]);

  useShakeToSpin(ctx.shakeActivo, girarPorSacudida);
  const brilloOffset = useGyroTiltShine(ctx.brilloGiroscopioActivo);
  return { ultimoGanador, alTerminarGiro, brilloOffset };
}

export default function RuletaScreen() {
  const router = useRouter();
  const ctx = useAppContext();
  const estadoElim = useOpcionesRuletaActivas(ctx);
  const ctrl = useControladorGiroYSensores(ctx, estadoElim.activas);

  return (
    <ScrollView contentContainerStyle={styles.scrollContent}>
      <SelectorListaYModoRapido
        listas={ctx.listas}
        listaActivaId={ctx.listaActiva?.id}
        modoRapidoActivo={Boolean(ctx.opcionesRapidas)}
        onSelectLista={ctx.seleccionarLista}
        onAplicarRapido={(csv) => ctx.activarModoRapido(convertirCsvAOpciones(csv))}
      />
      <TarjetaGanador
        ultimoGanador={ctrl.ultimoGanador}
        campeonReto={estadoElim.campeon?.texto ?? null}
      />
      <SvgWheel
        opciones={estadoElim.activas}
        brilloOffset={ctrl.brilloOffset}
        onSpinEnd={ctrl.alTerminarGiro}
        onEditOption={() => ctx.listaActiva && router.push(`/lista/${ctx.listaActiva.id}`)}
      />
      <PanelModosEliminacion
        modo={ctx.modoEliminacion}
        eliminadasCount={ctx.eliminadasIds.length}
        onSelectModo={ctx.setModoEliminacion}
        onReset={ctx.reiniciarEliminadas}
      />
      <PanelSensores
        vozActiva={ctx.vozActiva}
        shakeActivo={ctx.shakeActivo}
        brilloActivo={ctx.brilloGiroscopioActivo}
        onToggleVoz={ctx.setVozActiva}
        onToggleShake={ctx.setShakeActivo}
        onToggleBrillo={ctx.setBrilloGiroscopioActivo}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContent: { padding: 14, backgroundColor: "#F8FAFC", gap: 12 },
  card: { backgroundColor: "#FFFFFF", borderRadius: 12, padding: 12, elevation: 1, gap: 8 },
  sectionTitle: { fontSize: 14, fontWeight: "700", color: "#0F172A" },
  pillsScroll: { flexDirection: "row" },
  pill: {
    backgroundColor: "#E2E8F0",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    marginRight: 8,
  },
  pillActive: { backgroundColor: "#0F766E" },
  pillText: { color: "#1E293B", fontWeight: "600", fontSize: 13 },
  pillTextActive: { color: "#FFFFFF" },
  quickRow: { flexDirection: "row", gap: 8, alignItems: "center", marginTop: 4 },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 13,
  },
  quickBtn: {
    backgroundColor: "#334155",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  quickBtnText: { color: "#FFFFFF", fontWeight: "600", fontSize: 12 },
  winnerCard: {
    backgroundColor: "#ECFDF5",
    borderColor: "#10B981",
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    alignItems: "center",
    gap: 8,
  },
  winnerTitle: { fontSize: 17, fontWeight: "800", color: "#065F46", textAlign: "center" },
  rowActions: { flexDirection: "row", gap: 10 },
  actionChip: {
    backgroundColor: "#059669",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  actionChipText: { color: "#FFFFFF", fontWeight: "600", fontSize: 12 },
  rowWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8, alignItems: "center" },
  resetBtn: {
    backgroundColor: "#FEE2E2",
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 12,
  },
  resetBtnText: { color: "#991B1B", fontWeight: "700", fontSize: 12 },
  sensorRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 2,
  },
  sensorLabel: { fontSize: 13, color: "#334155", flex: 1, paddingRight: 8 },
});
