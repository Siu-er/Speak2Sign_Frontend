"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { hasOnboarded } from "@/app/lib/config/onboarding";

/**
 * First-run gate: sends users who have not completed onboarding to the
 * onboarding flow. Runs client-side after mount so localStorage is available.
 */
export function OnboardingGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (pathname === "/onboarding") {
      setChecked(true);
      return;
    }
    if (!hasOnboarded()) {
      router.replace("/onboarding");
      return;
    }
    setChecked(true);
  }, [pathname, router]);

  if (!checked && pathname !== "/onboarding") return null;
  return <>{children}</>;
}
