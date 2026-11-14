import { z } from "zod";

export const giroPutSchema = z.object({
  lista_id: z
    .string()
    .trim()
    .min(1, "El campo lista_id es obligatorio")
    .max(64, "El campo lista_id no puede superar 64 caracteres"),
  resultado: z
    .string()
    .trim()
    .min(1, "El resultado del giro es obligatorio")
    .max(30, "El resultado debe tener máximo 30 caracteres"),
  girado_en: z.iso.datetime({
    message: "El campo girado_en debe estar en formato ISO 8601 UTC",
  }),
});

export const sinceQuerySchema = z.iso
  .datetime({
    message: "El parámetro since debe estar en formato ISO 8601 UTC",
  })
  .optional();

export type GiroPutInput = z.infer<typeof giroPutSchema>;
