"use client";

import { useOnboarding } from "@/lib/hooks/useOnboarding";
import { Button } from "@/components/ui/button";

const STEPS = [
  {
    title: "Welcome to Tome Tracker! 📚",
    content: "Keep track of your book collection and never buy duplicates again.",
    image: "📱",
  },
  {
    title: "Scan Books Instantly",
    content:
      "Use your camera to scan book barcodes. The app will automatically look up the book and add it to your library.",
    image: "📷",
  },
  {
    title: "Works Offline (for viewing)",
    content:
      "Your library is cached on your device. You can browse and search your collection even without internet. Adding new books requires a connection.",
    image: "📡",
  },
];

export function OnboardingModal() {
  const { showOnboarding, step, nextStep, completeOnboarding } = useOnboarding();

  if (!showOnboarding) return null;

  const currentStep = STEPS[step];
  const isLastStep = step === STEPS.length - 1;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 max-w-md w-full text-center">
        <div className="text-6xl mb-6">{currentStep.image}</div>

        <h2 className="text-2xl font-bold mb-4">{currentStep.title}</h2>

        <p className="text-gray-600 dark:text-gray-400 mb-8">{currentStep.content}</p>

        <div className="flex justify-center gap-2 mb-6">
          {STEPS.map((_, index) => (
            <div
              key={index}
              className={`w-2 h-2 rounded-full ${
                index === step ? "bg-blue-600" : "bg-gray-300 dark:bg-gray-600"
              }`}
            />
          ))}
        </div>

        <div className="flex gap-3 justify-center">
          {!isLastStep ? (
            <>
              <Button variant="ghost" onClick={completeOnboarding}>
                Skip
              </Button>
              <Button onClick={nextStep}>Next</Button>
            </>
          ) : (
            <Button onClick={completeOnboarding} className="px-8">
              Get Started
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
