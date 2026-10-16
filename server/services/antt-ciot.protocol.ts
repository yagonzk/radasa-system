/** Wire format from ANTT DCS PEF, including stringified validation arrays. */
export const digits = (value: unknown) =>
  String(value ?? "").replace(/\D/g, "");
export function serviceEndpoint(base: string, path: string, generator = false) {
  const url = new URL(base);
  if (
    url.protocol !== "https:" ||
    !["appservices.antt.gov.br", "appservices-hml.antt.gov.br"].includes(
      url.hostname,
    ) ||
    url.username ||
    url.password ||
    url.port
  ) {
    throw new Error(
      "O serviço CIOT deve usar o endereço HTTPS oficial da ANTT.",
    );
  }
  const root = url.pathname.replace(/\/+$/, "").replace(/\/api$/i, "");
  if (root.toLowerCase() !== "/pefservices" || !/^[a-zA-Z]+$/.test(path))
    throw new Error("Caminho de serviço ANTT inválido.");
  return `${url.origin}${root}/${generator ? "" : "api/"}${path}`;
}
function list(value: unknown): string[] {
  if (value === undefined || value === null || value === "") return [];
  if (Array.isArray(value)) return value.flatMap(list);
  if (typeof value === "string") {
    try {
      const decoded = JSON.parse(value);
      if (Array.isArray(decoded)) return decoded.flatMap(list);
    } catch {
      /* plain message */
    }
  }
  return String(value)
    .split(/,(?=\d{3}(?:,|$))/)
    .filter(Boolean);
}
export const messagesFrom = (result: any) => list(result?.Mensagem);
export const codesFrom = (result: any) =>
  list(result?.Codigo)
    .flatMap((code) => code.split(","))
    .map((code) => code.trim());
export function parseDeclaration(result: any, expectedId: string) {
  const raw = digits(
    result?.CodigoIdentificacaoOperacao || result?.IdOperacaoTransporte,
  );
  const id = raw.length === 16 ? raw.slice(0, 12) : raw;
  const dv = raw.length === 16 ? raw.slice(12) : result?.CodigoVerificador;
  const verifier =
    dv !== null && dv !== undefined && /^\d{1,4}$/.test(String(dv))
      ? String(dv).padStart(4, "0")
      : "";
  return {
    success:
      codesFrom(result).includes("110") &&
      id === expectedId &&
      id.length === 12 &&
      verifier.length === 4,
    id,
    verifier,
  };
}
export function generatedOperationId(result: any) {
  const id = String(result?.Dados?.CIOT ?? "").trim();
  if (result?.Sucesso !== true || !/^\d{12}$/.test(id))
    throw new Error(
      `A ANTT não gerou o identificador da operação. ${messagesFrom(result).join(" | ") || "Verifique a habilitação do gerador oficial."}`,
    );
  return id;
}
export function paymentEntries(
  payment: Record<string, unknown>,
  installments: Array<{
    numeroParcela: number;
    dataVencimento: string;
    valorParcela: number;
  }> = [],
) {
  if (payment.IndPagamento !== 1) return [payment];
  return installments.map((item) => ({
    ...payment,
    NumeroParcela: item.numeroParcela,
    DataVencimento: item.dataVencimento,
    ValorParcela: item.valorParcela,
  }));
}

/** A bounded, plain-text diagnostic; never forwards HTML, cookies or request credentials. */
export function upstreamResponseSummary(raw: string) {
  const cleaned = raw
    .slice(0, 32768)
    .replace(
      /-----BEGIN [^-]*PRIVATE KEY-----[\s\S]*?(?:-----END [^-]*PRIVATE KEY-----|$)/gi,
      "[chave privada oculta]",
    )
    .replace(/<(script|style)\b[^>]*>[\s\S]*?(?:<\/\1\s*>|$)/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/Bearer\s+[A-Za-z0-9._~+\/=-]+/gi, "Bearer [oculto]")
    .replace(
      /\b(authorization|senha|password|passphrase|token|access_token|refresh_token|chave|secret)\b["']?\s*[:=]\s*(?:"[^"]*"|'[^']*'|[^\s,;<>]+)/gi,
      "$1=[oculto]",
    )
    .replace(/[A-Za-z0-9+/=_-]{100,}/g, "[dado longo oculto]")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return {
    responseExcerpt:
      cleaned.slice(0, 1600) || "(Resposta vazia ou sem texto legível)",
    responseTruncated: raw.length > 1600 || cleaned.length > 1600,
  };
}
