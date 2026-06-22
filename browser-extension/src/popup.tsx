import { StrictMode, useState, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { useAuth } from "./hooks/useAuth";
import { LoginForm } from "./components/LoginForm";
import { SaveForm } from "./components/SaveForm";
import "./styles/popup.css";

interface TabInfo {
  url: string;
  title: string;
}

function Header({ signOut }: { signOut: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <header className="popup-header">
      <span className="popup-wordmark">LinkNest</span>
      <div className="popup-menu-wrap">
        <button
          className="gear-btn"
          onClick={() => setOpen(!open)}
          aria-label="Settings"
        >
          ⚙
        </button>
        {open && (
          <div className="gear-menu">
            <button
              onClick={() => {
                setOpen(false);
                signOut();
              }}
            >
              Sign out
            </button>
          </div>
        )}
      </div>
    </header>
  );
}

function Popup() {
  const { state, signIn, signInWithGoogle, signOut } = useAuth();
  const [tab, setTab] = useState<TabInfo | null>(null);

  useEffect(() => {
    chrome.tabs.query({ active: true, currentWindow: true }, ([t]) => {
      if (t?.url && t?.title) setTab({ url: t.url, title: t.title });
    });
  }, []);

  return (
    <>
      <Header signOut={signOut} />
      {state.status === "loading" && (
        <div className="popup-loading">Loading…</div>
      )}
      {state.status === "unauthenticated" && (
        <LoginForm signIn={signIn} signInWithGoogle={signInWithGoogle} />
      )}
      {state.status === "authenticated" &&
        (tab ? (
          <SaveForm userId={state.userId} tab={tab} />
        ) : (
          <div className="popup-loading">Reading tab…</div>
        ))}
    </>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Popup />
  </StrictMode>
);
