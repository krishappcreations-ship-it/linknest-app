import { NextResponse } from "next/server";
import { z } from "zod";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import Anthropic from "@anthropic-ai/sdk";
import { checkRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RequestSchema = z.object({
  url: z.string().url().max(2048),
  title: z.string().max(500).optional().nullable(),
  description: z.string().max(2000).optional().nullable(),
  existingTags: z.array(z.string().max(80)).max(200).optional().default([]),
});

const SuggestionSchema = z.object({
  name: z.string().min(1).max(80),
  kind: z.enum(["existing", "new"]),
});

const ResponseSchema = z.object({
  suggestions: z.array(SuggestionSchema).max(3),
});

type SuggestTagsResponse =
  | { ok: true; suggestions: { name: string; kind: "existing" | "new" }[] }
  | {
      ok: false;
      error:
        | "unauthorized"
        | "bad_request"
        | "ai_error"
        | "config"
        | "rate_limited";
    };

const SUGGEST_LIMIT = { windowMs: 60_000, max: 10 };

const UNAUTHORIZED: SuggestTagsResponse = { ok: false, error: "unauthorized" };
const RATE_LIMITED: SuggestTagsResponse = { ok: false, error: "rate_limited" };
const BAD_REQUEST: SuggestTagsResponse = { ok: false, error: "bad_request" };
const AI_ERROR: SuggestTagsResponse = { ok: false, error: "ai_error" };
const CONFIG_ERROR: SuggestTagsResponse = { ok: false, error: "config" };

export async function POST(
  req: Request
): Promise<NextResponse<SuggestTagsResponse>> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json(CONFIG_ERROR, { status: 500 });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnon) {
    return NextResponse.json(CONFIG_ERROR, { status: 500 });
  }

  const cookieStore = await cookies();
  const supabase = createServerClient(supabaseUrl, supabaseAnon, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: () => {
        // route handler — cookies are read-only here
      },
    },
  });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json(UNAUTHORIZED, { status: 401 });

  const rl = checkRateLimit(`suggest-tags:${user.id}`, SUGGEST_LIMIT);
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

  const { url, title, description, existingTags } = parsed.data;

  const anthropic = new Anthropic({ apiKey });
  try {
    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 200,
      messages: [
        {
          role: "user",
          content: buildPrompt({ url, title, description, existingTags }),
        },
      ],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return NextResponse.json(AI_ERROR, { status: 502 });
    }
    const json = extractJson(textBlock.text);
    if (!json) return NextResponse.json(AI_ERROR, { status: 502 });

    const validated = ResponseSchema.safeParse(json);
    if (!validated.success) return NextResponse.json(AI_ERROR, { status: 502 });

    const existingSet = new Set(existingTags.map((t) => t.toLowerCase()));
    const normalized = validated.data.suggestions.map((s) => ({
      name: s.name.trim(),
      kind: existingSet.has(s.name.trim().toLowerCase())
        ? ("existing" as const)
        : ("new" as const),
    }));

    return NextResponse.json({ ok: true, suggestions: normalized });
  } catch (err) {
    console.warn("[suggest-tags] anthropic error", err);
    return NextResponse.json(AI_ERROR, { status: 502 });
  }
}

function buildPrompt(args: {
  url: string;
  title?: string | null;
  description?: string | null;
  existingTags: string[];
}): string {
  const { url, title, description, existingTags } = args;
  return `Suggest up to 3 tags for this bookmark. Prefer reusing existing tags when applicable.

URL: ${url}
Title: ${title ?? "(none)"}
Description: ${description ?? "(none)"}

User's existing tags: ${existingTags.length > 0 ? existingTags.join(", ") : "(none)"}

Respond with JSON only, no prose:
{
  "suggestions": [
    { "name": "string", "kind": "existing" | "new" }
  ]
}

Rules:
- Tag names: lowercase, 1-3 words, no punctuation
- "kind": "existing" if name exactly matches one of user's existing tags (case-insensitive); "new" otherwise
- 1-3 suggestions
- Empty array if URL gives no signal`;
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
