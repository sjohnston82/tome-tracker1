"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/auth/password-reset/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      if (!response.ok) {
        const data = await response.json();
        setError(data.message || "Request failed");
        return;
      }

      setSuccess(true);
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="text-center">
        <h1 className="text-3xl font-bold">Reset your password</h1>
        <p className="text-gray-600 mt-2">
          We&apos;ll email you a reset link
        </p>
      </div>
      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="bg-red-50 text-red-600 p-4 rounded-lg text-sm">
            {error}
          </div>
        )}
        {success && (
          <div className="bg-green-50 text-green-700 p-4 rounded-lg text-sm">
            If an account exists, a reset email has been sent.
          </div>
        )}
        <Input
          label="Email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />
        <Button type="submit" className="w-full" loading={loading}>
          Send reset link
        </Button>
      </form>
      <p className="text-center text-sm text-gray-600">
        Remembered your password?{" "}
        <Link href="/login" className="text-blue-600 hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
