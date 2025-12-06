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

  // =====================================================================================
  // ENABLE GMAIL SYNC — POST /api/gmail/watch
  // =====================================================================================
  const handleEnableSync = async () => {
    try {
      const res = await fetch("/api/gmail/watch", {
        method: "POST",
      });

      if (!res.ok) {
        const text = await res.text();
        alert("Failed to enable Gmail sync: " + text);
        return;
      }

      alert("🎉 Gmail sync enabled! New emails will now flow into your CRM.");
    } catch (err) {
      console.error(err);
      alert("Unexpected error while enabling sync.");
    }
  };

  // =====================================================================================
  // DISCONNECT — deletes client_credentials row
  // =====================================================================================
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

  // =====================================================================================
  // CONNECT — redirect into custom OAuth flow
  // =====================================================================================
  const handleConnect = () => {
    if (!userId) return;
    window.location.href = `/api/oauth/google/start?agent_id=${encodeURIComponent(
      userId
    )}`;
  };

  // =====================================================================================
  // LOAD USER, AGENT AND CREDS
  // =====================================================================================
  useEffect(() => {
    const run = async () => {
      // 1️⃣ Get Supabase session
      const { data: userData, error: userError } =
        await supabaseBrowserClient.auth.getUser();

      const user = userData.user;

      if (userError || !user) {
        console.error("No session:", userError);
        router.replace("/login?error=no_session");
        return;
      }

      setUserId(user.id);

      // 2️⃣ Try to load agent row
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

      // 3️⃣ If agent doesn't exist → create it
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

      // 4️⃣ Load Gmail credentials
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

  // =====================================================================================
  // LOADING UI
  // =====================================================================================
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

  // =====================================================================================
  // MAIN UI
  // =====================================================================================
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
          We use this to read new leads automatically and send smart AI replies.
        </p>

        {/* Gmail CONNECTED */}
        {connectedEmail ? (
          <>
            <p style={{ marginBottom: 16 }}>
              ✅ Connected as <strong>{connectedEmail}</strong>
            </p>

            {/* ENABLE SYNC */}
            <button
              onClick={handleEnableSync}
              style={{
                padding: "10px 16px",
                background: "#3b82f6",
                borderRadius: 999,
                border: "none",
                color: "white",
                cursor: "pointer",
                fontSize: 14,
                width: "100%",
                marginBottom: 12,
              }}
            >
              Enable Gmail Sync
            </button>

            {/* DISCONNECT */}
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
                width: "100%",
              }}
            >
              Disconnect Gmail
            </button>
          </>
        ) : (
          /* Gmail NOT CONNECTED */
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
