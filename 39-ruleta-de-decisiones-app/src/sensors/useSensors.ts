import { useEffect, useState } from "react";
import {
  iniciarSuscripcionBrilloGiroscopio,
  iniciarSuscripcionSacudida,
  type SensorSubscription,
} from "@/sensors/deviceCapabilities";
import type { BrilloOffset } from "@/sensors/sensorMath";

export function useShakeToSpin(enabled: boolean, onShake: () => void): boolean {
  const [disponible, setDisponible] = useState(false);

  useEffect(() => {
    if (!enabled) {
      setDisponible(false);
      return undefined;
    }

    let activa: SensorSubscription | null = null;
    let cancelado = false;

    iniciarSuscripcionSacudida(() => {
      if (!cancelado) {
        onShake();
      }
    }).then((res) => {
      if (cancelado) {
        res.subscription?.remove();
        return;
      }
      setDisponible(res.disponible);
      activa = res.subscription;
    });

    return () => {
      cancelado = true;
      activa?.remove();
    };
  }, [enabled, onShake]);

  return disponible;
}

export function useGyroTiltShine(enabled: boolean): BrilloOffset {
  const [offset, setOffset] = useState<BrilloOffset>({ dx: 0, dy: 0 });

  useEffect(() => {
    if (!enabled) {
      setOffset({ dx: 0, dy: 0 });
      return undefined;
    }

    let activa: SensorSubscription | null = null;
    let cancelado = false;

    iniciarSuscripcionBrilloGiroscopio((nuevoOffset) => {
      if (!cancelado) {
        setOffset(nuevoOffset);
      }
    }).then((res) => {
      if (cancelado) {
        res.subscription?.remove();
        return;
      }
      activa = res.subscription;
    });

    return () => {
      cancelado = true;
      activa?.remove();
    };
  }, [enabled]);

  return offset;
}
