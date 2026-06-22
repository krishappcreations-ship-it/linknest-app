import { NextResponse } from "next/server";
import { z } from "zod";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import Anthropic from "@anthropic-ai/sdk";
import { checkRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RequestSchema = z.object({
  text: z.string().min(1).max(200_000),
  title: z.string().max(500).optional().nullable(),
});

const ResponseSchema = z.object({
  tldr: z.string().min(1),
  keyPoints: z.array(z.string().min(1)).min(1).max(6),
});

type SummarizeResponse =
  | { ok: true; tldr: string; keyPoints: string[] }
  | {
      ok: false;
      error:
        | "unauthorized"
        | "bad_request"
        | "ai_error"
        | "config"
        | "rate_limited";
    };

const SUMMARIZE_LIMIT = { windowMs: 60_000, max: 10 };
const UNAUTHORIZED: SummarizeResponse = { ok: false, error: "unauthorized" };
const RATE_LIMITED: SummarizeResponse = { ok: false, error: "rate_limited" };
const BAD_REQUEST: SummarizeResponse = { ok: false, error: "bad_request" };
const AI_ERROR: SummarizeResponse = { ok: false, error: "ai_error" };
const CONFIG_ERROR: SummarizeResponse = { ok: false, error: "config" };

const MAX_INPUT_CHARS = 12_000;

export async function POST(
  req: Request
): Promise<NextResponse<SummarizeResponse>> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json(CONFIG_ERROR, { status: 500 });
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnon)
    return NextResponse.json(CONFIG_ERROR, { status: 500 });

  const cookieStore = await cookies();
  const supabase = createServerClient(supabaseUrl, supabaseAnon, {
    cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} },
  });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json(UNAUTHORIZED, { status: 401 });

  const rl = checkRateLimit(`summarize:${user.id}`, SUMMARIZE_LIMIT);
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
  if (!parsed.success) return NextResponse.json(BAD_REQUEST, { status: 400 });

  const text = parsed.data.text.slice(0, MAX_INPUT_CHARS);
  const anthropic = new Anthropic({ apiKey });
  try {
    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 400,
      messages: [
        { role: "user", content: buildPrompt(text, parsed.data.title ?? null) },
      ],
    });
    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text")
      return NextResponse.json(AI_ERROR, { status: 502 });
    const json = extractJson(textBlock.text);
    if (!json) return NextResponse.json(AI_ERROR, { status: 502 });
    const validated = ResponseSchema.safeParse(json);
    if (!validated.success) return NextResponse.json(AI_ERROR, { status: 502 });
    return NextResponse.json({
      ok: true,
      tldr: validated.data.tldr,
      keyPoints: validated.data.keyPoints,
    });
  } catch (err) {
    console.warn("[summarize] anthropic error", err);
    return NextResponse.json(AI_ERROR, { status: 502 });
  }
}

function buildPrompt(text: string, title: string | null): string {
  return `Summarize this article. Respond with JSON only, no prose.

Title: ${title ?? "(none)"}

Article:
${text}

Respond:
{ "tldr": "one or two sentence summary", "keyPoints": ["point", "point", "point"] }

Rules:
- tldr: 1-2 sentences, plain language
- keyPoints: 3-5 concise takeaways
- JSON only`;
}

function extractJson(text: string): unknown {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]);
  } catch {
    return null;
  }
}
