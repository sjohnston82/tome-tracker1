"use client";

import { useState, useEffect } from "react";

const ONBOARDING_KEY = "library-onboarding-complete";

export function useOnboarding() {
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    const complete = localStorage.getItem(ONBOARDING_KEY);
    if (!complete) {
      setShowOnboarding(true);
    }
  }, []);

  const nextStep = () => {
    setStep((current) => current + 1);
  };

  const completeOnboarding = () => {
    localStorage.setItem(ONBOARDING_KEY, "true");
    setShowOnboarding(false);
  };

  const resetOnboarding = () => {
    localStorage.removeItem(ONBOARDING_KEY);
    setShowOnboarding(true);
    setStep(0);
  };

  return {
    showOnboarding,
    step,
    nextStep,
    completeOnboarding,
    resetOnboarding,
  };
}
