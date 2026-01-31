"use client";

import { useState, useEffect } from "react";

export function OfflineBanner() {
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

  if (isOnline) return null;

  return (
    <div className="bg-yellow-500 text-yellow-900 px-4 py-2 text-center text-sm">
      <span className="font-medium">You&apos;re offline.</span>
      <span> Some features are unavailable.</span>
    </div>
  );
}
