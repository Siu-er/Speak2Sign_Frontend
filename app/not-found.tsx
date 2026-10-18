import Link from "next/link";
import { Compass } from "lucide-react";
import { S2SLogo } from "@/app/components/shell/S2SLogo";

export default function NotFound() {
  return (
    <div className="s2s-shell flex flex-col px-6 pt-6 pb-10">
      <div className="lg:hidden"><S2SLogo /></div>
      <main className="flex-1 flex flex-col items-center justify-center text-center">
        <div className="w-20 h-20 rounded-full p-[3px] s2s-ribbon">
          <div className="w-full h-full rounded-full bg-white grid place-items-center text-primary">
            <Compass className="w-9 h-9" />
          </div>
        </div>
        <h1 className="mt-6 s2s-heading text-[30px] leading-tight">This page does not exist</h1>
        <p className="mt-2 text-muted-foreground text-[15px] max-w-[30ch]">
          The link may be mistyped, or the page has moved.
        </p>
        <Link href="/" className="mt-7 s2s-pill-primary px-7 h-12 inline-flex items-center s2s-press">
          Go to Home
        </Link>
      </main>
    </div>
  );
}
