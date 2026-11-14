import React, { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useAppContext } from "@/services/AppContext";
import { validarListaYOpciones } from "@/services/ruletaMath";
import type { OpcionInput } from "@/types/domain";

function StepBtn({
  label,
  symbol,
  onPress,
}: {
  label: string;
  symbol: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      style={styles.stepBtn}
      onPress={onPress}
    >
      <Text style={styles.stepBtnText}>{symbol}</Text>
    </Pressable>
  );
}

function FilaEditorOpcion(props: {
  opcion: OpcionInput;
  indice: number;
  totalOpciones: number;
  onChangeTexto: (texto: string) => void;
  onChangePeso: (delta: number) => void;
  onDelete: () => void;
}) {
  const num = props.indice + 1;
  return (
    <View style={styles.optionRow}>
      <TextInput
        accessibilityLabel={`Texto de opción ${num}`}
        style={styles.optionInput}
        maxLength={30}
        placeholder={`Opción ${num} (máx 30 car.)`}
        value={props.opcion.texto}
        onChangeText={props.onChangeTexto}
      />
      <View style={styles.weightBox}>
        <StepBtn
          label={`Disminuir peso de opción ${num}`}
          symbol="-"
          onPress={() => props.onChangePeso(-1)}
        />
        <Text style={styles.weightValue}>{props.opcion.peso}</Text>
        <StepBtn
          label={`Aumentar peso de opción ${num}`}
          symbol="+"
          onPress={() => props.onChangePeso(1)}
        />
      </View>
      {props.totalOpciones > 2 ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Quitar opción ${num}`}
          style={styles.removeBtn}
          onPress={props.onDelete}
        >
          <Text style={styles.removeBtnText}>✕</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const OPCIONES_POR_DEFECTO: OpcionInput[] = [
  { id: "op-1", texto: "Opción A", peso: 1 },
  { id: "op-2", texto: "Opción B", peso: 1 },
  { id: "op-3", texto: "Opción C", peso: 1 },
];

function useFormularioLista(idParam: string | undefined) {
  const router = useRouter();
  const ctx = useAppContext();
  const listaExistente = useMemo(
    () => (idParam && idParam !== "nueva" ? ctx.listas.find((l) => l.id === idParam) : undefined),
    [ctx.listas, idParam],
  );
  const [nombre, setNombre] = useState(listaExistente?.nombre ?? "Mi nueva ruleta");
  const [opciones, setOpciones] = useState<OpcionInput[]>(
    listaExistente?.opciones.map((o) => ({ id: o.id, texto: o.texto, peso: o.peso })) ??
      OPCIONES_POR_DEFECTO,
  );
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const guardar = async () => {
    setErrorMsg(null);
    const val = validarListaYOpciones(nombre, opciones);
    if (!val.valido) {
      setErrorMsg(val.errores[0] ?? "Opciones inválidas");
      return;
    }
    await ctx.guardarLista(listaExistente?.id ?? null, nombre.trim(), opciones);
    router.back();
  };

  const cambiarTexto = (idx: number, texto: string) =>
    setOpciones((p) => p.map((o, i) => (i === idx ? { ...o, texto } : o)));
  const cambiarPeso = (idx: number, d: number) =>
    setOpciones((p) =>
      p.map((o, i) => (i === idx ? { ...o, peso: Math.max(1, Math.min(10, o.peso + d)) } : o)),
    );
  const agregar = () =>
    setOpciones((p) =>
      p.length >= 12
        ? p
        : [...p, { id: `op-${Date.now()}-${p.length}`, texto: `Opción ${p.length + 1}`, peso: 1 }],
    );
  const quitar = (idx: number) =>
    setOpciones((p) => (p.length <= 2 ? p : p.filter((_, i) => i !== idx)));

  return {
    nombre,
    setNombre,
    opciones,
    errorMsg,
    guardar,
    cambiarTexto,
    cambiarPeso,
    agregar,
    quitar,
  };
}

export default function EditorListaScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const form = useFormularioLista(id);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.card}>
        <Text style={styles.label}>Nombre de la lista</Text>
        <TextInput
          accessibilityLabel="Nombre de la lista"
          style={styles.input}
          maxLength={50}
          value={form.nombre}
          onChangeText={form.setNombre}
        />
        <Text style={styles.label}>Opciones (2 a 12 · Peso entero 1 a 10)</Text>
        {form.opciones.map((op, idx) => (
          <FilaEditorOpcion
            key={op.id ?? idx}
            opcion={op}
            indice={idx}
            totalOpciones={form.opciones.length}
            onChangeTexto={(t) => form.cambiarTexto(idx, t)}
            onChangePeso={(d) => form.cambiarPeso(idx, d)}
            onDelete={() => form.quitar(idx)}
          />
        ))}
        {form.opciones.length < 12 ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Añadir opción a la lista"
            style={styles.addBtn}
            onPress={form.agregar}
          >
            <Text style={styles.addBtnText}>+ Añadir opción ({form.opciones.length}/12)</Text>
          </Pressable>
        ) : null}
        {form.errorMsg ? <Text style={styles.errorText}>{form.errorMsg}</Text> : null}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Guardar lista"
          style={styles.saveBtn}
          onPress={form.guardar}
        >
          <Text style={styles.saveBtnText}>💾 Guardar lista</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 14, backgroundColor: "#F8FAFC" },
  card: { backgroundColor: "#FFFFFF", borderRadius: 12, padding: 14, gap: 10, elevation: 1 },
  label: { fontSize: 13, fontWeight: "700", color: "#0F172A" },
  input: {
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 14,
  },
  optionRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  optionInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    fontSize: 13,
  },
  weightBox: { flexDirection: "row", alignItems: "center", gap: 4 },
  stepBtn: {
    backgroundColor: "#E2E8F0",
    width: 28,
    height: 28,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  stepBtnText: { fontSize: 16, fontWeight: "800", color: "#0F172A" },
  weightValue: { width: 22, textAlign: "center", fontWeight: "700", fontSize: 13 },
  removeBtn: {
    backgroundColor: "#FEE2E2",
    width: 28,
    height: 28,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  removeBtnText: { color: "#991B1B", fontWeight: "800", fontSize: 12 },
  addBtn: { backgroundColor: "#F1F5F9", paddingVertical: 9, borderRadius: 8, alignItems: "center" },
  addBtnText: { color: "#0F172A", fontWeight: "700", fontSize: 13 },
  errorText: { color: "#DC2626", fontSize: 12, fontWeight: "600" },
  saveBtn: {
    backgroundColor: "#0F766E",
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 4,
  },
  saveBtnText: { color: "#FFFFFF", fontWeight: "800", fontSize: 15 },
});
