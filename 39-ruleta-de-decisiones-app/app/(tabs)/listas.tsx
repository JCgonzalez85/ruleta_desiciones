import React, { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { useAppContext } from "@/services/AppContext";
import type { ListaEntidad } from "@/types/domain";

function BotonSimple({
  label,
  text,
  style,
  textStyle,
  onPress,
}: {
  label: string;
  text: string;
  style: object;
  textStyle: object;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      style={style}
      onPress={onPress}
    >
      <Text style={textStyle}>{text}</Text>
    </Pressable>
  );
}

function BarraSesionActiva(props: {
  emailUsuario: string;
  onSync: () => Promise<void>;
  onLogout: () => Promise<void>;
}) {
  return (
    <View style={styles.rowBetween}>
      <Text style={styles.userEmail}>Sesión: {props.emailUsuario}</Text>
      <View style={styles.rowBtns}>
        <BotonSimple
          label="Sincronizar ahora"
          text="🔄 Sincronizar"
          style={styles.syncBtn}
          textStyle={styles.syncBtnText}
          onPress={props.onSync}
        />
        <BotonSimple
          label="Cerrar sesión"
          text="Salir"
          style={styles.logoutBtn}
          textStyle={styles.logoutBtnText}
          onPress={props.onLogout}
        />
      </View>
    </View>
  );
}

function PanelCuentaYSync(props: {
  emailUsuario: string | null;
  estadoSync: string;
  onSync: () => Promise<void>;
  onAuth: (email: string, pass: string, reg: boolean) => Promise<void>;
  onLogout: () => Promise<void>;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const enviar = async (esRegistro: boolean) => {
    setErrorMsg(null);
    try {
      await props.onAuth(email, password, esRegistro);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Error de autenticación");
    }
  };

  return (
    <View style={styles.card}>
      <Text style={styles.sectionTitle}>☁️ Sincronización Nube y Cuenta</Text>
      <Text style={styles.syncStatus}>{props.estadoSync}</Text>
      {props.emailUsuario ? (
        <BarraSesionActiva
          emailUsuario={props.emailUsuario}
          onSync={props.onSync}
          onLogout={props.onLogout}
        />
      ) : (
        <FormularioLoginRapido
          email={email}
          password={password}
          errorMsg={errorMsg}
          onChangeEmail={setEmail}
          onChangePassword={setPassword}
          onLogin={() => enviar(false)}
          onRegister={() => enviar(true)}
        />
      )}
    </View>
  );
}

function FormularioLoginRapido(props: {
  email: string;
  password: string;
  errorMsg: string | null;
  onChangeEmail: (v: string) => void;
  onChangePassword: (v: string) => void;
  onLogin: () => void;
  onRegister: () => void;
}) {
  return (
    <View style={styles.authBox}>
      <TextInput
        accessibilityLabel="Correo electrónico"
        style={styles.input}
        placeholder="Correo electrónico"
        autoCapitalize="none"
        keyboardType="email-address"
        value={props.email}
        onChangeText={props.onChangeEmail}
      />
      <TextInput
        accessibilityLabel="Contraseña"
        style={styles.input}
        placeholder="Contraseña (mín. 8 caracteres)"
        secureTextEntry
        value={props.password}
        onChangeText={props.onChangePassword}
      />
      {props.errorMsg ? <Text style={styles.errorText}>{props.errorMsg}</Text> : null}
      <View style={styles.rowBtns}>
        <BotonSimple
          label="Iniciar sesión"
          text="Iniciar sesión"
          style={styles.syncBtn}
          textStyle={styles.syncBtnText}
          onPress={props.onLogin}
        />
        <BotonSimple
          label="Crear cuenta"
          text="Registrarme"
          style={styles.secondaryBtn}
          textStyle={styles.secondaryBtnText}
          onPress={props.onRegister}
        />
      </View>
    </View>
  );
}

function ItemListaCard(props: {
  lista: ListaEntidad;
  esActiva: boolean;
  onUsar: () => void;
  onEditar: () => void;
  onBorrar: () => void;
}) {
  const resumen = props.lista.opciones.map((o) => `${o.texto} (${o.peso})`).join(" · ");
  const n = props.lista.nombre;
  return (
    <View style={[styles.card, props.esActiva && styles.activeCard]}>
      <View style={styles.rowBetween}>
        <Text style={styles.listTitle}>{n}</Text>
        <Text style={styles.badgeText}>
          {props.lista.pending === 1 ? "⏳ Pendiente sync" : "✅ Sincronizada"}
        </Text>
      </View>
      <Text style={styles.optionsPreview} numberOfLines={2}>
        {resumen}
      </Text>
      <View style={styles.rowBtns}>
        <BotonSimple
          label={`Usar lista ${n}`}
          text={props.esActiva ? "✓ En uso" : "Usar en ruleta"}
          style={styles.useBtn}
          textStyle={styles.useBtnText}
          onPress={props.onUsar}
        />
        <BotonSimple
          label={`Editar lista ${n}`}
          text="✏️ Editar"
          style={styles.editBtn}
          textStyle={styles.editBtnText}
          onPress={props.onEditar}
        />
        <BotonSimple
          label={`Eliminar lista ${n}`}
          text="🗑️"
          style={styles.deleteBtn}
          textStyle={styles.deleteBtnText}
          onPress={props.onBorrar}
        />
      </View>
    </View>
  );
}

export default function ListasScreen() {
  const router = useRouter();
  const ctx = useAppContext();
  const [busqueda, setBusqueda] = useState("");
  const listasFiltradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return q ? ctx.listas.filter((l) => l.nombre.toLowerCase().includes(q)) : ctx.listas;
  }, [busqueda, ctx.listas]);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <PanelCuentaYSync
        emailUsuario={ctx.emailUsuario}
        estadoSync={ctx.estadoSync}
        onSync={ctx.sincronizarAhora}
        onAuth={ctx.iniciarSesion}
        onLogout={ctx.cerrarSesion}
      />
      <View style={styles.rowBetween}>
        <TextInput
          accessibilityLabel="Buscar listas por nombre"
          style={[styles.input, { flex: 1 }]}
          placeholder="🔍 Buscar lista..."
          value={busqueda}
          onChangeText={setBusqueda}
        />
        <BotonSimple
          label="Crear nueva lista"
          text="+ Nueva Lista"
          style={styles.newBtn}
          textStyle={styles.newBtnText}
          onPress={() => router.push("/lista/nueva")}
        />
      </View>
      {listasFiltradas.map((lista) => (
        <ItemListaCard
          key={lista.id}
          lista={lista}
          esActiva={ctx.listaActiva?.id === lista.id}
          onUsar={() => {
            ctx.seleccionarLista(lista.id);
            router.push("/(tabs)");
          }}
          onEditar={() => router.push(`/lista/${lista.id}`)}
          onBorrar={() => ctx.borrarLista(lista.id)}
        />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 14, backgroundColor: "#F8FAFC", gap: 12 },
  card: { backgroundColor: "#FFFFFF", borderRadius: 12, padding: 12, gap: 8, elevation: 1 },
  activeCard: { borderWidth: 2, borderColor: "#0F766E" },
  sectionTitle: { fontSize: 15, fontWeight: "700", color: "#0F172A" },
  syncStatus: { fontSize: 12, color: "#475569" },
  userEmail: { fontSize: 13, fontWeight: "600", color: "#0F172A" },
  authBox: { gap: 8, marginTop: 4 },
  input: {
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: "#FFFFFF",
    fontSize: 13,
  },
  errorText: { color: "#DC2626", fontSize: 12, fontWeight: "600" },
  rowBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  rowBtns: { flexDirection: "row", gap: 8, alignItems: "center", flexWrap: "wrap" },
  syncBtn: {
    backgroundColor: "#0F766E",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  syncBtnText: { color: "#FFFFFF", fontWeight: "700", fontSize: 12 },
  secondaryBtn: {
    backgroundColor: "#334155",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  secondaryBtnText: { color: "#FFFFFF", fontWeight: "600", fontSize: 12 },
  logoutBtn: {
    backgroundColor: "#FEE2E2",
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  logoutBtnText: { color: "#991B1B", fontWeight: "700", fontSize: 12 },
  newBtn: {
    backgroundColor: "#0F172A",
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  newBtnText: { color: "#FFFFFF", fontWeight: "700", fontSize: 13 },
  listTitle: { fontSize: 15, fontWeight: "700", color: "#0F172A" },
  badgeText: { fontSize: 11, color: "#64748B", fontWeight: "600" },
  optionsPreview: { fontSize: 12.5, color: "#475569" },
  useBtn: {
    backgroundColor: "#0F766E",
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  useBtnText: { color: "#FFFFFF", fontWeight: "700", fontSize: 12 },
  editBtn: {
    backgroundColor: "#E2E8F0",
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  editBtnText: { color: "#1E293B", fontWeight: "600", fontSize: 12 },
  deleteBtn: {
    backgroundColor: "#FEE2E2",
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  deleteBtnText: { color: "#991B1B", fontWeight: "700", fontSize: 12 },
});
