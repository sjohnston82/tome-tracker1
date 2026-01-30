"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function useAuth() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const register = async (email: string, password: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message);
        return false;
      }
      router.push("/library");
      router.refresh();
      return true;
    } catch {
      setError("Network error");
      return false;
    } finally {
      setLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message);
        return false;
      }
      const redirect = new URLSearchParams(window.location.search).get(
        "redirect"
      );
      router.push(redirect || "/library");
      router.refresh();
      return true;
    } catch {
      setError("Network error");
      return false;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  };

  return { loading, error, register, login, logout, clearError: () => setError(null) };
}
