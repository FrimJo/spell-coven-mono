import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../lib/utils.js";
import { AlertCircle, AlertTriangle, Info } from "lucide-react";

const inlineMessageVariants = cva(
  "flex items-start gap-3 rounded-lg border p-4 text-sm",
  {
    variants: {
      variant: {
        error: "border-destructive/50 bg-destructive/10 text-destructive",
        warning:
          "border-yellow-500/50 bg-yellow-500/10 text-yellow-700 dark:text-yellow-400",
        info: "border-blue-500/50 bg-blue-500/10 text-blue-700 dark:text-blue-400",
      },
    },
    defaultVariants: {
      variant: "info",
    },
  },
);

const iconMap = {
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
};

export interface InlineMessageProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof inlineMessageVariants> {
  /** Message variant */
  variant?: "error" | "warning" | "info";
  /** Message text to display */
  message: string;
  /** Optional title */
  title?: string;
}

export function InlineMessage({
  variant = "info",
  message,
  title,
  className,
  ...props
}: InlineMessageProps) {
  const Icon = iconMap[variant];

  return (
    <div
      role="alert"
      className={cn(inlineMessageVariants({ variant }), className)}
      {...props}
    >
      <Icon className="h-5 w-5 flex-shrink-0" aria-hidden="true" />
      <div className="flex-1 space-y-1">
        {title && <p className="font-medium">{title}</p>}
        <p className={cn(!title && "font-medium")}>{message}</p>
      </div>
    </div>
  );
}

InlineMessage.displayName = "InlineMessage";
