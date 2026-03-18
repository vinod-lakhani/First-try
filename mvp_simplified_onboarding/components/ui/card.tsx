import * as React from "react";
import { cn } from "@/lib/utils";

function Card({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800 shadow-sm",
        className
      )}
      {...props}
    />
  );
}

function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("px-6 pt-6", className)} {...props} />;
}

function CardTitle({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("text-lg font-semibold", className)} {...props} />;
}

function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("p-6 pt-4", className)} {...props} />;
}

export { Card, CardContent, CardHeader, CardTitle };
