import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center rounded-full text-sm font-semibold transition disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/70",
  {
    variants: {
      variant: {
        default:
          "bg-gradient-to-r from-sky-400 via-cyan-300 to-violet-400 px-4 py-2 text-slate-950 shadow-lg shadow-cyan-500/10 hover:brightness-110",
        secondary: "bg-white/8 px-4 py-2 text-white hover:bg-white/12",
        ghost: "px-3 py-2 text-slate-300 hover:bg-white/6",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, ...props }, ref) => (
    <button ref={ref} className={cn(buttonVariants({ variant }), className)} {...props} />
  ),
);
Button.displayName = "Button";

export { Button, buttonVariants };
