"use client";

import type { ReactNode } from "react";
import { BottomNav } from "./bottom-nav";
import { MobileDrawer } from "./mobile-drawer";

interface Props {
  sidebar: ReactNode;
  topbar: ReactNode;
  children: ReactNode;
}

export function AppShell({ sidebar, topbar, children }: Props) {
  return (
    <div className="bg-background text-foreground min-h-[100dvh]">
      <div className="border-border mx-auto grid max-w-[1400px] grid-cols-1 border-x md:grid-cols-[240px_1fr]">
        <aside className="border-border bg-surface hidden border-r md:sticky md:top-0 md:block md:h-[100dvh] md:self-start md:overflow-y-auto">
          {sidebar}
        </aside>
        <div className="flex min-w-0 flex-col">
          <header className="border-border border-b">{topbar}</header>
          <main className="flex-1 p-4 pb-20 md:p-6 md:pb-6">{children}</main>
        </div>
      </div>
      <BottomNav />
      <MobileDrawer>{sidebar}</MobileDrawer>
    </div>
  );
}
