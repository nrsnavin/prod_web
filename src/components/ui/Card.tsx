import { HTMLAttributes } from "react";
import { cn } from "./cn";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  interactive?: boolean;
}

export function Card({ interactive, className, ...rest }: CardProps) {
  return (
    <div
      className={cn(
        // A hairline as well as the shadow: on the slate page the edge is
        // what separates one card from the next, in dark mode most of all.
        "bg-surface rounded-card shadow-card border border-ink-200/70",
        interactive &&
          "transition-shadow hover:shadow-card-hover cursor-pointer",
        className
      )}
      {...rest}
    />
  );
}
