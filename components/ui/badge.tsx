import { type HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: "present" | "absent" | "excused" | "unexcused" | "default" | "info";
}

export function Badge({
  className,
  variant = "default",
  ...props
}: BadgeProps) {
  const variants = {
    present: "bg-sage-light text-sage-dark",
    absent: "bg-coral-light text-coral-dark",
    excused: "bg-gold-light text-gold-dark",
    unexcused: "bg-coral text-white",
    default: "bg-cream-dark text-charcoal",
    info: "bg-info/20 text-info",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold",
        variants[variant],
        className
      )}
      {...props}
    />
  );
}

/**
 * Presence badge component
 */
export function PresenceBadge({ present }: { present: boolean }) {
  return (
    <Badge variant={present ? "present" : "absent"}>
      {present ? "Přítomen/a" : "Nepřítomen/a"}
    </Badge>
  );
}

/**
 * Excuse status badge component
 */
export function ExcuseStatusBadge({
  status,
}: {
  status: "NONE" | "EXCUSED" | "UNEXCUSED";
}) {
  if (status === "NONE") return null;

  return (
    <Badge variant={status === "EXCUSED" ? "excused" : "unexcused"}>
      {status === "EXCUSED" ? "Omluveno" : "Neomluveno"}
    </Badge>
  );
}
