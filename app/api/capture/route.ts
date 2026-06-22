import { NextResponse } from "next/server";
import { z } from "zod";
import { fetchArticle } from "@/lib/capture/fetch-article";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import type { CaptureResponse } from "@/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RequestSchema = z.object({
  url: z.string().url().max(2048),
});

const CAPTURE_LIMIT = { windowMs: 60_000, max: 10 };

const BAD_REQUEST: CaptureResponse = {
  ok: false,
  kind: "http_error",
  retriable: false,
};

const RATE_LIMITED: CaptureResponse = {
  ok: false,
  kind: "http_error",
  retriable: true,
};

export async function POST(
  req: Request
): Promise<NextResponse<CaptureResponse>> {
  const ip = getClientIp(req);
  const rl = checkRateLimit(`capture:${ip}`, CAPTURE_LIMIT);
  if (!rl.ok) {
    return NextResponse.json(RATE_LIMITED, {
      status: 429,
      headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) },
    });
  }

  let body: unknown = null;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(BAD_REQUEST, { status: 400 });
  }
  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(BAD_REQUEST, { status: 400 });
  }
  const result = await fetchArticle(parsed.data.url);
  return NextResponse.json(result, { status: 200 });
}
