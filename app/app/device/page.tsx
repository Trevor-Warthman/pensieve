"use client";
import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import ThemeToggle from "@/components/ThemeToggle";

function DevicePageInner() {
  const searchParams = useSearchParams();
  const [userCode, setUserCode] = useState(searchParams.get("code")?.toUpperCase() ?? "");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const loginRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const loginBody = await loginRes.json() as { accessToken?: string; refreshToken?: string; error?: string };
      if (!loginRes.ok || !loginBody.accessToken) {
        throw new Error(loginBody.error ?? `HTTP ${loginRes.status}`);
      }

      const verifyRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/device/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userCode: userCode.trim().toUpperCase(),
          accessToken: loginBody.accessToken,
          refreshToken: loginBody.refreshToken,
          email,
        }),
      });
      const verifyBody = await verifyRes.json() as { error?: string };
      if (!verifyRes.ok) throw new Error(verifyBody.error ?? `HTTP ${verifyRes.status}`);

      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Approval failed");
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center px-6">
        <div className="w-full max-w-sm text-center">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Device approved</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">You can close this window and return to your terminal.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2 text-center">
          Approve CLI login
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-8 text-center">
          Confirm the code shown in your terminal, then sign in to approve.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label htmlFor="userCode" className="text-sm text-gray-500 dark:text-gray-400">Code</label>
            <input
              id="userCode"
              name="userCode"
              type="text"
              autoComplete="one-time-code"
              value={userCode}
              onChange={(e) => setUserCode(e.target.value)}
              required
              placeholder="XXXX-XXXX"
              className="w-full rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 outline-none focus:border-gray-400 dark:focus:border-gray-500 tracking-widest uppercase"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="email" className="text-sm text-gray-500 dark:text-gray-400">Email</label>
            <input
              id="email"
              name="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="w-full rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 outline-none focus:border-gray-400 dark:focus:border-gray-500"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="password" className="text-sm text-gray-500 dark:text-gray-400">Password</label>
            <input
              id="password"
              name="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              className="w-full rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 outline-none focus:border-gray-400 dark:focus:border-gray-500"
            />
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 rounded bg-gray-900 dark:bg-white text-white dark:text-gray-950 text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {loading ? "Approving…" : "Approve"}
          </button>
        </form>
      </div>
    </main>
  );
}

export default function DevicePage() {
  return (
    <Suspense fallback={null}>
      <DevicePageInner />
    </Suspense>
  );
}
