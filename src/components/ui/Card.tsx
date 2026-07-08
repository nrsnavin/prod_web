import { HTMLAttributes } from "react";
import { cn } from "./cn";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  interactive?: boolean;
}

export function Card({ interactive, className, ...rest }: CardProps) {
  return (
    <div
      className={cn(
        "bg-white rounded-card shadow-card",
        interactive &&
          "transition-shadow hover:shadow-card-hover cursor-pointer",
        className
      )}
      {...rest}
    />
  );
}
