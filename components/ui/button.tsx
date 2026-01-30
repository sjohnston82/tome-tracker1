import { forwardRef, ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = "primary",
      size = "md",
      loading,
      children,
      disabled,
      ...props
    },
    ref
  ) => {
    const variants = {
      primary: "bg-blue-600 text-white hover:bg-blue-700 disabled:bg-blue-300",
      secondary:
        "bg-gray-200 text-gray-900 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-100",
      ghost: "bg-transparent hover:bg-gray-100 dark:hover:bg-gray-800",
      danger: "bg-red-600 text-white hover:bg-red-700 disabled:bg-red-300",
    };
    const sizes = {
      sm: "px-3 py-1.5 text-sm",
      md: "px-4 py-2",
      lg: "px-6 py-3 text-lg",
    };

    return (
      <button
        ref={ref}
        className={cn(
          "rounded-lg font-medium transition-colors inline-flex items-center justify-center",
          "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2",
          "disabled:cursor-not-allowed",
          variants[variant],
          sizes[size],
          className
        )}
        disabled={disabled || loading}
        {...props}
      >
        {loading ? (
          <span className="flex items-center gap-2">
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
                fill="none"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
            Loading...
          </span>
        ) : (
          children
        )}
      </button>
    );
  }
);

Button.displayName = "Button";
