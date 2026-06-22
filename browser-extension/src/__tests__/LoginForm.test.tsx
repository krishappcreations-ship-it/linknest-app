import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi, describe, it, expect } from "vitest";
import { LoginForm } from "../components/LoginForm";

const noopGoogle = () => vi.fn().mockResolvedValue(null);

describe("LoginForm", () => {
  it("renders Google button plus email, password fields and sign-in button", () => {
    render(
      <LoginForm
        signIn={vi.fn().mockResolvedValue(null)}
        signInWithGoogle={noopGoogle()}
      />
    );
    expect(
      screen.getByRole("button", { name: "Continue with Google" })
    ).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Email")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Password")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign in" })).toBeInTheDocument();
  });

  it("calls signIn with trimmed email and password on submit", async () => {
    const signIn = vi.fn().mockResolvedValue(null);
    const user = userEvent.setup();
    render(<LoginForm signIn={signIn} signInWithGoogle={noopGoogle()} />);
    await user.type(screen.getByPlaceholderText("Email"), "test@example.com");
    await user.type(screen.getByPlaceholderText("Password"), "password123");
    await user.click(screen.getByRole("button", { name: "Sign in" }));
    await waitFor(() =>
      expect(signIn).toHaveBeenCalledWith("test@example.com", "password123")
    );
  });

  it("calls signInWithGoogle when the Google button is clicked", async () => {
    const signInWithGoogle = vi.fn().mockResolvedValue(null);
    const user = userEvent.setup();
    render(
      <LoginForm
        signIn={vi.fn().mockResolvedValue(null)}
        signInWithGoogle={signInWithGoogle}
      />
    );
    await user.click(
      screen.getByRole("button", { name: "Continue with Google" })
    );
    await waitFor(() => expect(signInWithGoogle).toHaveBeenCalledOnce());
  });

  it("shows the Google error string when signInWithGoogle fails", async () => {
    const signInWithGoogle = vi.fn().mockResolvedValue("Sign-in cancelled");
    const user = userEvent.setup();
    render(
      <LoginForm
        signIn={vi.fn().mockResolvedValue(null)}
        signInWithGoogle={signInWithGoogle}
      />
    );
    await user.click(
      screen.getByRole("button", { name: "Continue with Google" })
    );
    await waitFor(() =>
      expect(screen.getByText("Sign-in cancelled")).toBeInTheDocument()
    );
  });

  it("shows error message when signIn returns an error string", async () => {
    const signIn = vi.fn().mockResolvedValue("Invalid login credentials");
    const user = userEvent.setup();
    render(<LoginForm signIn={signIn} signInWithGoogle={noopGoogle()} />);
    await user.type(screen.getByPlaceholderText("Email"), "bad@x.com");
    await user.type(screen.getByPlaceholderText("Password"), "wrong");
    await user.click(screen.getByRole("button", { name: "Sign in" }));
    await waitFor(() =>
      expect(screen.getByText("Invalid email or password")).toBeInTheDocument()
    );
  });

  it("disables button while signing in", async () => {
    const signIn = vi.fn().mockReturnValue(new Promise(() => {}));
    const user = userEvent.setup();
    render(<LoginForm signIn={signIn} signInWithGoogle={noopGoogle()} />);
    await user.type(screen.getByPlaceholderText("Email"), "a@b.com");
    await user.type(screen.getByPlaceholderText("Password"), "pw");
    await user.click(screen.getByRole("button", { name: "Sign in" }));
    expect(screen.getByRole("button", { name: "Signing in…" })).toBeDisabled();
  });
});
