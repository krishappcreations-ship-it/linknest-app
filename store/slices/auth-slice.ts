export interface AuthState {
  userId: string | null;
  email: string | null;
  avatarUrl: string | null;
  status: "anon" | "signing-in" | "signed-in" | "syncing";
}

export const initialAuthState: AuthState = {
  userId: null,
  email: null,
  avatarUrl: null,
  status: "anon",
};

export function setSession(
  s: AuthState,
  payload: {
    userId: string;
    email: string | null;
    avatarUrl: string | null;
  } | null
): AuthState {
  if (!payload) {
    return {
      userId: null,
      email: null,
      avatarUrl: null,
      status: "anon",
    };
  }
  return {
    userId: payload.userId,
    email: payload.email,
    avatarUrl: payload.avatarUrl,
    status: "signed-in",
  };
}

export function setStatus(
  s: AuthState,
  status: AuthState["status"]
): AuthState {
  return { ...s, status };
}
