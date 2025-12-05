"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowserClient } from "@/lib/supabaseClient";

export default function AuthCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    const run = async () => {
      // 1️⃣ Extract session from URL fragment (#access_token=...)
      const { data: sessionData, error: sessionError } =
        await supabaseBrowserClient.auth.getSessionFromUrl({
          storeSession: true,
        });

      if (sessionError) {
        console.error("❌ Failed to load session:", sessionError);
        router.replace("/login?error=no_session");
        return;
      }

      // 2️⃣ If session exists → continue to Gmail connect page
      const { data: userData } = await supabaseBrowserClient.auth.getUser();

      if (userData?.user) {
        router.replace("/connect/google");
      } else {
        router.replace("/login?error=no_user");
      }
    };

    run();
  }, [router]);

  return <p>Loading...</p>;
}
