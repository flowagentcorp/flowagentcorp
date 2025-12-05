"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowserClient } from "@/lib/supabaseClient";

type ClientCredentials = {
  id: string;
  agent_id: string;
  provider: string;
  email_connected: string | null;
};

export default function ConnectGooglePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [connectedEmail, setConnectedEmail] = useState<string | null>(null);

  useEffect(() => {
    const run = async () => {
      // 1️⃣ Session / user
      const { data: userData, error: userError } =
        await supabaseBrowserClient.auth.getUser();

      const user = userData.user;

      if (userError || !user) {
        console.error("No session:", userError);
        router.replace("/login?error=no_session");
        return;
      }

      setUserId(user.id);

      // 2️⃣ Skúsime nájsť agenta
      const { data: agent, error: agentError } = await supabaseBrowserClient
        .from("agents")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();

      if (agentError) {
        console.error("Error loading agent:", agentError);
        router.replace("/login?error=agent_load_failed");
        return;
      }

      // 3️⃣ Ak agent neexistuje → vytvoríme ho
      if (!agent) {
        const fullName =
          (user.user_metadata as any)?.full_name ??
          (user.user_metadata as any)?.name ??
          "";
        const email = user.email;

        const { error: insertError } = await supabaseBrowserClient
          .from("agents")
          .insert({
            id: user.id,
            full_name: fullName,
            email,
          });

        if (insertError) {
          console.error("Error creating agent:", insertError);
          router.replace("/login?error=agent_create_failed");
          return;
        }
      }

      // 4️⃣ Skontrolujeme, či už má klient Gmail credentials
      const { data: creds, error: credsError } = await supabaseBrowserClient
        .from("client_credentials")
        .select("*")
        .eq("agent_id", user.id)
        .eq("provider", "google")
        .maybeSingle<ClientCredentials>();

      if (credsError) {
        console.error("Error loading client_credentials:", credsError);
      } else if (creds) {
        setConnectedEmail(creds.email_connected);
      }

      setLoading(false);
    };

    run();
  }, [router]);

  const handleConnect = () => {
    if (!userId) return;
    // Spustíme náš vlastný Google OAuth na Gmail
    window.location.href = `/api/oauth/google/start?agent_id=${encodeURIComponent(
      userId
    )}`;
  };

  const handleDisconnect = async () => {
    if (!userId) return;

    const { error } = await supabaseBrowserClient
      .from("client_credentials")
      .delete()
      .eq("agent_id", userId)
      .eq("provider", "google");

    if (error) {
      console.error("Error disconnecting Gmail:", error);
      alert("Failed to disconnect Gmail");
      return;
    }

    setConnectedEmail(null);
  };

  if (loading) {
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
        <p>Checking your account…</p>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#020617",
        color: "white",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <div
        style={{
          background: "#0f172a",
          padding: 24,
          borderRadius: 16,
          maxWidth: 480,
          width: "100%",
          border: "1px solid #1e293b",
        }}
      >
        <h1 style={{ fontSize: 24, fontWeight: 600, marginBottom: 12 }}>
          Connect your Gmail
        </h1>
        <p style={{ color: "#94a3b8", marginBottom: 16 }}>
          We use this to read new leads and send smart AI replies.
        </p>

        {connectedEmail ? (
          <>
            <p style={{ marginBottom: 16 }}>
              ✅ Connected as <strong>{connectedEmail}</strong>
            </p>
            <button
              onClick={handleDisconnect}
              style={{
                padding: "10px 16px",
                background: "#ef4444",
                borderRadius: 999,
                border: "none",
                color: "white",
                cursor: "pointer",
                fontSize: 14,
              }}
            >
              Disconnect Gmail
            </button>
          </>
        ) : (
          <button
            onClick={handleConnect}
            style={{
              padding: "10px 16px",
              background: "#22c55e",
              borderRadius: 999,
              border: "none",
              color: "white",
              cursor: "pointer",
              fontSize: 14,
            }}
          >
            Connect Google
          </button>
        )}
      </div>
    </div>
  );
}
