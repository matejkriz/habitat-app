"use client";

import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, hint, id, type = "text", ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, "-");

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-sm font-medium text-charcoal mb-1.5"
          >
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          type={type}
          className={cn(
            "w-full h-10 px-3 rounded-lg border-2 bg-white text-charcoal placeholder:text-charcoal-light/50",
            "transition-colors duration-200",
            "focus:outline-none focus:border-gold focus:ring-0",
            error
              ? "border-coral focus:border-coral"
              : "border-cream-dark hover:border-sage-light",
            className
          )}
          {...props}
        />
        {hint && !error && (
          <p className="mt-1.5 text-sm text-charcoal-light">{hint}</p>
        )}
        {error && <p className="mt-1.5 text-sm text-coral">{error}</p>}
      </div>
    );
  }
);

Input.displayName = "Input";

export { Input };
