import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "../../utils/format";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input(
  { className, ...props },
  ref
) {
  return (
    <input
      ref={ref}
      className={cn(
        "h-[3.25rem] w-full rounded-md border border-border bg-card px-4 py-3 text-base text-foreground outline-none transition placeholder:text-muted-foreground focus:border-primary focus:ring-4 focus:ring-primary/15",
        className
      )}
      {...props}
    />
  );
});
