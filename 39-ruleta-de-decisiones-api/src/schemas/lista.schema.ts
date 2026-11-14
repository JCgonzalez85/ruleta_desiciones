import { z } from "zod";
import type { OpcionItem } from "@/types/models";

export function hasNoDuplicateOptions(opciones: OpcionItem[]): boolean {
  const seen = new Set<string>();
  for (const op of opciones) {
    const normalized = op.texto.trim().toLocaleLowerCase("es");
    if (seen.has(normalized)) {
      return false;
    }
    seen.add(normalized);
  }
  return true;
}

export const opcionSchema = z.object({
  texto: z
    .string()
    .trim()
    .min(1, "El texto de la opción no puede estar vacío")
    .max(30, "El texto de la opción debe tener máximo 30 caracteres"),
  peso: z
    .number()
    .int("El peso debe ser un número entero")
    .min(1, "El peso mínimo permitido es 1")
    .max(10, "El peso máximo permitido es 10")
    .default(1),
});

export const listaPutSchema = z.object({
  nombre: z
    .string()
    .trim()
    .min(1, "El nombre de la lista es obligatorio")
    .max(50, "El nombre de la lista debe tener máximo 50 caracteres"),
  opciones: z
    .array(opcionSchema)
    .min(2, "La lista debe contener entre 2 y 12 opciones")
    .max(12, "La lista debe contener entre 2 y 12 opciones")
    .refine(hasNoDuplicateOptions, {
      message: "No se permiten opciones duplicadas en la misma lista",
    }),
});

export const resourceIdSchema = z
  .string()
  .trim()
  .min(1, "El identificador del recurso es obligatorio")
  .max(64, "El identificador del recurso no puede superar 64 caracteres")
  .regex(/^[a-zA-Z0-9_-]+$/, "El identificador contiene caracteres inválidos");

export type ListaPutInput = z.infer<typeof listaPutSchema>;
