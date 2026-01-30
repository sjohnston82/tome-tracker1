"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function ResetPasswordPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    if (!token) {
      setError("Reset token is missing");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/auth/password-reset/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });

      const data = await response.json();
      if (!response.ok) {
        setError(data.message || "Reset failed");
        return;
      }

      setSuccess(true);
      setTimeout(() => router.push("/login"), 800);
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="text-center">
        <h1 className="text-3xl font-bold">Choose a new password</h1>
        <p className="text-gray-600 mt-2">Your new password must be strong</p>
      </div>
      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="bg-red-50 text-red-600 p-4 rounded-lg text-sm">
            {error}
          </div>
        )}
        {success && (
          <div className="bg-green-50 text-green-700 p-4 rounded-lg text-sm">
            Password updated. Redirecting to login...
          </div>
        )}
        <Input
          label="New password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />
        <Input
          label="Confirm new password"
          type="password"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          required
        />
        <Button type="submit" className="w-full" loading={loading}>
          Reset password
        </Button>
      </form>
    </div>
  );
}
