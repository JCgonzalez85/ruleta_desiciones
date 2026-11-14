import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { verifyBearerToken } from "@/lib/auth";
import { handleRouteError } from "@/lib/errors";
import { listSyncResources } from "@/lib/sync-service";
import { sinceQuerySchema } from "@/schemas/giro.schema";
import type { ListaDocument } from "@/types/models";

export const runtime = "nodejs";

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const usuario = await verifyBearerToken(req);
    const rawSince = req.nextUrl.searchParams.get("since") ?? undefined;
    const since = sinceQuerySchema.parse(rawSince);

    const data = await listSyncResources<ListaDocument>(usuario.id, "lista", since);
    return NextResponse.json(data, { status: 200 });
  } catch (err) {
    return handleRouteError(err);
  }
}
