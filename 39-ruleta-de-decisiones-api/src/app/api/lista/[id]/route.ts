import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { verifyBearerToken } from "@/lib/auth";
import { handleRouteError, parseJsonBody } from "@/lib/errors";
import { softDeleteResource, upsertLista } from "@/lib/sync-service";
import { listaPutSchema, resourceIdSchema } from "@/schemas/lista.schema";

export const runtime = "nodejs";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function PUT(req: NextRequest, context: RouteContext): Promise<NextResponse> {
  try {
    const usuario = await verifyBearerToken(req);
    const { id: rawId } = await context.params;
    const id = resourceIdSchema.parse(rawId);
    const rawBody = await parseJsonBody(req);
    const input = listaPutSchema.parse(rawBody);

    const doc = await upsertLista(usuario.id, id, input);
    return NextResponse.json(doc, { status: 200 });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function DELETE(req: NextRequest, context: RouteContext): Promise<NextResponse> {
  try {
    const usuario = await verifyBearerToken(req);
    const { id: rawId } = await context.params;
    const id = resourceIdSchema.parse(rawId);

    const result = await softDeleteResource(usuario.id, "lista", id);
    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    return handleRouteError(err);
  }
}
