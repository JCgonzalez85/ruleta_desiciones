import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { checkLoginRateLimit, firebaseSignIn } from "@/lib/auth";
import { handleRouteError, parseJsonBody } from "@/lib/errors";
import { loginSchema } from "@/schemas/auth.schema";

export const runtime = "nodejs";

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const raw = await parseJsonBody(req);
    const input = loginSchema.parse(raw);
    checkLoginRateLimit(`login:${input.email.toLowerCase()}`);

    const result = await firebaseSignIn(input.email, input.password);
    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    return handleRouteError(err);
  }
}
