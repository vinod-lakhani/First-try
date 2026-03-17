/**
 * Ribbit Introduction Page
 *
 * First step of onboarding - introduces Ribbit as the financial sidekick.
 */

"use client";

import { useRouter } from "next/navigation";
import RibbitIntro from "@/components/onboarding/RibbitIntro";

export default function RibbitIntroPage() {
  const router = useRouter();

  const handlePrimaryClick = () => {
    router.push("/onboarding/connect");
  };

  return <RibbitIntro onPrimaryClick={handlePrimaryClick} />;
}
