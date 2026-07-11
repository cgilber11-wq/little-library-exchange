"use client";

import { Suspense, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";

function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/dashboard";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const res = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });
    if (res?.error) {
      setError("Invalid email or password");
      return;
    }
    router.push(callbackUrl);
    router.refresh();
  }

  const registered = searchParams.get("registered") === "1";

  return (
    <div className="page-shell">
      <AppHeader authenticated={false} />
      <main className="flex flex-1 flex-col items-center justify-center px-4 py-12">
        <div className="cozy-card w-full max-w-sm p-6 sm:p-8">
          <h1 className="font-serif text-2xl font-semibold text-stone-900 mb-6">Sign in</h1>
          <form onSubmit={handleSubmit} className="space-y-4">
            {registered && (
              <p className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900">
                Account created — sign in to continue.
              </p>
            )}
            {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
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
                className="w-full rounded-xl border border-stone-300/90 bg-white px-3 py-2.5 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30"
              />
            </div>
            <button type="submit" className="btn-primary w-full">
              Sign in
            </button>
          </form>
          <p className="mt-4 text-sm text-stone-600">
            No account?{" "}
            <Link href="/register" className="text-emerald-700 hover:underline">
              Sign up
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
