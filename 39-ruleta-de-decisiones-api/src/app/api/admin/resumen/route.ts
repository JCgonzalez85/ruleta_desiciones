import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { handleRouteError } from "@/lib/errors";

export const runtime = "nodejs";

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const admin = await requireAdmin(req);
    return NextResponse.json(
      {
        ok: true,
        admin_id: admin.id,
        servidor_ahora: new Date().toISOString(),
      },
      { status: 200 },
    );
  } catch (err) {
    return handleRouteError(err);
  }
}
