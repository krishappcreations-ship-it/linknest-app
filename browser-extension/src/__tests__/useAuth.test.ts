import { renderHook, act, waitFor } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach } from "vitest";

const {
  mockGetSession,
  mockSignInWithPassword,
  mockSignInWithOAuth,
  mockExchangeCode,
  mockSignOut,
} = vi.hoisted(() => ({
  mockGetSession: vi.fn(),
  mockSignInWithPassword: vi.fn(),
  mockSignInWithOAuth: vi.fn(),
  mockExchangeCode: vi.fn(),
  mockSignOut: vi.fn(),
}));

vi.mock("../lib/supabase", () => ({
  supabase: {
    auth: {
      getSession: mockGetSession,
      signInWithPassword: mockSignInWithPassword,
      signInWithOAuth: mockSignInWithOAuth,
      exchangeCodeForSession: mockExchangeCode,
      signOut: mockSignOut,
    },
  },
}));

import { useAuth } from "../hooks/useAuth";

describe("useAuth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (chrome.storage.local.clear as ReturnType<typeof vi.fn>).mockResolvedValue(
      undefined
    );
  });

  it("starts in loading state", () => {
    mockGetSession.mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() => useAuth());
    expect(result.current.state.status).toBe("loading");
  });

  it("transitions to unauthenticated when no session", async () => {
    mockGetSession.mockResolvedValueOnce({ data: { session: null } });
    const { result } = renderHook(() => useAuth());
    await waitFor(() =>
      expect(result.current.state.status).toBe("unauthenticated")
    );
  });

  it("transitions to authenticated when session present", async () => {
    mockGetSession.mockResolvedValueOnce({
      data: { session: { user: { id: "user-123" } } },
    });
    const { result } = renderHook(() => useAuth());
    await waitFor(() => {
      expect(result.current.state.status).toBe("authenticated");
      if (result.current.state.status === "authenticated") {
        expect(result.current.state.userId).toBe("user-123");
      }
    });
  });

  it("signIn returns null on success and sets authenticated", async () => {
    mockGetSession.mockResolvedValueOnce({ data: { session: null } });
    mockSignInWithPassword.mockResolvedValueOnce({
      data: { user: { id: "user-456" } },
      error: null,
    });
    const { result } = renderHook(() => useAuth());
    await waitFor(() =>
      expect(result.current.state.status).toBe("unauthenticated")
    );
    let err: string | null = "not-called";
    await act(async () => {
      err = await result.current.signIn("a@b.com", "pw");
    });
    expect(err).toBeNull();
    expect(result.current.state.status).toBe("authenticated");
  });

  it("signIn returns error message on failure", async () => {
    mockGetSession.mockResolvedValueOnce({ data: { session: null } });
    mockSignInWithPassword.mockResolvedValueOnce({
      data: { user: null },
      error: { message: "Invalid login credentials" },
    });
    const { result } = renderHook(() => useAuth());
    await waitFor(() =>
      expect(result.current.state.status).toBe("unauthenticated")
    );
    let err: string | null = null;
    await act(async () => {
      err = await result.current.signIn("bad@x.com", "wrong");
    });
    expect(err).toBe("Invalid login credentials");
    expect(result.current.state.status).toBe("unauthenticated");
  });

  it("signInWithGoogle delegates to the background worker and authenticates", async () => {
    mockGetSession.mockResolvedValueOnce({ data: { session: null } });
    (
      chrome.runtime.sendMessage as ReturnType<typeof vi.fn>
    ).mockResolvedValueOnce({ userId: "user-789" });

    const { result } = renderHook(() => useAuth());
    await waitFor(() =>
      expect(result.current.state.status).toBe("unauthenticated")
    );
    let err: string | null = "not-called";
    await act(async () => {
      err = await result.current.signInWithGoogle();
    });
    expect(err).toBeNull();
    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
      type: "google-signin",
    });
    expect(result.current.state.status).toBe("authenticated");
  });

  it("signInWithGoogle returns an error when the worker reports failure", async () => {
    mockGetSession.mockResolvedValueOnce({ data: { session: null } });
    (
      chrome.runtime.sendMessage as ReturnType<typeof vi.fn>
    ).mockResolvedValueOnce({ error: "Sign-in cancelled" });

    const { result } = renderHook(() => useAuth());
    await waitFor(() =>
      expect(result.current.state.status).toBe("unauthenticated")
    );
    let err: string | null = null;
    await act(async () => {
      err = await result.current.signInWithGoogle();
    });
    expect(err).toBe("Sign-in cancelled");
    expect(result.current.state.status).toBe("unauthenticated");
  });

  it("signOut clears chrome storage and sets unauthenticated", async () => {
    mockGetSession.mockResolvedValueOnce({
      data: { session: { user: { id: "user-123" } } },
    });
    mockSignOut.mockResolvedValueOnce({});
    const { result } = renderHook(() => useAuth());
    await waitFor(() =>
      expect(result.current.state.status).toBe("authenticated")
    );
    await act(async () => {
      await result.current.signOut();
    });
    expect(chrome.storage.local.clear).toHaveBeenCalledOnce();
    expect(result.current.state.status).toBe("unauthenticated");
  });
});
