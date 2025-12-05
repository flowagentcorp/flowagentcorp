"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowserClient } from "@/lib/supabaseClient";

export default function AuthCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    const finalize = async () => {
      // 1️⃣ Parsujeme hash fragment (#access_token=...)
      const hash = window.location.hash.substring(1);
      const params = new URLSearchParams(hash);

      const access_token = params.get("access_token");
      const refresh_token = params.get("refresh_token");

      if (!access_token || !refresh_token) {
        console.error("❌ Tokens missing in callback");
        return router.replace("/login?error=no_tokens");
      }

      // 2️⃣ Nastavíme session ručne
      const { data, error } = await supabaseBrowserClient.auth.setSession({
        access_token,
        refresh_token,
      });

      if (error) {
        console.error("❌ Error setting session:", error);
        return router.replace("/login?error=session_failed");
      }

      // 3️⃣ Overíme session
      const sessionCheck = await supabaseBrowserClient.auth.getSession();
      if (!sessionCheck.data.session) {
        console.error("❌ Session still missing");
        return router.replace("/login?error=no_session");
      }

      // 4️⃣ Hotovo → redirect
      router.replace("/connect/google");
    };

    finalize();
  }, [router]);

  return <div>Finishing login...</div>;
}
