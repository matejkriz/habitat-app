import Image from "next/image";
import { type HTMLAttributes } from "react";
import { cn, getInitials } from "@/lib/utils";

export interface AvatarProps extends HTMLAttributes<HTMLDivElement> {
  name: string;
  src?: string | null;
  size?: "sm" | "md" | "lg";
}

const sizeMap = {
  sm: { className: "h-8 w-8 text-xs", pixels: 32 },
  md: { className: "h-10 w-10 text-sm", pixels: 40 },
  lg: { className: "h-14 w-14 text-lg", pixels: 56 },
};

export function Avatar({ name, src, size = "md", className, ...props }: AvatarProps) {
  const { className: sizeClassName, pixels } = sizeMap[size];
  const initials = getInitials(name);

  if (src) {
    return (
      <div
        className={cn(
          "rounded-full overflow-hidden flex-shrink-0",
          sizeClassName,
          className
        )}
        {...props}
      >
        <Image
          src={src}
          alt={name}
          width={pixels}
          height={pixels}
          className="h-full w-full object-cover"
        />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "rounded-full bg-gold flex items-center justify-center font-bold text-charcoal flex-shrink-0",
        sizeClassName,
        className
      )}
      {...props}
    >
      {initials}
    </div>
  );
}
