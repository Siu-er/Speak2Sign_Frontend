import React from "react";
import { BottomNav } from "@/app/components/shell/BottomNav";

interface Props {
  children: React.ReactNode;
  showNav?: boolean;
  className?: string;
}

export function AppShell({ children, showNav = true, className = "" }: Props) {
  return (
    <div className="s2s-shell flex flex-col">
      <div className={`flex-1 flex flex-col ${className}`}>
        {children}
      </div>
      {showNav && <BottomNav />}
    </div>
  );
}
