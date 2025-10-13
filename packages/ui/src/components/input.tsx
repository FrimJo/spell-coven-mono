import * as React from "react";

import { cn } from "../lib/utils";

function Input({ className, type, style, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "flex h-11 w-full border border-input bg-input px-4 py-2.5 text-base transition-colors",
        "file:border-0 file:bg-transparent file:text-base file:font-medium",
        "placeholder:text-muted-foreground",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      style={{ borderRadius: '0.875rem', ...style }}
      {...props}
    />
  );
}

export { Input };
