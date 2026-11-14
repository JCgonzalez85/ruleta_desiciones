import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { verifyBearerToken } from "@/lib/auth";
import { AppHttpError, handleRouteError } from "@/lib/errors";
import { getGiroStatsForLista } from "@/lib/sync-service";
import { resourceIdSchema } from "@/schemas/lista.schema";

export const runtime = "nodejs";

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const usuario = await verifyBearerToken(req);
    const rawLista = req.nextUrl.searchParams.get("lista");
    if (!rawLista) {
      throw new AppHttpError(400, "El parámetro lista es obligatorio", [
        { campo: "lista", mensaje: "Debe especificar el id de la lista" },
      ]);
    }

    const listaId = resourceIdSchema.parse(rawLista);
    const stats = await getGiroStatsForLista(usuario.id, listaId);
    return NextResponse.json(stats, { status: 200 });
  } catch (err) {
    return handleRouteError(err);
  }
}
