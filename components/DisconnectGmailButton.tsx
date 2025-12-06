"use client";

import { useState } from "react";

export default function DisconnectGmailButton() {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  async function handleDisconnect() {
    setLoading(true);

    const res = await fetch("/api/gmail/disable", {
      method: "POST",
    });

    setLoading(false);

    if (res.ok) {
      setSuccess(true);
      setTimeout(() => {
        window.location.reload();
      }, 700);
    } else {
      alert("Failed to disconnect Gmail");
    }
  }

  return (
    <button
      onClick={handleDisconnect}
      disabled={loading}
      className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition disabled:opacity-50"
    >
      {loading
        ? "Disconnecting..."
        : success
        ? "Disconnected ✓"
        : "Disconnect Gmail"}
    </button>
  );
}
