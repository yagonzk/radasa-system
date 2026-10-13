import { AlertTriangle, RotateCcw } from "lucide-react";
import { Component, type ReactNode } from "react";

interface Props { children: ReactNode }
interface State { hasError: boolean }

/** Erros de chunks e renderizações apresentam uma recuperação clara sem expor stack traces. */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-background p-5 text-foreground">
        <div className="w-full max-w-md rounded-3xl border border-border bg-card p-7 text-center shadow-lg sm:p-9" role="alert">
          <span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
            <AlertTriangle className="size-7" />
          </span>
          <h1 className="mt-5 text-xl font-bold">Não foi possível abrir esta tela</h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Ocorreu uma falha ao carregar o sistema. Tente atualizar a página para recuperar o acesso.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-6 inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <RotateCcw className="size-4" /> Atualizar página
          </button>
        </div>
      </div>
    );
  }
}
