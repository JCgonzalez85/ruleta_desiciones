import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { loginConApi, registrarConApi } from "@/api/apiClient";
import { clearSessionTokens, getSessionTokens } from "@/api/tokenStorage";
import { runMigrations } from "@/db/database";
import {
  eliminarGiroLocal,
  listarHistorialGiros,
  registrarGiroLocal,
} from "@/repositories/girosRepository";
import {
  eliminarListaLocal,
  generarUuidV4,
  guardarListaConOpciones,
  listarListasActivas,
  sembrarListasInicialesSiVacio,
} from "@/repositories/listasRepository";
import { dispararHapticoGanador, leerResultadoEnVozAlta } from "@/sensors/deviceCapabilities";
import { sincronizarConApi } from "@/services/syncService";
import type { GiroEntidad, ListaEntidad, ModoEliminacion, OpcionInput } from "@/types/domain";

export interface AppContextValue {
  listas: ListaEntidad[];
  listaActiva: ListaEntidad | null;
  opcionesRapidas: OpcionInput[] | null;
  historial: GiroEntidad[];
  modoEliminacion: ModoEliminacion;
  eliminadasIds: string[];
  vozActiva: boolean;
  shakeActivo: boolean;
  brilloGiroscopioActivo: boolean;
  emailUsuario: string | null;
  estadoSync: string;
  seleccionarLista: (id: string) => void;
  activarModoRapido: (opciones: OpcionInput[] | null) => void;
  setModoEliminacion: (modo: ModoEliminacion) => void;
  reiniciarEliminadas: () => void;
  setVozActiva: (v: boolean) => void;
  setShakeActivo: (v: boolean) => void;
  setBrilloGiroscopioActivo: (v: boolean) => void;
  guardarLista: (id: string | null, nombre: string, opciones: OpcionInput[]) => Promise<void>;
  borrarLista: (id: string) => Promise<void>;
  borrarGiro: (id: string) => Promise<void>;
  procesarGanadorGiro: (idOpcion: string, textoOpcion: string) => Promise<void>;
  sincronizarAhora: () => Promise<void>;
  iniciarSesion: (email: string, password: string, esRegistro: boolean) => Promise<void>;
  cerrarSesion: () => Promise<void>;
}

const AppContext = createContext<AppContextValue | null>(null);

export function useAppContext(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useAppContext debe usarse dentro de AppProvider");
  return ctx;
}

function useDatosSQLiteYSync() {
  const [listas, setListas] = useState<ListaEntidad[]>([]);
  const [listaActivaId, setListaActivaId] = useState<string | null>(null);
  const [historial, setHistorial] = useState<GiroEntidad[]>([]);
  const [emailUsuario, setEmailUsuario] = useState<string | null>(null);
  const [estadoSync, setEstadoSync] = useState("SQLite local listo");

  const recargarDatosLocales = useCallback(async () => {
    const db = await runMigrations();
    await sembrarListasInicialesSiVacio(db);
    const [listasDb, girosDb, tokens] = await Promise.all([
      listarListasActivas(db),
      listarHistorialGiros(db),
      getSessionTokens(),
    ]);
    setListas(listasDb);
    setHistorial(girosDb);
    setEmailUsuario(tokens.email);
    setListaActivaId((prev) => prev ?? listasDb[0]?.id ?? null);
  }, []);

  useEffect(() => {
    recargarDatosLocales();
  }, [recargarDatosLocales]);

  const sincronizarAhora = useCallback(async () => {
    const db = await runMigrations();
    const res = await sincronizarConApi(db);
    setEstadoSync(res.mensaje);
    await recargarDatosLocales();
  }, [recargarDatosLocales]);

  return {
    listas,
    listaActivaId,
    setListaActivaId,
    historial,
    emailUsuario,
    setEmailUsuario,
    estadoSync,
    setEstadoSync,
    recargarDatosLocales,
    sincronizarAhora,
  };
}

function useAccionesDominio(
  core: ReturnType<typeof useDatosSQLiteYSync>,
  listaActiva: ListaEntidad | null,
  modoEliminacion: ModoEliminacion,
  vozActiva: boolean,
  resetRapidAndEliminated: () => void,
  addEliminatedId: (id: string) => void,
) {
  const guardarLista = useCallback(
    async (id: string | null, nombre: string, opciones: OpcionInput[]) => {
      const targetId = id ?? generarUuidV4();
      await guardarListaConOpciones(await runMigrations(), targetId, nombre, opciones, 1);
      core.setListaActivaId(targetId);
      resetRapidAndEliminated();
      await core.recargarDatosLocales();
      await core.sincronizarAhora();
    },
    [core, resetRapidAndEliminated],
  );
  const borrarLista = useCallback(
    async (id: string) => {
      await eliminarListaLocal(await runMigrations(), id);
      await core.recargarDatosLocales();
      await core.sincronizarAhora();
    },
    [core],
  );
  const borrarGiro = useCallback(
    async (id: string) => {
      await eliminarGiroLocal(await runMigrations(), id);
      await core.recargarDatosLocales();
      await core.sincronizarAhora();
    },
    [core],
  );
  const procesarGanadorGiro = useCallback(
    async (idOpcion: string, textoOpcion: string) => {
      await dispararHapticoGanador();
      if (vozActiva) await leerResultadoEnVozAlta(textoOpcion);
      if (modoEliminacion !== "normal") addEliminatedId(idOpcion);
      if (!listaActiva) return;
      await registrarGiroLocal(await runMigrations(), listaActiva.id, textoOpcion);
      await core.recargarDatosLocales();
      await core.sincronizarAhora();
    },
    [addEliminatedId, core, listaActiva, modoEliminacion, vozActiva],
  );
  return { guardarLista, borrarLista, borrarGiro, procesarGanadorGiro };
}

function useAccionesSesion(core: ReturnType<typeof useDatosSQLiteYSync>) {
  const iniciarSesion = useCallback(
    async (email: string, password: string, esRegistro: boolean) => {
      if (esRegistro) await registrarConApi(email, password);
      else await loginConApi(email, password);
      await core.sincronizarAhora();
    },
    [core],
  );

  const cerrarSesion = useCallback(async () => {
    await clearSessionTokens();
    core.setEmailUsuario(null);
    core.setEstadoSync("Sesión cerrada (modo local SQLite).");
  }, [core]);

  return { iniciarSesion, cerrarSesion };
}

function usePreferencesState() {
  const [opcionesRapidas, setOpcionesRapidas] = useState<OpcionInput[] | null>(null);
  const [modoEliminacion, setModoEliminacion] = useState<ModoEliminacion>("normal");
  const [eliminadasIds, setEliminadasIds] = useState<string[]>([]);
  const [vozActiva, setVozActiva] = useState(true);
  const [shakeActivo, setShakeActivo] = useState(false);
  const [brilloGiroscopioActivo, setBrilloGiroscopioActivo] = useState(false);

  return {
    opcionesRapidas,
    setOpcionesRapidas,
    modoEliminacion,
    setModoEliminacion,
    eliminadasIds,
    setEliminadasIds,
    vozActiva,
    setVozActiva,
    shakeActivo,
    setShakeActivo,
    brilloGiroscopioActivo,
    setBrilloGiroscopioActivo,
  };
}

export function AppProvider({ children }: { children: ReactNode }) {
  const core = useDatosSQLiteYSync();
  const prefs = usePreferencesState();
  const listaActiva =
    core.listas.find((l) => l.id === core.listaActivaId) ?? core.listas[0] ?? null;

  const resetRapid = useCallback(() => {
    prefs.setOpcionesRapidas(null);
    prefs.setEliminadasIds([]);
  }, [prefs]);
  const addElim = useCallback((id: string) => prefs.setEliminadasIds((p) => [...p, id]), [prefs]);

  const dom = useAccionesDominio(
    core,
    listaActiva,
    prefs.modoEliminacion,
    prefs.vozActiva,
    resetRapid,
    addElim,
  );
  const sesion = useAccionesSesion(core);

  return (
    <AppContext.Provider
      value={{
        ...core,
        ...prefs,
        listaActiva,
        seleccionarLista: (id) => {
          core.setListaActivaId(id);
          resetRapid();
        },
        activarModoRapido: (ops) => {
          prefs.setOpcionesRapidas(ops);
          prefs.setEliminadasIds([]);
        },
        reiniciarEliminadas: () => prefs.setEliminadasIds([]),
        ...dom,
        ...sesion,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}
