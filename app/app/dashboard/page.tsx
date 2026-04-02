"use client";
import { useState, useEffect } from "react";
import Link from "next/link";

interface Lexicon {
  lexiconId: string;
  slug: string;
  title: string;
  publishDefault: boolean;
  status?: "active" | "unpublished";
  createdAt: string;
}

type View = "list" | "create" | "success";

export default function DashboardPage() {
  const [lexicons, setLexicons] = useState<Lexicon[]>([]);
  const [view, setView] = useState<View>("list");
  const [createdSlug, setCreatedSlug] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const apiBase = process.env.NEXT_PUBLIC_API_URL;

  async function fetchLexicons() {
    if (!apiBase) { setLoading(false); return; }
    const token = localStorage.getItem("pensieve_token");
    if (!token) { setLoading(false); return; }
    try {
      const res = await fetch(`${apiBase}/lexicons`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json() as { lexicons: Lexicon[] };
      setLexicons(data.lexicons);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load lexicons");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchLexicons(); }, []);

  return (
    <main className="flex min-h-screen flex-col px-6 py-16 max-w-4xl mx-auto">
      <div className="flex items-end justify-between mb-10">
        <div>
          <p className="text-sm text-gray-500 uppercase tracking-widest mb-2">Account</p>
          <h1 className="text-4xl font-bold text-white">Dashboard</h1>
        </div>
        {view === "list" && (
          <button
            onClick={() => setView("create")}
            className="px-4 py-2 rounded bg-white text-gray-950 text-sm font-medium hover:bg-gray-100 transition-colors"
          >
            New Lexicon
          </button>
        )}
      </div>

      {view === "create" ? (
        <CreateLexiconForm
          apiBase={apiBase}
          onCreated={(slug) => { setCreatedSlug(slug); setView("success"); fetchLexicons(); }}
          onCancel={() => setView("list")}
        />
      ) : view === "success" ? (
        <NextSteps slug={createdSlug} onDone={() => setView("list")} />
      ) : (
        <LexiconList
          lexicons={lexicons}
          loading={loading}
          error={error}
          apiBase={apiBase}
          onCreateClick={() => setView("create")}
          onRefresh={fetchLexicons}
        />
      )}
    </main>
  );
}

function LexiconList({
  lexicons,
  loading,
  error,
  apiBase,
  onCreateClick,
  onRefresh,
}: {
  lexicons: Lexicon[];
  loading: boolean;
  error: string | null;
  apiBase: string | undefined;
  onCreateClick: () => void;
  onRefresh: () => void;
}) {
  const [actionError, setActionError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  async function toggleStatus(lex: Lexicon) {
    if (!apiBase) return;
    const token = localStorage.getItem("pensieve_token");
    if (!token) return;
    const newStatus = (lex.status ?? "active") === "active" ? "unpublished" : "active";
    setPendingId(lex.lexiconId);
    setActionError(null);
    try {
      const res = await fetch(`${apiBase}/lexicons/${lex.lexiconId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) {
        const body = await res.json() as { error?: string };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      onRefresh();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setPendingId(null);
    }
  }

  async function deleteLexicon(lexiconId: string) {
    if (!apiBase) return;
    const token = localStorage.getItem("pensieve_token");
    if (!token) return;
    setPendingId(lexiconId);
    setActionError(null);
    setConfirmDeleteId(null);
    try {
      const res = await fetch(`${apiBase}/lexicons/${lexiconId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok && res.status !== 204) {
        const body = await res.json() as { error?: string };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      onRefresh();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setPendingId(null);
    }
  }

  if (loading) return <p className="text-gray-500">Loading…</p>;
  if (error) return <p className="text-red-400">{error}</p>;
  if (!lexicons.length) {
    return (
      <div className="border border-dashed border-gray-700 rounded-lg p-8 space-y-6">
        <p className="text-sm text-gray-500">Get started in two steps:</p>
        <div className="space-y-5">
          <Step number={1} done={false} label="Create a Lexicon">
            <p className="text-sm text-gray-400 mt-1">
              A Lexicon is your published collection — a blog, wiki, or campaign site.
            </p>
            <button
              onClick={onCreateClick}
              className="mt-3 px-4 py-2 rounded bg-white text-gray-950 text-sm font-medium hover:bg-gray-100 transition-colors"
            >
              New Lexicon
            </button>
          </Step>
          <Step number={2} done={false} label="Sync Your Notes">
            <p className="text-sm text-gray-400 mt-1">
              Point the CLI at any folder of Markdown files.
            </p>
            <CodeBlock code="pensieve sync ./your-notes --lexicon your-slug" className="mt-3" />
            <p className="text-xs text-gray-600 mt-2">
              Install first: <code className="text-gray-500">npm install -g pensieve-cli</code>
              {" · "}
              <Link href="/setup" className="text-gray-500 hover:text-gray-300 underline transition-colors">
                New to the terminal?
              </Link>
            </p>
          </Step>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {actionError && <p className="text-sm text-red-400">{actionError}</p>}
      <ul className="space-y-3">
        {lexicons.map((lex) => {
          const isUnpublished = (lex.status ?? "active") === "unpublished";
          const isBusy = pendingId === lex.lexiconId;
          return (
            <li key={lex.lexiconId} className="rounded-lg border border-gray-800 hover:border-gray-700 transition-colors">
              <div className="flex items-center justify-between px-5 py-4">
                <Link href={`/${lex.slug}`} className="group flex-1 min-w-0 mr-4">
                  <div className="flex items-center gap-2">
                    <p className="text-white font-medium group-hover:text-gray-100 truncate">{lex.title}</p>
                    {isUnpublished && (
                      <span className="flex-shrink-0 text-xs px-1.5 py-0.5 rounded bg-gray-800 text-gray-500 border border-gray-700">
                        offline
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">
                    /{lex.slug} · publish default: {lex.publishDefault ? "public" : "private"}
                  </p>
                </Link>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {confirmDeleteId === lex.lexiconId ? (
                    <>
                      <span className="text-xs text-gray-400 mr-1">Delete permanently?</span>
                      <button
                        onClick={() => deleteLexicon(lex.lexiconId)}
                        disabled={isBusy}
                        className="text-xs px-2.5 py-1 rounded bg-red-900 text-red-200 hover:bg-red-800 disabled:opacity-50 transition-colors"
                      >
                        {isBusy ? "Deleting…" : "Confirm"}
                      </button>
                      <button
                        onClick={() => setConfirmDeleteId(null)}
                        className="text-xs px-2.5 py-1 rounded border border-gray-700 text-gray-400 hover:border-gray-500 transition-colors"
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => toggleStatus(lex)}
                        disabled={isBusy}
                        className="text-xs px-2.5 py-1 rounded border border-gray-700 text-gray-400 hover:border-gray-500 hover:text-gray-200 disabled:opacity-50 transition-colors"
                      >
                        {isBusy ? "…" : isUnpublished ? "Republish" : "Unpublish"}
                      </button>
                      <button
                        onClick={() => setConfirmDeleteId(lex.lexiconId)}
                        className="text-xs px-2.5 py-1 rounded border border-gray-700 text-gray-400 hover:border-red-900 hover:text-red-400 hover:border-red-800 transition-colors"
                      >
                        Delete
                      </button>
                    </>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function CreateLexiconForm({
  apiBase,
  onCreated,
  onCancel,
}: {
  apiBase: string | undefined;
  onCreated: (slug: string) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [publishDefault, setPublishDefault] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function deriveSlug(t: string) {
    return t.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!apiBase) { setError("API not configured"); return; }
    const token = localStorage.getItem("pensieve_token");
    if (!token) { setError("Not logged in"); return; }

    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`${apiBase}/lexicons`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ title, slug, publishDefault }),
      });
      if (!res.ok) {
        const body = await res.json() as { error?: string };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      onCreated(slug);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create lexicon");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-md space-y-5">
      <h2 className="text-xl font-semibold text-white">New Lexicon</h2>

      <div className="space-y-1">
        <label className="text-sm text-gray-400">Title</label>
        <input
          type="text"
          value={title}
          onChange={(e) => { setTitle(e.target.value); setSlug(deriveSlug(e.target.value)); }}
          required
          className="w-full rounded bg-gray-900 border border-gray-700 px-3 py-2 text-sm text-gray-100 outline-none focus:border-gray-500"
          placeholder="My Notes"
        />
      </div>

      <div className="space-y-1">
        <label className="text-sm text-gray-400">Slug</label>
        <input
          type="text"
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          required
          pattern="[a-z0-9-]+"
          className="w-full rounded bg-gray-900 border border-gray-700 px-3 py-2 text-sm text-gray-100 font-mono outline-none focus:border-gray-500"
          placeholder="my-notes"
        />
        <p className="text-xs text-gray-600">Lowercase letters, numbers, hyphens only</p>
      </div>

      <div className="flex items-center gap-3">
        <input
          type="checkbox"
          id="publishDefault"
          checked={publishDefault}
          onChange={(e) => setPublishDefault(e.target.checked)}
          className="rounded border-gray-600"
        />
        <label htmlFor="publishDefault" className="text-sm text-gray-400">
          Publish notes by default (can override per file)
        </label>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={submitting}
          className="px-4 py-2 rounded bg-white text-gray-950 text-sm font-medium hover:bg-gray-100 disabled:opacity-50 transition-colors"
        >
          {submitting ? "Creating…" : "Create"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 rounded border border-gray-700 text-gray-400 text-sm hover:border-gray-500 hover:text-gray-200 transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

function NextSteps({ slug, onDone }: { slug: string; onDone: () => void }) {
  return (
    <div className="max-w-md space-y-6">
      <div>
        <p className="text-sm text-gray-500 uppercase tracking-widest mb-1">Lexicon created</p>
        <h2 className="text-2xl font-bold text-white">Sync Your Notes</h2>
      </div>
      <p className="text-sm text-gray-400">
        Run this command from your notes folder to publish for the first time:
      </p>
      <CodeBlock code={`pensieve sync ./your-notes --lexicon ${slug}`} />
      <p className="text-xs text-gray-600">
        Don&apos;t have the CLI? <code className="text-gray-500">npm install -g pensieve-cli</code>
        {" · "}
        <Link href="/setup" className="text-gray-500 hover:text-gray-300 underline transition-colors">
          Setup guide
        </Link>
      </p>
      <button
        onClick={onDone}
        className="px-4 py-2 rounded bg-white text-gray-950 text-sm font-medium hover:bg-gray-100 transition-colors"
      >
        Go to Dashboard
      </button>
    </div>
  );
}

function Step({
  number,
  done,
  label,
  children,
}: {
  number: number;
  done: boolean;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-4">
      <div
        className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium mt-0.5 ${
          done
            ? "bg-green-500 text-white"
            : "bg-gray-800 text-gray-400 border border-gray-700"
        }`}
        aria-label={done ? "Done" : `Step ${number}`}
      >
        {done ? "✓" : number}
      </div>
      <div className="min-w-0">
        <p className={`text-sm font-medium ${done ? "text-gray-500 line-through" : "text-white"}`}>
          {label}
        </p>
        {children}
      </div>
    </div>
  );
}

function CodeBlock({ code, className }: { code: string; className?: string }) {
  const [copied, setCopied] = useState(false);

  function copy() {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className={`group flex items-center justify-between rounded bg-gray-900 border border-gray-800 px-4 py-3 ${className ?? ""}`}>
      <code className="text-sm text-gray-300 font-mono min-w-0 truncate">{code}</code>
      <button
        type="button"
        onClick={copy}
        aria-label="Copy command"
        className="ml-3 flex-shrink-0 text-xs text-gray-600 hover:text-gray-300 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gray-500 rounded"
      >
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}
