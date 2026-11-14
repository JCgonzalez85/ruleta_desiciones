import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { verifyBearerToken } from "@/lib/auth";
import { handleRouteError } from "@/lib/errors";

export const runtime = "nodejs";

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const usuario = await verifyBearerToken(req);
    return NextResponse.json({ usuario }, { status: 200 });
  } catch (err) {
    return handleRouteError(err);
  }
}
