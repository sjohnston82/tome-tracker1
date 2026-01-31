"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";

interface OfflineGuardProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  action: string;
}

export function OfflineGuard({ children, fallback, action }: OfflineGuardProps) {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    setIsOnline(navigator.onLine);

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  if (isOnline) {
    return <>{children}</>;
  }

  if (fallback) {
    return <>{fallback}</>;
  }

  return (
    <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-8 text-center">
      <div className="text-4xl mb-4">📡</div>
      <h3 className="font-medium text-lg mb-2">You&apos;re offline</h3>
      <p className="text-gray-600 dark:text-gray-400 mb-4">
        You need an internet connection to {action}.
      </p>
      <Button variant="secondary" onClick={() => window.location.reload()}>
        Retry
      </Button>
    </div>
  );
}
