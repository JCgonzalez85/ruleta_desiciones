import {
  calcularOffsetBrilloGiroscopio,
  evaluarSacudida,
  type BrilloOffset,
} from "@/sensors/sensorMath";

export interface SensorSubscription {
  remove(): void;
}

export async function dispararTicHapticoSector(): Promise<boolean> {
  try {
    const haptics = await import("expo-haptics");
    await haptics.selectionAsync();
    return true;
  } catch {
    return false;
  }
}

export async function dispararHapticoGanador(): Promise<boolean> {
  try {
    const haptics = await import("expo-haptics");
    await haptics.notificationAsync(haptics.NotificationFeedbackType.Success);
    return true;
  } catch {
    return false;
  }
}

export async function leerResultadoEnVozAlta(texto: string): Promise<boolean> {
  try {
    const speech = await import("expo-speech");
    speech.stop();
    speech.speak(`La decisión es: ${texto}`, {
      language: "es-CO",
      rate: 1.0,
    });
    return true;
  } catch {
    return false;
  }
}

export async function iniciarSuscripcionSacudida(
  onShake: () => void,
): Promise<{ disponible: boolean; subscription: SensorSubscription | null }> {
  try {
    const { Accelerometer } = await import("expo-sensors");
    const disponible = await Accelerometer.isAvailableAsync();
    if (!disponible) {
      return { disponible: false, subscription: null };
    }
    const perm = await Accelerometer.requestPermissionsAsync();
    if (perm.status !== "granted") {
      return { disponible: false, subscription: null };
    }

    Accelerometer.setUpdateInterval(100);
    let ultimoMs = 0;
    const subscription = Accelerometer.addListener((muestra) => {
      const evalRes = evaluarSacudida(muestra, ultimoMs, Date.now());
      if (evalRes.disparar) {
        ultimoMs = evalRes.nuevoUltimoDisparoMs;
        onShake();
      }
    });
    return { disponible: true, subscription };
  } catch {
    return { disponible: false, subscription: null };
  }
}

export async function iniciarSuscripcionBrilloGiroscopio(
  onTiltChange: (offset: BrilloOffset) => void,
): Promise<{ disponible: boolean; subscription: SensorSubscription | null }> {
  try {
    const { Gyroscope } = await import("expo-sensors");
    const disponible = await Gyroscope.isAvailableAsync();
    if (!disponible) {
      return { disponible: false, subscription: null };
    }
    const perm = await Gyroscope.requestPermissionsAsync();
    if (perm.status !== "granted") {
      return { disponible: false, subscription: null };
    }

    Gyroscope.setUpdateInterval(120);
    const subscription = Gyroscope.addListener((muestra) => {
      onTiltChange(calcularOffsetBrilloGiroscopio(muestra));
    });
    return { disponible: true, subscription };
  } catch {
    return { disponible: false, subscription: null };
  }
}
