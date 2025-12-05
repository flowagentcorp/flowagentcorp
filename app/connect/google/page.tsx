"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowserClient } from "@/lib/supabaseClient";

export default function ConnectGooglePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const run = async () => {
      // 1️⃣ Overíme session
      const { data } = await supabaseBrowserClient.auth.getUser();
      const user = data.user;

      if (!user) {
        console.error("❌ No user session");
        return router.replace("/login?error=no_session");
      }

      // 2️⃣ Získame agent_id (z agents tabuľky)
      const { data: agent } = await supabaseBrowserClient
        .from("agents")
        .select("*")
        .eq("id", user.id)
        .single();

      if (!agent) {
        console.error("❌ Agent missing in DB");
        return router.replace("/login?error=no_agent");
      }

      setLoading(false);
    };

    run();
  }, [router]);

  const handleConnect = async () => {
    const { data, error } = await supabaseBrowserClient.auth.signInWithOAuth({
      provider: "google",
      options: {
        scopes:
          "email profile https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.modify https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/gmail.labels",
        redirectTo: `${window.location.origin}/api/oauth/google/callback`,
      },
    });

    if (error) console.error(error);
  };

  if (loading) return <div>Checking agent...</div>;

  return (
    <div style={{ padding: 40 }}>
      <h1>Connect Google Workspace</h1>
      <button onClick={handleConnect}>Connect Google</button>
    </div>
  );
}
