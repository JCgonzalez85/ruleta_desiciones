import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(): Promise<NextResponse> {
  return NextResponse.json(
    {
      ok: true,
      servicio: "39-ruleta-de-decisiones-api",
      estado: "activo",
      servidor_ahora: new Date().toISOString(),
    },
    { status: 200 },
  );
}
