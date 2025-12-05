"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowserClient } from "@/lib/supabaseClient";

export default function AuthCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    const run = async () => {
      try {
        // 1️⃣ Vymeníme OAuth "code" za Supabase session
        const { data, error } =
          await supabaseBrowserClient.auth.exchangeCodeForSession(
            window.location.href
          );

        if (error) {
          console.error("❌ Error exchanging code for session:", error);
          router.replace("/login?error=callback");
          return;
        }

        // 2️⃣ Skontrolujeme, či máme usera
        const { data: userData, error: userError } =
          await supabaseBrowserClient.auth.getUser();

        if (userError || !userData.user) {
          console.error("❌ No user after callback:", userError);
          router.replace("/login?error=no_session");
          return;
        }

        // 3️⃣ OK → na connect/google
        router.replace("/connect/google");
      } catch (err) {
        console.error("❌ unexpected error:", err);
        router.replace("/login?error=exception");
      }
    };

    run();
  }, [router]);

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#020617",
        color: "white",
      }}
    >
      <p>Signing you in…</p>
    </div>
  );
}
