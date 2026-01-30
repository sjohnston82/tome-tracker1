"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function RegisterPage() {
  const { register, loading, error } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [validationError, setValidationError] = useState("");

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setValidationError("");
    if (password !== confirmPassword) {
      setValidationError("Passwords do not match");
      return;
    }
    if (password.length < 12) {
      setValidationError("Password must be at least 12 characters");
      return;
    }
    if (!/[0-9]/.test(password)) {
      setValidationError("Password must contain a number");
      return;
    }
    if (!/[^a-zA-Z0-9]/.test(password)) {
      setValidationError("Password must contain a symbol");
      return;
    }
    await register(email, password);
  };

  return (
    <div className="space-y-8">
      <div className="text-center">
        <h1 className="text-3xl font-bold">Create your account</h1>
        <p className="text-gray-600 mt-2">
          Start building your personal library
        </p>
      </div>
      <form onSubmit={handleSubmit} className="space-y-6">
        {(validationError || error) && (
          <div className="bg-red-50 text-red-600 p-4 rounded-lg text-sm">
            {validationError || error}
          </div>
        )}
        <Input
          label="Email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />
        <Input
          label="Password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />
        <Input
          label="Confirm Password"
          type="password"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          required
        />
        <p className="text-xs text-gray-500">
          Password: 12+ chars, 1 number, 1 symbol
        </p>
        <Button type="submit" className="w-full" loading={loading}>
          Create account
        </Button>
      </form>
      <p className="text-center text-sm text-gray-600">
        Already have an account?{" "}
        <Link href="/login" className="text-blue-600 hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
