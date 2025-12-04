"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function AuthCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    const finalize = async () => {
      const {
        data: { session },
        error,
      } = await supabase.auth.getSession();

      if (error || !session) {
        console.error("❌ Session missing:", error);
        return router.replace("/login?error=no_session");
      }

      const user = session.user;

      // ✅ 1. Uložíme/overíme agenta
      const { data: agent, error: agentError } = await supabase
        .from("agents")
        .upsert(
          {
            id: user.id,
            full_name: user.user_metadata?.full_name || "Unknown",
            email: user.email,
          },
          { onConflict: "id" }
        )
        .select()
        .single();

      if (agentError) {
        console.error("❌ Agent insert failed:", agentError);
        return router.replace("/login?error=agent_insert");
      }

      console.log("✅ Agent OK:", agent.id);

      // ✅ 2. Presun na connect/google (tu sa rieši client_credentials)
      router.replace("/connect/google");
    };

    finalize();
  }, [router]);

  return <div>Finalizing login...</div>;
}
