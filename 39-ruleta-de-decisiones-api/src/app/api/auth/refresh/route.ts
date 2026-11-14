import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { firebaseRefreshIdToken } from "@/lib/auth";
import { handleRouteError, parseJsonBody } from "@/lib/errors";
import { refreshSchema } from "@/schemas/auth.schema";

export const runtime = "nodejs";

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const raw = await parseJsonBody(req);
    const input = refreshSchema.parse(raw);

    const result = await firebaseRefreshIdToken(input.refreshToken);
    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    return handleRouteError(err);
  }
}
