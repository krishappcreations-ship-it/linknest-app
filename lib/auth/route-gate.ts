/**
 * Pure routing-gate decision for the marketing landing page.
 *
 * Anonymous visitors to `/` are shown the landing page (served via rewrite to
 * `/welcome`, so the URL stays canonical `/`). Authenticated users get the app
 * at `/` unchanged, and never see `/welcome` (redirected back to the app).
 *
 * Kept pure + side-effect free so it is unit-testable in isolation; the edge
 * runtime wiring (Supabase cookie read) lives in `proxy.ts`.
 */

export type GateDecision =
  | { action: "next" }
  | { action: "rewrite"; to: string }
  | { action: "redirect"; to: string };

export function decideGate(
  hasSession: boolean,
  pathname: string
): GateDecision {
  if (pathname === "/") {
    return hasSession
      ? { action: "next" }
      : { action: "rewrite", to: "/welcome" };
  }
  if (pathname === "/welcome") {
    return hasSession ? { action: "redirect", to: "/" } : { action: "next" };
  }
  return { action: "next" };
}
