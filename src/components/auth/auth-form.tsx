"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { ArrowRight } from "lucide-react";
import { authMode, startDemoSession } from "@/lib/auth/session";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/field";

interface AuthFormProps {
  variant: "login" | "signup";
}

function validateEmail(email: string): string | undefined {
  if (!email.trim()) return "Email is required";
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return "Enter a valid email address";
}

function validatePassword(password: string): string | undefined {
  if (!password) return "Password is required";
  if (password.length < 8) return "Password must be at least 8 characters";
}

function AuthFormInner({ variant }: AuthFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const mode = authMode();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [errors, setErrors] = useState<{ email?: string; password?: string; name?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const nextPath = searchParams.get("next") ?? "/";

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setFormError(null);
    const nextErrors = {
      email: validateEmail(email),
      password: validatePassword(password),
      name: variant === "signup" && !displayName.trim() ? "Your name is required" : undefined,
    };
    setErrors(nextErrors);
    if (nextErrors.email || nextErrors.password || nextErrors.name) return;

    if (mode === "demo") {
      setFormError(
        "Live accounts need Supabase credentials (see .env.example). Use demo mode below to explore the full app.",
      );
      return;
    }

    setBusy(true);
    try {
      const { getBrowserSupabase } = await import("@/lib/supabase/client");
      const supabase = getBrowserSupabase();
      if (variant === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { display_name: displayName.trim() } },
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      router.replace(nextPath);
      router.refresh();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Authentication failed");
    } finally {
      setBusy(false);
    }
  }

  function continueInDemoMode() {
    startDemoSession();
    router.replace(nextPath);
  }

  return (
    <div>
      <h1 className="text-lg font-semibold tracking-tight text-ink">
        {variant === "login" ? "Welcome back" : "Create your account"}
      </h1>
      <p className="mt-1 text-[13px] text-ink-soft">
        {variant === "login"
          ? "Sign in to manage your client previews."
          : "Start planning Instagram content for your clients."}
      </p>

      <form onSubmit={handleSubmit} noValidate className="mt-5 space-y-4">
        {variant === "signup" && (
          <TextField
            label="Your name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            error={errors.name}
            autoComplete="name"
          />
        )}
        <TextField
          label="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={errors.email}
          autoComplete="email"
        />
        <TextField
          label="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={errors.password}
          autoComplete={variant === "login" ? "current-password" : "new-password"}
        />
        {formError && (
          <p role="alert" className="rounded-lg bg-accent-soft px-3 py-2 text-[12.5px] text-accent-deep">
            {formError}
          </p>
        )}
        <Button type="submit" variant="primary" className="w-full" disabled={busy}>
          {busy ? "Please wait…" : variant === "login" ? "Sign in" : "Create account"}
        </Button>
      </form>

      <div className="mt-4 border-t border-line pt-4">
        <Button onClick={continueInDemoMode} className="w-full">
          Continue in demo mode
          <ArrowRight className="size-3.5" aria-hidden="true" />
        </Button>
        <p className="mt-2 text-center text-[11.5px] leading-relaxed text-ink-faint">
          Demo mode stores everything locally in this browser — no account needed.
        </p>
      </div>

      <p className="mt-5 text-center text-[12.5px] text-ink-soft">
        {variant === "login" ? (
          <>
            No account?{" "}
            <Link href="/signup" className="font-medium text-ink underline-offset-2 hover:underline">
              Sign up
            </Link>
          </>
        ) : (
          <>
            Already have an account?{" "}
            <Link href="/login" className="font-medium text-ink underline-offset-2 hover:underline">
              Sign in
            </Link>
          </>
        )}
      </p>
    </div>
  );
}

export function AuthForm({ variant }: AuthFormProps) {
  return (
    <Suspense>
      <AuthFormInner variant={variant} />
    </Suspense>
  );
}
