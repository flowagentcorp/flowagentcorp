"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowserClient } from "@/lib/supabaseClient";

export default function AuthCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    const finalize = async () => {

      // 1️⃣ Supabase uloží session z URL hash (#)
      const { data, error } = await supabaseBrowserClient.auth.setSessionFromUrl();

      if (error) {
        console.error("❌ Error saving session:", error);
        return router.replace("/login?error=session_failed");
      }

      // 2️⃣ Overíme že session existuje
      const sessionCheck = await supabaseBrowserClient.auth.getSession();
      if (!sessionCheck.data.session) {
        console.error("❌ Session missing after save");
        return router.replace("/login?error=no_session");
      }

      // 3️⃣ Presmerovanie späť
      router.replace("/connect/google");
    };

    finalize();
  }, [router]);

  return <div>Finishing login...</div>;
}
