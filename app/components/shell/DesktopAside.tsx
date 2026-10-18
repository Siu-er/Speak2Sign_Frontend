"use client";

import React, { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import { S2SLogo } from "@/app/components/shell/S2SLogo";

/**
 * Large-screen companion to the framed app: the brand, what S2S does, and a QR
 * code that opens the same page on a phone. Hidden below the desktop breakpoint.
 */
export function DesktopAside() {
  const pathname = usePathname();
  const [url, setUrl] = useState("");
  useEffect(() => { setUrl(window.location.href); }, [pathname]);

  return (
    <aside className="hidden lg:flex flex-col justify-center gap-8 w-[380px] shrink-0 animate-fade-up">
      <S2SLogo height={64} />
      <div>
        <p className="s2s-heading text-[44px] leading-[1.04]">
          Speech and sign, in one conversation.
        </p>
        <p className="mt-4 text-[17px] leading-relaxed text-muted-foreground max-w-[34ch]">
          S2S turns speech into ASL signing and signing back into speech, live, between two people.
        </p>
      </div>
      <div className="s2s-card p-5 flex items-center gap-5 w-fit">
        <div className="rounded-2xl bg-white p-2.5 border border-primary/10">
          {url && <QRCodeSVG value={url} size={112} bgColor="#ffffff" fgColor="#1E3A8A" level="M" />}
        </div>
        <div>
          <p className="font-display font-bold text-foreground">Try it on your phone</p>
          <p className="text-sm text-muted-foreground leading-snug mt-1 max-w-[18ch]">
            Scan to open this screen on your own device.
          </p>
        </div>
      </div>
      <div className="h-1 w-40 rounded-full s2s-ribbon" aria-hidden="true" />
    </aside>
  );
}
