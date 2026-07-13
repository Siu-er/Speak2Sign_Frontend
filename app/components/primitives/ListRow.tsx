"use client";

import React from "react";
import { ChevronRight } from "lucide-react";

interface ListRowProps {
  icon?: React.ReactNode;
  label: string;
  value?: string;
  trailing?: React.ReactNode;
  onClick?: () => void;
  asCard?: boolean;
  hideChevron?: boolean;
}

export function ListRow({
  icon,
  label,
  value,
  trailing,
  onClick,
  asCard = false,
  hideChevron = false,
}: ListRowProps) {
  return (
    <button
      onClick={onClick}
      className={[
        "w-full flex items-center gap-3 px-4 py-3.5 text-left transition-colors",
        asCard ? "s2s-card hover:bg-primary-soft/30" : "hover:bg-primary-soft/30",
      ].join(" ")}
    >
      {icon && (
        <div className="w-9 h-9 rounded-full bg-primary-soft text-primary grid place-items-center shrink-0">
          {icon}
        </div>
      )}
      <div className="flex-1 min-w-0">
        {value ? (
          <>
            <p className="text-[12px] text-muted-foreground">{label}</p>
            <p className="text-sm font-semibold text-foreground truncate">{value}</p>
          </>
        ) : (
          <p className="text-sm font-semibold text-foreground truncate">{label}</p>
        )}
      </div>
      {trailing ?? (!hideChevron && <ChevronRight className="w-4 h-4 text-muted-foreground" />)}
    </button>
  );
}

export function ListGroup({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`s2s-card overflow-hidden divide-y divide-border ${className}`}>{children}</div>;
}
