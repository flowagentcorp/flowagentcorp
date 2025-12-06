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
    // 👉 Získame session (access token)
    const { data } = await supabaseBrowserClient.auth.getSession();
    const accessToken = data.session?.access_token;

    if (!accessToken) {
      alert("No session found. Please log in again.");
      return;
    }

    const res = await fetch("/api/gmail/watch", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${accessToken}`, // 🔥 TOTO JE DÔLEŽITÉ
      },
      body: JSON.stringify({}),
    });

    const out = await res.json();

    if (!res.ok) {
      alert("Failed to enable Gmail sync: " + JSON.stringify(out));
      return;
    }

    alert("🎉 Gmail sync is now ENABLED!");
  } catch (err) {
    console.error(err);
    alert("Unexpected error enabling sync.");
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
  // CONNECT — redirect to /api/oauth/google/start?agent_id=...
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
        fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
      }}
    >
      <div
        style={{
          background: "#020617",
          borderRadius: 16,
          border: "1px solid #1e293b",
          padding: 24,
          maxWidth: 420,
          width: "100%",
          boxShadow: "0 20px 40px rgba(15,23,42,0.8)",
        }}
      >
        <div style={{ marginBottom: 16 }}>
          <h1 style={{ fontSize: 24, marginBottom: 8 }}>Connect your Gmail</h1>
          <p style={{ fontSize: 14, color: "#9ca3af" }}>
            We&apos;ll sync new inquiries into your CRM and let the AI respond.
          </p>
        </div>

        <div
          style={{
            padding: 16,
            borderRadius: 12,
            background: "#020617",
            border: "1px solid #1e293b",
            marginBottom: 16,
          }}
        >
          <p style={{ fontSize: 13, color: "#9ca3af", marginBottom: 8 }}>
            Status
          </p>
          <p style={{ fontSize: 14 }}>
            {connectedEmail ? (
              <>
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      background: "#22c55e",
                    }}
                  />
                  <span>Connected as {connectedEmail}</span>
                </span>
              </>
            ) : (
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  color: "#f97316",
                }}
              >
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: "#f97316",
                  }}
                />
                <span>Not connected</span>
              </span>
            )}
          </p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {connectedEmail ? (
            <>
              <p style={{ marginBottom: 8 }}>
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
    </div>
  );
}
