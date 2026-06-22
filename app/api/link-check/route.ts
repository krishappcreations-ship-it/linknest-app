import { NextResponse } from "next/server";
import { z } from "zod";
import { checkLink, type LinkCheckResult } from "@/lib/link/check-link";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RequestSchema = z.object({ url: z.string().url().max(2048) });
const LIMIT = { windowMs: 60_000, max: 60 };

export async function POST(
  req: Request
): Promise<NextResponse<LinkCheckResult>> {
  const ip = getClientIp(req);
  const rl = checkRateLimit(`link-check:${ip}`, LIMIT);
  if (!rl.ok) {
    return NextResponse.json(
      { status: "unknown" },
      {
        status: 429,
        headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) },
      }
    );
  }
  let body: unknown = null;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ status: "unknown" }, { status: 400 });
  }
  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ status: "unknown" }, { status: 400 });
  }
  const result = await checkLink(parsed.data.url);
  return NextResponse.json(result, { status: 200 });
}
