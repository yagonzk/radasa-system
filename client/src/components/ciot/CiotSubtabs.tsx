import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { FilePlus2, Files, Settings2 } from "lucide-react";

const tabs = [
  { href: "/ciot/gerar", label: "Gerar CIOTs", icon: FilePlus2 },
  { href: "/ciot/gerados", label: "CIOTs gerados", icon: Files },
  { href: "/ciot/configuracao", label: "Configuração ANTT", icon: Settings2 },
];

export default function CiotSubtabs() {
  const [location] = useLocation();
  return (
    <div className="overflow-x-auto rounded-xl border bg-card p-1">
      <div className="flex min-w-max gap-1">
        {tabs.map(({ href, label, icon: Icon }) => {
          const active = location.startsWith(href);
          return (
            <Link key={href} href={href} className={cn(
              "inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              active ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}>
              <Icon className="h-4 w-4" />{label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
