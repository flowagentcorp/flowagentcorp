"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabaseBrowserClient } from "@/lib/supabaseClient";

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const error = searchParams.get("error");

  useEffect(() => {
    (async () => {
      const { data } = await supabaseBrowserClient.auth.getUser();
      if (data.user) {
        router.replace("/connect/google");
      }
    })();
  }, [router]);

  const handleLogin = async () => {
    const { error } = await supabaseBrowserClient.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      console.error("Supabase Google login error:", error.message);
      alert("Login failed: " + error.message);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#020617",
        color: "white",
        flexDirection: "column",
        gap: 16,
      }}
    >
      <h1 style={{ fontSize: 28, fontWeight: 600, marginBottom: 8 }}>
        Sign in to FlowAgent
      </h1>

      {error && (
        <p style={{ color: "#f97373", marginBottom: 8 }}>
          Login error: {error}
        </p>
      )}

      <button
        onClick={handleLogin}
        style={{
          padding: "12px 20px",
          background: "#2563eb",
          borderRadius: 999,
          border: "none",
          color: "white",
          cursor: "pointer",
          fontSize: 16,
        }}
      >
        Continue with Google
      </button>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div style={{ color: "white" }}>Loading…</div>}>
      <LoginContent />
    </Suspense>
  );
}
