import { useState } from "react";
import { LoaderCircle, Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { documentDigits } from "@/lib/documentMasks";
import { isValidCnpj, lookupCnpj, type CnpjLookupResult } from "@/lib/cnpjLookup";

type Props = {
  cnpj: string;
  onFound: (data: CnpjLookupResult, cnpjConsultado: string) => void;
  duplicateMessage?: string;
  disabled?: boolean;
};

/** Consulta somente sob clique e nunca altera o cadastro sem a confirmação de salvar. */
export default function CnpjLookupButton({ cnpj, onFound, duplicateMessage, disabled = false }: Props) {
  const [loading, setLoading] = useState(false);
  const value = documentDigits(cnpj);
  const validLength = value.length === 14;

  async function consult() {
    if (loading || disabled) return;
    if (duplicateMessage) return toast.warning(duplicateMessage);
    if (!isValidCnpj(value)) return toast.error("Informe um CNPJ válido com 14 dígitos.");
    setLoading(true);
    try {
      const data = await lookupCnpj(value);
      onFound(data, value);
      toast.success("CNPJ consultado. Confira os dados preenchidos antes de salvar.");
      if (data.situacaoCadastral && !/ATIVA/i.test(data.situacaoCadastral)) {
        toast.warning(`Situação cadastral informada pela consulta: ${data.situacaoCadastral}`);
      }
    } catch (error: any) {
      const status = Number(error?.response?.status ?? 0);
      const message = typeof error?.response?.data?.message === "string"
        ? error.response.data.message
        : [502, 503, 504].includes(status)
          ? "Serviço temporariamente indisponível (erro " + status + "). Tente novamente em instantes ou preencha manualmente."
          : error?.code === "ECONNABORTED" || !error?.response
            ? "Sem resposta do servidor. Verifique sua conexão e tente novamente, ou preencha manualmente."
            : error?.message || "Não foi possível consultar o CNPJ. Preencha manualmente.";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  return <Button
    type="button"
    variant="outline"
    size="icon"
    className="h-10 w-10 shrink-0"
    title={validLength ? "Consultar CNPJ na BrasilAPI" : "Digite os 14 dígitos do CNPJ para consultar"}
    aria-label="Consultar CNPJ"
    disabled={!validLength || disabled || loading}
    onClick={() => void consult()}
  >{loading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}</Button>;
}
