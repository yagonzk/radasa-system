import { FormEvent, useMemo, useState } from "react";
import { ArrowLeft, CheckCircle2, Eye, EyeOff, LockKeyhole, Moon, Sun, Truck } from "lucide-react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useTheme } from "@/contexts/ThemeContext";
import { useAuth } from "@/contexts/AuthContext";

function getApiMessage(error: any, fallback: string) {
  return error?.response?.data?.message || error?.response?.data?.error || fallback;
}

export default function ResetPassword() {
  const [, navigate] = useLocation();
  const { theme, toggleTheme } = useTheme();
  const { logout } = useAuth();
  const token = useMemo(() => new URLSearchParams(window.location.search).get("token")?.trim() || "", []);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [completed, setCompleted] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!token) {
      toast.error("O link de recuperação não possui um token válido.");
      return;
    }
    if (password !== confirmPassword) {
      toast.error("As senhas não coincidem.");
      return;
    }

    setSubmitting(true);
    try {
      const { data } = await api.post<{ message: string }>("/auth/reset-password", {
        token,
        newPassword: password,
      });
      logout();
      setCompleted(true);
      toast.success(data.message);
    } catch (error) {
      toast.error(getApiMessage(error, "Não foi possível redefinir a senha."));
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass = "h-12 w-full rounded-xl border border-input bg-transparent pl-11 pr-11 text-sm outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10";

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4 py-6">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(59,130,246,0.16),transparent_38%),radial-gradient(circle_at_bottom_left,rgba(59,130,246,0.10),transparent_35%)]" />

      <button type="button" onClick={toggleTheme} className="absolute right-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow-sm transition hover:text-primary" aria-label="Alternar tema">
        {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      </button>

      <section className="relative z-10 w-full max-w-[500px] rounded-[24px] border border-border bg-card px-6 py-7 shadow-[0_24px_80px_rgba(15,23,42,0.13)] sm:px-9 dark:shadow-[0_24px_90px_rgba(0,0,0,0.34)]">
        <div className="text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[20px] bg-gradient-to-br from-blue-500 to-blue-700 shadow-lg shadow-blue-500/20">
            <Truck className="h-8 w-8 text-white" strokeWidth={1.8} />
          </div>
          <h1 className="mt-4 text-2xl font-extrabold tracking-tight">Criar nova senha</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">Digite uma nova senha para sua conta do Radasa System.</p>
        </div>

        {completed ? (
          <div className="mt-7 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-5 text-center">
            <CheckCircle2 className="mx-auto h-9 w-9 text-emerald-600" />
            <p className="mt-3 font-semibold">Senha redefinida com sucesso</p>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">O link já foi invalidado. Entre novamente usando sua nova senha.</p>
            <button type="button" onClick={() => navigate("/")} className="mt-5 inline-flex h-11 items-center justify-center rounded-xl bg-primary px-5 text-sm font-bold text-primary-foreground transition hover:brightness-105">
              Ir para o login
            </button>
          </div>
        ) : !token ? (
          <div className="mt-7 rounded-2xl border border-destructive/20 bg-destructive/10 p-5 text-center">
            <p className="font-semibold text-destructive">Link inválido</p>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">Solicite um novo e-mail de recuperação pela tela de login.</p>
            <button type="button" onClick={() => navigate("/esqueci-senha")} className="mt-5 inline-flex h-11 items-center justify-center rounded-xl bg-primary px-5 text-sm font-bold text-primary-foreground transition hover:brightness-105">
              Solicitar novo link
            </button>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-7 space-y-4">
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold">Nova senha</span>
              <span className="relative block">
                <LockKeyhole className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input className={inputClass} type={showPassword ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Mínimo de 8 caracteres" autoComplete="new-password" minLength={8} required />
                <button type="button" onClick={() => setShowPassword((value) => !value)} className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-primary" aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}>
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </span>
            </label>

            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold">Confirmar nova senha</span>
              <span className="relative block">
                <LockKeyhole className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input className={inputClass} type={showPassword ? "text" : "password"} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="Repita a nova senha" autoComplete="new-password" minLength={8} required />
              </span>
            </label>

            <button disabled={submitting} className="h-12 w-full rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 text-base font-bold text-white shadow-lg shadow-blue-500/20 transition hover:brightness-105 disabled:opacity-60">
              {submitting ? "Redefinindo..." : "Redefinir senha"}
            </button>

            <button type="button" onClick={() => navigate("/")} className="flex w-full items-center justify-center gap-2 text-sm font-semibold text-primary hover:underline">
              <ArrowLeft className="h-4 w-4" /> Voltar para o login
            </button>
          </form>
        )}
      </section>
    </main>
  );
}
