"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import ThemeToggle from "@/components/ThemeToggle";

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      setError("Passwords do not match");
      return;
    }
    setError(null);
    setLoading(true);

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const body = await res.json() as { accessToken?: string; message?: string; error?: string };
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);

      if (body.accessToken) {
        localStorage.setItem("pensieve_token", body.accessToken);
        localStorage.setItem("pensieve_email", email);
        document.cookie = `pensieve_token=${body.accessToken}; path=/; SameSite=Strict`;
        router.push("/dashboard");
      } else {
        setSuccess(body.message ?? "Account created. Check your email to confirm.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-8 text-center">
          Create an account
        </h1>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label htmlFor="email" className="text-sm text-gray-500 dark:text-gray-400">Email</label>
            <input
              id="email"
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
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="new-password"
              className="w-full rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 outline-none focus:border-gray-400 dark:focus:border-gray-500"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="confirm" className="text-sm text-gray-500 dark:text-gray-400">Confirm password</label>
            <input
              id="confirm"
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              autoComplete="new-password"
              className="w-full rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 outline-none focus:border-gray-400 dark:focus:border-gray-500"
            />
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}
          {success && <p className="text-sm text-green-600 dark:text-green-400">{success}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 rounded bg-gray-900 dark:bg-white text-white dark:text-gray-950 text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {loading ? "Creating account…" : "Create account"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-gray-500 dark:text-gray-400">
          Already have an account?{" "}
          <Link href="/login" className="text-gray-900 dark:text-white hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
