import * as React from "react";
import { cn } from "@/lib/utils";

export type WorkspaceItem = {
  value: string;
  label: string;
  description?: string;
  icon?: React.ComponentType<{ className?: string }>;
};

export function WorkspaceNavigation({
  items,
  value,
  onValueChange,
  className,
  label = "Seções da página",
}: {
  items: readonly WorkspaceItem[];
  value: string;
  onValueChange: (next: string) => void;
  className?: string;
  label?: string;
}) {
  const ref = React.useRef<HTMLDivElement>(null);

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const index = items.findIndex((item) => item.value === value);
    const nextIndex = event.key === "Home" ? 0 : event.key === "End" ? items.length - 1
      : (index + (event.key === "ArrowRight" ? 1 : -1) + items.length) % items.length;
    const next = items[nextIndex];
    if (!next) return;
    onValueChange(next.value);
    const buttons = ref.current?.querySelectorAll<HTMLButtonElement>("[role=tab]");
    buttons?.[nextIndex]?.focus();
  };

  return (
    <div className={cn("radasa-workspace-nav", className)} role="tablist" aria-label={label} ref={ref} onKeyDown={onKeyDown}>
      {items.map(({ value: key, label: name, description, icon: Icon }) => {
        const active = value === key;
        return (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            data-state={active ? "active" : "inactive"}
            onClick={() => onValueChange(key)}
            className="radasa-workspace-nav__item"
          >
            {Icon && <span className="radasa-workspace-nav__icon"><Icon className="size-[18px]" /></span>}
            <span className="min-w-0">
              <span className="radasa-workspace-nav__label">{name}</span>
              {description && <span className="radasa-workspace-nav__description">{description}</span>}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function WorkspacePanel({
  active,
  children,
  className,
}: {
  active: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return <section role="tabpanel" hidden={!active} className={cn("radasa-workspace-panel min-w-0", className)}>{children}</section>;
}
