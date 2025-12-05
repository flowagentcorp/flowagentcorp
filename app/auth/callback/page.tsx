"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowserClient } from "@/lib/supabaseClient";

export default function AuthCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    const run = async () => {
      try {
        // 1️⃣ Pokusíme sa vymeniť OAuth "code" za session
        const { data, error } = await supabaseBrowserClient.auth.exchangeCodeForSession(window.location.href);

        if (error) {
          console.error("❌ exchangeCodeForSession error:", error);
          router.replace("/login?error=exchange_failed");
          return;
        }

        // 2️⃣ Overíme, či máme usera
        const { data: userData } = await supabaseBrowserClient.auth.getUser();

        if (!userData?.user) {
          router.replace("/login?error=no_user");
          return;
        }

        // 3️⃣ Všetko OK → presmerujeme na connect/google
        router.replace("/connect/google");
      } catch (err) {
        console.error("❌ unexpected error:", err);
        router.replace("/login?error=exception");
      }
    };

    run();
  }, [router]);

  return <p>Loading...</p>;
}
