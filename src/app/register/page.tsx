"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";

export default function RegisterPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, name: name || undefined }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Registration failed");
      return;
    }
    router.push("/login?registered=1");
    router.refresh();
  }

  return (
    <div className="page-shell">
      <AppHeader authenticated={false} />
      <main className="flex flex-1 flex-col items-center justify-center px-4 py-12">
        <div className="cozy-card w-full max-w-sm p-6 sm:p-8">
          <h1 className="font-serif text-2xl font-semibold text-stone-900 mb-6">Create account</h1>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-stone-700 mb-1">
                Name (optional)
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-xl border border-stone-300/90 bg-white px-3 py-2.5 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30"
              />
            </div>
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-stone-700 mb-1">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full rounded-xl border border-stone-300/90 bg-white px-3 py-2.5 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30"
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-stone-700 mb-1">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="w-full rounded-xl border border-stone-300/90 bg-white px-3 py-2.5 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30"
              />
            </div>
            <button type="submit" className="btn-primary w-full">
              Sign up
            </button>
          </form>
          <p className="mt-4 text-sm text-stone-600">
            Already have an account?{" "}
            <Link href="/login" className="text-emerald-700 hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
