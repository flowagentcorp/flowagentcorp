"use client";

export default function ConnectGoogle() {
  const handleConnect = () => {
    window.location.href =
      "https://thatpvkawzdjyeuzadft.supabase.co/auth/v1/authorize" +
      "?provider=google" +
      "&redirect_to=" +
      encodeURIComponent(
        "https://flowagentcorp.vercel.app/api/oauth/google/callback"
      );
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-black text-white">
      <h1 className="mb-6 text-xl">No Gmail connected</h1>

      <button
        onClick={handleConnect}
        className="bg-blue-600 hover:bg-blue-700 px-6 py-3 rounded-lg text-white font-semibold cursor-pointer"
      >
        Connect Gmail
      </button>
    </div>
  );
}
