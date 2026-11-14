import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import type { ApiErrorDetail, ApiErrorResponse } from "@/types/models";

const MAX_BODY_BYTES = 100_000;

export class AppHttpError extends Error {
  public readonly statusCode: number;
  public readonly detalles?: ApiErrorDetail[];

  constructor(statusCode: number, message: string, detalles?: ApiErrorDetail[]) {
    super(message);
    this.name = "AppHttpError";
    this.statusCode = statusCode;
    this.detalles = detalles;
  }
}

export async function parseJsonBody(req: NextRequest): Promise<unknown> {
  const contentType = req.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("application/json")) {
    throw new AppHttpError(415, "Se requiere Content-Type: application/json");
  }

  const rawText = await req.text();
  if (rawText.length > MAX_BODY_BYTES) {
    throw new AppHttpError(413, "El cuerpo de la petición excede el límite");
  }

  try {
    return JSON.parse(rawText);
  } catch {
    throw new AppHttpError(400, "El cuerpo JSON tiene un formato inválido");
  }
}

export function formatZodIssues(zodError: ZodError): ApiErrorDetail[] {
  return zodError.issues.map((issue) => ({
    campo: issue.path.length > 0 ? issue.path.join(".") : "cuerpo",
    mensaje: issue.message,
  }));
}

export function buildErrorResponse(
  statusCode: number,
  error: string,
  detalles?: ApiErrorDetail[],
): NextResponse<ApiErrorResponse> {
  const body: ApiErrorResponse = detalles && detalles.length > 0 ? { error, detalles } : { error };

  return NextResponse.json(body, { status: statusCode });
}

export function handleRouteError(err: unknown): NextResponse<ApiErrorResponse> {
  if (err instanceof AppHttpError) {
    return buildErrorResponse(err.statusCode, err.message, err.detalles);
  }

  if (err instanceof ZodError) {
    const detalles = formatZodIssues(err);
    return buildErrorResponse(400, "Datos de entrada inválidos", detalles);
  }

  return buildErrorResponse(500, "Error interno");
}
