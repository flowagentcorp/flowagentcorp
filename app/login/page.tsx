"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowserClient } from "@/lib/supabaseClient";

export default function LoginPage() {
  const router = useRouter();

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
      alert("Login failed");
      console.error(error);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        flexDirection: "column",
        gap: 16,
      }}
    >
      Sign in to FlowAgent
      <button onClick={handleLogin}>Continue with Google</button>
    </div>
  );
}
