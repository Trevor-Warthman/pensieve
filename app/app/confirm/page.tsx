"use client";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import ThemeToggle from "@/components/ThemeToggle";

function ConfirmForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState(searchParams.get("email") ?? "");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code }),
      });

      const body = await res.json() as { message?: string; error?: string };
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);

      router.push("/login");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Confirmation failed");
    } finally {
      setLoading(false);
    }
  }

  return (
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
        <label htmlFor="code" className="text-sm text-gray-500 dark:text-gray-400">Confirmation code</label>
        <input
          id="code"
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          required
          autoComplete="one-time-code"
          inputMode="numeric"
          className="w-full rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 outline-none focus:border-gray-400 dark:focus:border-gray-500"
        />
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      <button
        type="submit"
        disabled={loading}
        className="w-full py-2 rounded bg-gray-900 dark:bg-white text-white dark:text-gray-950 text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
      >
        {loading ? "Verifying…" : "Verify email"}
      </button>
    </form>
  );
}

export default function ConfirmPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2 text-center">
          Verify your email
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-8 text-center">
          Enter the confirmation code sent to your email.
        </p>

        <Suspense>
          <ConfirmForm />
        </Suspense>

        <p className="mt-6 text-center text-sm text-gray-500 dark:text-gray-400">
          Already verified?{" "}
          <Link href="/login" className="text-gray-900 dark:text-white hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
