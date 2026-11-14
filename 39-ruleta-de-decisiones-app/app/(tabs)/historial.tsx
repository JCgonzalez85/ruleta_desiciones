import React, { useMemo } from "react";
import { Pressable, ScrollView, Share, StyleSheet, Text, View } from "react-native";
import { leerResultadoEnVozAlta } from "@/sensors/deviceCapabilities";
import { useAppContext } from "@/services/AppContext";
import { calcularEstadisticasGiros } from "@/services/ruletaMath";
import type { EstadisticaOpcion, GiroEntidad } from "@/types/domain";

function TarjetaEstadisticasEquidad({
  nombreLista,
  totalGiros,
  estadisticas,
}: {
  nombreLista: string;
  totalGiros: number;
  estadisticas: EstadisticaOpcion[];
}) {
  return (
    <View style={styles.card}>
      <Text style={styles.sectionTitle}>📊 Estadísticas de Equidad ({nombreLista})</Text>
      <Text style={styles.subText}>Total de giros en esta lista: {totalGiros}</Text>
      {estadisticas.length === 0 ? (
        <Text style={styles.emptyText}>Aún no hay giros registrados para esta lista.</Text>
      ) : (
        estadisticas.map((item) => (
          <View key={item.resultado} style={styles.statRow}>
            <View style={styles.rowBetween}>
              <Text style={styles.statLabel}>{item.resultado}</Text>
              <Text style={styles.statValue}>
                {item.conteo} ({item.porcentaje}%)
              </Text>
            </View>
            <View style={styles.barTrack}>
              <View style={[styles.barFill, { width: `${Math.min(100, item.porcentaje)}%` }]} />
            </View>
          </View>
        ))
      )}
    </View>
  );
}

function FilaGiroHistorial({
  giro,
  nombreLista,
  onBorrar,
}: {
  giro: GiroEntidad;
  nombreLista: string;
  onBorrar: () => void;
}) {
  const fechaLegible = new Date(giro.girado_en).toLocaleString();
  return (
    <View style={styles.historyCard}>
      <View style={styles.rowBetween}>
        <Text style={styles.winnerText}>🎯 {giro.resultado}</Text>
        <Text style={styles.syncBadge}>{giro.pending === 1 ? "⏳ Local" : "☁️ Sync"}</Text>
      </View>
      <Text style={styles.metaText}>
        Lista: {nombreLista} · {fechaLegible}
      </Text>
      <View style={styles.rowActions}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Escuchar resultado ${giro.resultado}`}
          style={styles.smallBtn}
          onPress={() => leerResultadoEnVozAlta(giro.resultado)}
        >
          <Text style={styles.smallBtnText}>🔊 Voz</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Compartir resultado ${giro.resultado}`}
          style={styles.smallBtn}
          onPress={() => Share.share({ message: `Resultado en ${nombreLista}: ${giro.resultado}` })}
        >
          <Text style={styles.smallBtnText}>📤 Compartir</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Eliminar giro ${giro.resultado}`}
          style={styles.deleteBtn}
          onPress={onBorrar}
        >
          <Text style={styles.deleteBtnText}>🗑️</Text>
        </Pressable>
      </View>
    </View>
  );
}

export default function HistorialScreen() {
  const ctx = useAppContext();

  const girosListaActiva = useMemo(() => {
    if (!ctx.listaActiva) return ctx.historial;
    return ctx.historial.filter((g) => g.lista_id === ctx.listaActiva?.id);
  }, [ctx.historial, ctx.listaActiva]);

  const estadisticas = useMemo(
    () => calcularEstadisticasGiros(girosListaActiva.map((g) => g.resultado)),
    [girosListaActiva],
  );

  const mapaNombres = useMemo(() => {
    const m = new Map<string, string>();
    for (const l of ctx.listas) m.set(l.id, l.nombre);
    return m;
  }, [ctx.listas]);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <TarjetaEstadisticasEquidad
        nombreLista={ctx.listaActiva?.nombre ?? "Todas"}
        totalGiros={girosListaActiva.length}
        estadisticas={estadisticas}
      />

      <Text style={styles.sectionTitle}>🕓 Historial Reciente ({ctx.historial.length})</Text>
      {ctx.historial.length === 0 ? (
        <View style={styles.card}>
          <Text style={styles.emptyText}>Gira la ruleta para registrar tu primer resultado.</Text>
        </View>
      ) : (
        ctx.historial.map((giro) => (
          <FilaGiroHistorial
            key={giro.id}
            giro={giro}
            nombreLista={mapaNombres.get(giro.lista_id) ?? "Lista"}
            onBorrar={() => ctx.borrarGiro(giro.id)}
          />
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 14, backgroundColor: "#F8FAFC", gap: 12 },
  card: { backgroundColor: "#FFFFFF", borderRadius: 12, padding: 14, gap: 8, elevation: 1 },
  sectionTitle: { fontSize: 15, fontWeight: "700", color: "#0F172A" },
  subText: { fontSize: 12, color: "#475569" },
  emptyText: { fontSize: 13, color: "#64748B", fontStyle: "italic" },
  statRow: { gap: 4, marginTop: 4 },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  statLabel: { fontSize: 13, fontWeight: "600", color: "#1E293B" },
  statValue: { fontSize: 12, fontWeight: "700", color: "#0F766E" },
  barTrack: { height: 7, backgroundColor: "#E2E8F0", borderRadius: 4, overflow: "hidden" },
  barFill: { height: "100%", backgroundColor: "#0F766E" },
  historyCard: { backgroundColor: "#FFFFFF", borderRadius: 10, padding: 12, gap: 6, elevation: 1 },
  winnerText: { fontSize: 15, fontWeight: "700", color: "#0F172A" },
  syncBadge: { fontSize: 11, color: "#64748B", fontWeight: "600" },
  metaText: { fontSize: 12, color: "#475569" },
  rowActions: { flexDirection: "row", gap: 8, marginTop: 4 },
  smallBtn: {
    backgroundColor: "#F1F5F9",
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
  },
  smallBtnText: { fontSize: 12, fontWeight: "600", color: "#1E293B" },
  deleteBtn: {
    backgroundColor: "#FEE2E2",
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
  },
  deleteBtnText: { fontSize: 12, fontWeight: "700", color: "#991B1B" },
});
