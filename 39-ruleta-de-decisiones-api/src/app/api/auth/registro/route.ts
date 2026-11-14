import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { checkLoginRateLimit, firebaseSignUp } from "@/lib/auth";
import { handleRouteError, parseJsonBody } from "@/lib/errors";
import { registroSchema } from "@/schemas/auth.schema";

export const runtime = "nodejs";

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const raw = await parseJsonBody(req);
    const input = registroSchema.parse(raw);
    checkLoginRateLimit(`registro:${input.email.toLowerCase()}`);

    const result = await firebaseSignUp(input.email, input.password);
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    return handleRouteError(err);
  }
}
