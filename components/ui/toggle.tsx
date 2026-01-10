"use client";

import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export interface ToggleProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  label?: string;
  description?: string;
}

const Toggle = forwardRef<HTMLInputElement, ToggleProps>(
  ({ className, label, description, id, ...props }, ref) => {
    const toggleId = id || label?.toLowerCase().replace(/\s+/g, "-");

    return (
      <label
        htmlFor={toggleId}
        className={cn(
          "flex items-center gap-3 cursor-pointer select-none",
          props.disabled && "opacity-50 cursor-not-allowed",
          className
        )}
      >
        <div className="relative">
          <input
            ref={ref}
            type="checkbox"
            id={toggleId}
            className="peer sr-only"
            {...props}
          />
          <div
            className={cn(
              "w-11 h-6 rounded-full transition-colors duration-200",
              "bg-cream-dark peer-checked:bg-gold",
              "peer-focus-visible:ring-2 peer-focus-visible:ring-gold peer-focus-visible:ring-offset-2"
            )}
          />
          <div
            className={cn(
              "absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-sm",
              "transition-transform duration-200",
              "peer-checked:translate-x-5"
            )}
          />
        </div>
        {(label || description) && (
          <div className="flex flex-col">
            {label && (
              <span className="text-sm font-medium text-charcoal">{label}</span>
            )}
            {description && (
              <span className="text-xs text-charcoal-light">{description}</span>
            )}
          </div>
        )}
      </label>
    );
  }
);

Toggle.displayName = "Toggle";

export { Toggle };
