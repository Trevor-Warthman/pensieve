"use client";
import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function LexiconAuthPage({ params }: { params: Promise<{ lexicon: string }> }) {
  const [slug, setSlug] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    params.then((p) => setSlug(p.lexicon));
  }, [params]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!slug) return;

    setSubmitting(true);
    setError(null);

    try {
      const apiBase = process.env.NEXT_PUBLIC_API_URL;
      const res = await fetch(`${apiBase}/lexicons/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, password }),
      });

      if (!res.ok) {
        const body = await res.json() as { error?: string };
        throw new Error(body.error ?? "Invalid password");
      }

      const { token } = await res.json() as { token: string };
      // Store in a cookie that the server layout can read
      const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toUTCString();
      document.cookie = `lex_${slug}=${token}; expires=${expires}; path=/${slug}; SameSite=Lax`;

      const returnTo = searchParams.get("returnTo") ?? `/${slug}`;
      router.push(returnTo);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setSubmitting(false);
    }
  }

  if (!slug) return null;

  return (
    <div className="min-h-screen flex items-center justify-center bg-white dark:bg-gray-950 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8">
          <p className="text-sm text-gray-500 uppercase tracking-widest mb-2">/{slug}</p>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Password required</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">This lexicon is private.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus
              required
              className="w-full rounded bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 outline-none focus:border-gray-400 dark:focus:border-gray-500"
              placeholder="Enter password"
            />
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="w-full px-4 py-2 rounded bg-gray-900 dark:bg-white text-white dark:text-gray-950 text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {submitting ? "Verifying…" : "Unlock"}
          </button>
        </form>
      </div>
    </div>
  );
}
