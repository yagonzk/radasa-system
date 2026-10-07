import type { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";

export interface AgroPlannedItem {
  title: string;
  description: string;
  icon: ReactNode;
}

export default function AgroSectionPlaceholder({
  eyebrow,
  title,
  description,
  items,
}: {
  eyebrow: string;
  title: string;
  description: string;
  items: AgroPlannedItem[];
}) {
  return (
    <div className="space-y-6">
      <div>
        <div className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">{eyebrow}</div>
        <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">{description}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {items.map((item) => (
          <Card key={item.title} className="border-border/70">
            <CardContent className="p-5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">{item.icon}</div>
              <h2 className="mt-4 font-semibold">{item.title}</h2>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">{item.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="rounded-xl border border-dashed bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
        Estrutura visual preparada. Os dados e ações desta área serão conectados nas próximas etapas, sem utilizar tabelas do módulo Transportes.
      </div>
    </div>
  );
}
