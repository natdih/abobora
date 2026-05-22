import type { ButtonHTMLAttributes } from "react";
import { cn } from "../../utils/format";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg" | "icon";
};

export function Button({ className, variant = "primary", size = "md", ...props }: ButtonProps) {
  const variants = {
    primary: "bg-primary text-primary-foreground hover:brightness-105",
    secondary: "bg-muted text-foreground hover:bg-border",
    ghost: "bg-transparent text-foreground hover:bg-muted",
    danger: "bg-destructive text-white hover:brightness-105"
  };
  const sizes = {
    sm: "h-9 px-3 text-sm",
    md: "h-11 px-4",
    lg: "h-14 px-5 text-lg",
    icon: "h-11 w-11 p-0"
  };

  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-md border border-transparent font-semibold shadow-sm transition disabled:pointer-events-none disabled:opacity-50",
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    />
  );
}
