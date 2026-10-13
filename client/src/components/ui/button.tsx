import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-medium transition-all duration-200 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/40 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive active:scale-[0.99]",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground shadow-sm hover:bg-primary/92 hover:shadow-md",
        destructive:
          "bg-destructive text-white shadow-sm hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/70",
        outline:
          "border bg-card/80 shadow-xs hover:bg-accent hover:border-primary/20 dark:bg-transparent dark:border-input dark:hover:bg-input/50",
        secondary:
          "bg-secondary text-secondary-foreground shadow-xs hover:bg-secondary/85",
        ghost:
          "hover:bg-accent dark:hover:bg-accent/50",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2 has-[>svg]:px-3",
        sm: "h-9 rounded-lg gap-1.5 px-3 has-[>svg]:px-2.5",
        lg: "h-11 rounded-xl px-6 has-[>svg]:px-4",
        icon: "size-10",
        "icon-sm": "size-8 rounded-lg",
        "icon-lg": "size-11 rounded-xl",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

const destructiveActionPattern = /(remov|exclu|apag|delet|arquiv|descart)/i;

function extractButtonText(node: React.ReactNode): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(extractButtonText).join(" ");
  if (React.isValidElement(node)) return extractButtonText((node.props as { children?: React.ReactNode }).children);
  return "";
}

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot : "button";
  const titleText = typeof props.title === "string" ? props.title : "";
  const ariaText = typeof props["aria-label"] === "string" ? props["aria-label"] : "";
  const childrenText = extractButtonText(props.children);
  const isDestructiveAction = [titleText, ariaText, childrenText].some((value) => destructiveActionPattern.test(value));
  const destructiveClassName = isDestructiveAction
    ? variant === "ghost"
      ? "text-destructive hover:text-destructive hover:bg-destructive/10"
      : variant === "outline"
        ? "border-destructive/40 text-destructive hover:text-destructive hover:bg-destructive/10"
        : variant === "secondary"
          ? "bg-destructive/10 text-destructive hover:bg-destructive/15 hover:text-destructive"
          : variant === "link"
            ? "text-destructive hover:text-destructive"
            : !variant || variant === "default"
              ? "bg-destructive text-white hover:bg-destructive/90"
              : ""
    : "";

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }), destructiveClassName)}
      {...props}
    />
  );
}

export { Button, buttonVariants };
