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
    <div className="radasa-workspace-nav" role="navigation" aria-label="Áreas do CIOT">
      <div className="flex w-full min-w-max gap-2">
        {tabs.map(({ href, label, icon: Icon }) => {
          const active = location.startsWith(href);
          return (
            <Link key={href} href={href} className={cn(
              "radasa-workspace-nav__item min-h-[56px]",
              active ? "!border-primary/30 !bg-primary/10 !text-primary" : "",
            )}>
              <span className="radasa-workspace-nav__icon"><Icon className="size-[18px]" /></span><span className="radasa-workspace-nav__label">{label}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
