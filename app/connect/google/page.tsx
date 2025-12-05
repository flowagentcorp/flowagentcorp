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

      if (!user) return router.replace("/login?error=no_session");

      // 2️⃣ Agent existuje?
      const { data: agent } = await supabaseBrowserClient
        .from("agents")
        .select("*")
        .eq("id", user.id)
        .single();

      if (!agent) return router.replace("/login?error=no_agent");

      setLoading(false);
    };

    run();
  }, [router]);

  const handleConnect = async () => {
    // 🔥 Spustíme vlastný Google Workspace OAuth
    window.location.href = "/api/oauth/google/start";
  };

  if (loading) return <div>Checking agent...</div>;

  return (
    <div style={{ padding: 40 }}>
      <h1>Connect Google Workspace</h1>
      <button onClick={handleConnect}>Connect Google</button>
    </div>
  );
}
