/** Diagnósticos públicos permitidos do conector; nunca expor corpo arbitrário, cabeçalhos ou segredos. */
const REJECTION_GUIDANCE: Record<string, string> = {
  ENVIRONMENT_MISMATCH: "O Worker e o conector estão em ambientes diferentes (produção/homologação). Compare o /health local com o ambiente publicado no Radasa e alinhe ambos antes de continuar.",
  COMPANY_MISMATCH: "O CNPJ da empresa selecionada no Radasa difere do CNPJ configurado no conector. Confira o emitente em Cadastros > Empresa; não substitua o certificado sem verificar o titular.",
  INVALID_REQUEST: "O conector rejeitou o formato da requisição. Verifique se Worker e conector utilizam versões compatíveis.",
  INVALID_JSON: "O conector recebeu um JSON inválido. Verifique a atualização do Worker e do conector.",
  INVALID_QUERY: "A consulta enviada ao conector contém parâmetros inválidos. Confira a versão publicada.",
  SERVICE_NOT_ALLOWED: "O serviço solicitado não é permitido no conector instalado. Atualize/verifique as versões antes de continuar.",
  METHOD_NOT_ALLOWED: "O método da operação foi rejeitado pelo conector. Confira a versão publicada.",
  HEADER_NOT_ALLOWED: "O conector rejeitou um cabeçalho da operação. Confira a versão publicada.",
  INVALID_HEADER: "O conector recebeu um cabeçalho inválido. Confira a versão publicada.",
  PAYLOAD_TOO_LARGE: "O tamanho da requisição ultrapassou o limite permitido pelo conector.",
};

export function safeConnectorRejection(httpStatus: number, raw: string): {
  connectorCode?: string;
  recommendedNextStep: string;
} {
  const fallback = httpStatus === 401 || httpStatus === 403
    ? "O acesso ao conector foi negado. Confira a chave de autenticação configurada no PC e no Worker e as regras de acesso do túnel; não compartilhe os segredos."
    : "Confirme os ambientes em /health e no CIOT do Radasa. Caso coincidam, confira o CNPJ emitente e a versão do conector. Não reenvie a operação sem consultar seu estado.";
  if (typeof raw !== "string" || raw.length > 4096) return { recommendedNextStep: fallback };
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object" || Array.isArray(value)) return { recommendedNextStep: fallback };
    const code = (value as { error?: unknown }).error;
    if (typeof code !== "string" || !Object.hasOwn(REJECTION_GUIDANCE, code))
      return { recommendedNextStep: fallback };
    return { connectorCode: code, recommendedNextStep: REJECTION_GUIDANCE[code] };
  } catch {
    return { recommendedNextStep: fallback };
  }
}
