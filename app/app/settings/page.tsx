"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import AppHeader from "@/components/AppHeader";

export default function SettingsPage() {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [emailField, setEmailField] = useState("");
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMsg, setProfileMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const apiBase = process.env.NEXT_PUBLIC_API_URL;

  useEffect(() => {
    const token = localStorage.getItem("pensieve_token");
    if (!token || !apiBase) return;

    fetch(`${apiBase}/users/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data: { email: string; name: string | null }) => {
        setEmail(data.email);
        setEmailField(data.email);
        setName(data.name ?? "");
      })
      .catch(() => {});
  }, [apiBase]);

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!apiBase) return;
    const token = localStorage.getItem("pensieve_token");
    if (!token) return;

    setProfileSaving(true);
    setProfileMsg(null);
    try {
      const body: Record<string, string> = {};
      if (name !== (name ?? "")) body.name = name;
      body.name = name;
      if (emailField !== email) body.email = emailField;

      if (Object.keys(body).length === 0) {
        setProfileMsg({ ok: false, text: "No changes to save." });
        return;
      }

      const res = await fetch(`${apiBase}/users/me`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      const data = await res.json() as { ok?: boolean; error?: string; accessToken?: string };
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);

      if (data.accessToken) {
        localStorage.setItem("pensieve_token", data.accessToken);
        document.cookie = `pensieve_token=${data.accessToken}; path=/; SameSite=Strict`;
        localStorage.setItem("pensieve_email", emailField);
        setEmail(emailField);
      }

      setProfileMsg({ ok: true, text: "Profile updated." });
    } catch (err) {
      setProfileMsg({ ok: false, text: err instanceof Error ? err.message : "Failed to save." });
    } finally {
      setProfileSaving(false);
    }
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setPasswordMsg({ ok: false, text: "New passwords do not match." });
      return;
    }
    if (!apiBase) return;
    const token = localStorage.getItem("pensieve_token");
    if (!token) return;

    setPasswordSaving(true);
    setPasswordMsg(null);
    try {
      const res = await fetch(`${apiBase}/users/me`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json() as { ok?: boolean; error?: string };
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);

      setPasswordMsg({ ok: true, text: "Password updated." });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setPasswordMsg({ ok: false, text: err instanceof Error ? err.message : "Failed to update password." });
    } finally {
      setPasswordSaving(false);
    }
  }

  function logout() {
    localStorage.removeItem("pensieve_token");
    localStorage.removeItem("pensieve_email");
    document.cookie = "pensieve_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Strict";
    router.push("/login");
  }

  return (
    <div className="flex min-h-screen flex-col">
      <AppHeader email={email} />
      <main className="flex-1 px-6 py-12 max-w-2xl mx-auto w-full">
        <div className="mb-10">
          <p className="text-sm text-gray-500 uppercase tracking-widest mb-2">Account</p>
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white">Settings</h1>
        </div>

        <div className="space-y-10">
          {/* Profile section */}
          <section>
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wide mb-4">Profile</h2>
            <form onSubmit={saveProfile} className="space-y-4">
              <div className="space-y-1">
                <label className="text-sm text-gray-600 dark:text-gray-400">Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  className="w-full rounded bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 outline-none focus:border-gray-400 dark:focus:border-gray-500"
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm text-gray-600 dark:text-gray-400">Email</label>
                <input
                  type="email"
                  value={emailField}
                  onChange={(e) => setEmailField(e.target.value)}
                  required
                  className="w-full rounded bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 outline-none focus:border-gray-400 dark:focus:border-gray-500"
                />
              </div>
              {profileMsg && (
                <p className={`text-sm ${profileMsg.ok ? "text-green-600 dark:text-green-400" : "text-red-500"}`}>
                  {profileMsg.text}
                </p>
              )}
              <button
                type="submit"
                disabled={profileSaving}
                className="px-4 py-2 rounded bg-gray-900 dark:bg-white text-white dark:text-gray-950 text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
              >
                {profileSaving ? "Saving…" : "Save changes"}
              </button>
            </form>
          </section>

          <div className="border-t border-gray-200 dark:border-gray-800" />

          {/* Password section */}
          <section>
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wide mb-4">Password</h2>
            <form onSubmit={changePassword} className="space-y-4">
              <div className="space-y-1">
                <label className="text-sm text-gray-600 dark:text-gray-400">Current password</label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  className="w-full rounded bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 outline-none focus:border-gray-400 dark:focus:border-gray-500"
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm text-gray-600 dark:text-gray-400">New password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={8}
                  autoComplete="new-password"
                  className="w-full rounded bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 outline-none focus:border-gray-400 dark:focus:border-gray-500"
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm text-gray-600 dark:text-gray-400">Confirm new password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                  className="w-full rounded bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 outline-none focus:border-gray-400 dark:focus:border-gray-500"
                />
              </div>
              {passwordMsg && (
                <p className={`text-sm ${passwordMsg.ok ? "text-green-600 dark:text-green-400" : "text-red-500"}`}>
                  {passwordMsg.text}
                </p>
              )}
              <button
                type="submit"
                disabled={passwordSaving}
                className="px-4 py-2 rounded bg-gray-900 dark:bg-white text-white dark:text-gray-950 text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
              >
                {passwordSaving ? "Updating…" : "Update password"}
              </button>
            </form>
          </section>

          <div className="border-t border-gray-200 dark:border-gray-800" />

          {/* Sign out */}
          <section>
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wide mb-4">Session</h2>
            <button
              onClick={logout}
              className="px-4 py-2 rounded border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 text-sm hover:border-red-300 dark:hover:border-red-800 hover:text-red-600 dark:hover:text-red-400 transition-colors"
            >
              Log out
            </button>
          </section>
        </div>
      </main>
    </div>
  );
}
