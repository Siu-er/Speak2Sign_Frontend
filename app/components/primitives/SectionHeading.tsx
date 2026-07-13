import React from "react";

interface Props {
  eyebrow?: string;
  title?: string;
  description?: string;
  trailing?: React.ReactNode;
  className?: string;
}

export function SectionHeading({ eyebrow, title, description, trailing, className = "" }: Props) {
  return (
    <div className={className}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {eyebrow && <p className="s2s-eyebrow mb-2">{eyebrow}</p>}
          {title && (
            <h2 className="s2s-heading text-[34px] leading-tight">{title}</h2>
          )}
          {description && (
            <p className="mt-2 text-muted-foreground text-sm leading-relaxed">
              {description}
            </p>
          )}
        </div>
        {trailing}
      </div>
    </div>
  );
}
