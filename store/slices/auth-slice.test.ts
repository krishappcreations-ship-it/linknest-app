import { describe, expect, it } from "vitest";
import { initialAuthState, setSession, setStatus } from "./auth-slice";

describe("auth-slice", () => {
  it("initial state is anon", () => {
    expect(initialAuthState.userId).toBeNull();
    expect(initialAuthState.email).toBeNull();
    expect(initialAuthState.avatarUrl).toBeNull();
    expect(initialAuthState.status).toBe("anon");
  });

  it("setSession with payload transitions to signed-in", () => {
    const next = setSession(initialAuthState, {
      userId: "user-123",
      email: "ada@example.com",
      avatarUrl: "https://x/avatar.png",
    });
    expect(next.userId).toBe("user-123");
    expect(next.email).toBe("ada@example.com");
    expect(next.avatarUrl).toBe("https://x/avatar.png");
    expect(next.status).toBe("signed-in");
  });

  it("setSession populates email + avatarUrl null when absent (magic-link user)", () => {
    const next = setSession(initialAuthState, {
      userId: "user-123",
      email: "ada@example.com",
      avatarUrl: null,
    });
    expect(next.email).toBe("ada@example.com");
    expect(next.avatarUrl).toBeNull();
    expect(next.status).toBe("signed-in");
  });

  it("setSession with null clears all session fields", () => {
    const signedIn = setSession(initialAuthState, {
      userId: "user-123",
      email: "ada@example.com",
      avatarUrl: "https://x/avatar.png",
    });
    const next = setSession(signedIn, null);
    expect(next.userId).toBeNull();
    expect(next.email).toBeNull();
    expect(next.avatarUrl).toBeNull();
    expect(next.status).toBe("anon");
  });

  it("setStatus preserves userId + email + avatarUrl", () => {
    const signedIn = setSession(initialAuthState, {
      userId: "user-123",
      email: "ada@example.com",
      avatarUrl: "https://x/avatar.png",
    });
    const syncing = setStatus(signedIn, "syncing");
    expect(syncing.status).toBe("syncing");
    expect(syncing.userId).toBe("user-123");
    expect(syncing.email).toBe("ada@example.com");
    expect(syncing.avatarUrl).toBe("https://x/avatar.png");
  });
});
