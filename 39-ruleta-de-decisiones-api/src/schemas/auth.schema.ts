import { z } from "zod";

export const registroSchema = z.object({
  email: z.string().trim().email("El formato del correo electrónico no es válido"),
  password: z
    .string()
    .min(8, "La contraseña debe tener al menos 8 caracteres")
    .max(128, "La contraseña no puede superar 128 caracteres"),
});

export const loginSchema = z.object({
  email: z.string().trim().email("El formato del correo electrónico no es válido"),
  password: z.string().min(1, "La contraseña es obligatoria"),
});

export const refreshSchema = z.object({
  refreshToken: z.string().trim().min(1, "El refreshToken es obligatorio"),
});

export type RegistroInput = z.infer<typeof registroSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type RefreshInput = z.infer<typeof refreshSchema>;
