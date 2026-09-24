const DNIT_PUBLIC_URL = "https://servicos.dnit.gov.br/multas/";

export type DnitPublicInfraction = {
  autoInfracao: string;
  codigoInfracao: string;
  dataInfracao: string;
  hora: string;
  local: string;
  descricao: string;
  valorOriginal: number;
  valorAtual: number;
  vencimento: string | null;
  status: "PENDENTE" | "PAGO" | "EM_RECURSO" | "CANCELADO";
};

function decodeHtml(value: string) {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function textFromHtml(value: string) {
  return decodeHtml(value.replace(/<br\s*\/?\s*>/gi, " ").replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

function attr(tag: string, name: string) {
  const match = tag.match(new RegExp(`${name}\\s*=\\s*["']([^"']*)["']`, "i"));
  return match?.[1] ?? "";
}

function normalizeLabel(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function brDate(value: string): string | null {
  const match = value.match(/\b(\d{2})\/(\d{2})\/(\d{4})\b/);
  if (!match) return null;
  return `${match[3]}-${match[2]}-${match[1]}`;
}

function brMoney(value: string) {
  const match = value.match(/(?:R\$\s*)?(-?\d{1,3}(?:\.\d{3})*,\d{2}|-?\d+[.,]\d{2})/);
  if (!match) return 0;
  const raw = match[1];
  const normalized = raw.includes(",") ? raw.replace(/\./g, "").replace(",", ".") : raw;
  const number = Number(normalized);
  return Number.isFinite(number) ? number : 0;
}

function mapStatus(value: string): DnitPublicInfraction["status"] {
  const normalized = normalizeLabel(value);
  if (/cancel|anulad/.test(normalized)) return "CANCELADO";
  if (/pago|quitad|baixad/.test(normalized)) return "PAGO";
  if (/recurso|defesa/.test(normalized)) return "EM_RECURSO";
  return "PENDENTE";
}

export function buildDnitQueryFromForm(html: string, placa: string, renavam: string, baseUrl = DNIT_PUBLIC_URL) {
  const forms = [...html.matchAll(/<form\b[^>]*>[\s\S]*?<\/form>/gi)].map((match) => match[0]);
  const form = forms.find((candidate) => /placa/i.test(candidate) && /renavam/i.test(candidate));
  if (!form) return null;

  const opening = form.match(/<form\b[^>]*>/i)?.[0] ?? "<form>";
  const method = (attr(opening, "method") || "GET").toUpperCase() === "POST" ? "POST" : "GET";
  const action = attr(opening, "action") || baseUrl;
  const url = new URL(action, baseUrl);
  const params = new URLSearchParams();
  let placaName = "placa";
  let renavamName = "renavam";

  for (const input of form.match(/<input\b[^>]*>/gi) ?? []) {
    const name = attr(input, "name");
    if (!name) continue;
    const normalized = normalizeLabel(name);
    if (normalized.includes("placa")) placaName = name;
    if (normalized.includes("renavam")) renavamName = name;
    const type = attr(input, "type").toLowerCase();
    const value = attr(input, "value");
    if ((type === "hidden" || (!normalized.includes("placa") && !normalized.includes("renavam"))) && value) params.set(name, value);
  }
  params.set(placaName, placa.replace(/[^A-Za-z0-9]/g, "").toUpperCase());
  params.set(renavamName, renavam.replace(/\D/g, ""));

  if (method === "GET") {
    for (const [key, value] of params) url.searchParams.set(key, value);
    return { url: url.toString(), method, body: undefined as string | undefined };
  }
  return { url: url.toString(), method, body: params.toString() };
}

function findIndex(headers: string[], patterns: RegExp[]) {
  return headers.findIndex((header) => patterns.some((pattern) => pattern.test(normalizeLabel(header))));
}

export function parseDnitInfractionsHtml(html: string): DnitPublicInfraction[] {
  if (/nada consta|nenhuma (?:multa|infra[cç][aã]o)|n[aã]o foram encontrad[ao]s/i.test(textFromHtml(html))) return [];
  const tables = [...html.matchAll(/<table\b[^>]*>[\s\S]*?<\/table>/gi)].map((match) => match[0]);
  const result: DnitPublicInfraction[] = [];

  for (const table of tables) {
    const rows = [...table.matchAll(/<tr\b[^>]*>[\s\S]*?<\/tr>/gi)].map((match) => match[0]);
    if (rows.length < 2) continue;
    const cells = (row: string) => [...row.matchAll(/<t[hd]\b[^>]*>([\s\S]*?)<\/t[hd]>/gi)].map((match) => textFromHtml(match[1]));
    const headers = cells(rows[0]);
    if (!headers.length) continue;

    const idxAuto = findIndex(headers, [/auto/, /ait/]);
    const idxData = findIndex(headers, [/data/, /data hora/]);
    const idxDesc = findIndex(headers, [/descri/, /infra[cç][aã]o/]);
    const idxLocal = findIndex(headers, [/local/]);
    const idxCodigo = findIndex(headers, [/enquadr/, /c[oó]digo/]);
    const idxValor = findIndex(headers, [/valor/, /d[eé]bito/]);
    const idxVenc = findIndex(headers, [/venc/]);
    const idxStatus = findIndex(headers, [/situa/, /status/, /fase/]);
    if (idxAuto < 0 && idxData < 0 && idxDesc < 0) continue;

    for (const row of rows.slice(1)) {
      const values = cells(row);
      if (!values.length) continue;
      const dateText = idxData >= 0 ? values[idxData] || "" : values.join(" ");
      const dataInfracao = brDate(dateText);
      if (!dataInfracao) continue;
      const hora = dateText.match(/\b([01]\d|2[0-3]):([0-5]\d)\b/)?.[0] || "";
      const valorOriginal = idxValor >= 0 ? brMoney(values[idxValor] || "") : 0;
      result.push({
        autoInfracao: idxAuto >= 0 ? values[idxAuto] || "" : "",
        codigoInfracao: idxCodigo >= 0 ? values[idxCodigo] || "" : "",
        dataInfracao,
        hora,
        local: idxLocal >= 0 ? values[idxLocal] || "" : "",
        descricao: idxDesc >= 0 ? values[idxDesc] || "" : "",
        valorOriginal,
        valorAtual: valorOriginal,
        vencimento: idxVenc >= 0 ? brDate(values[idxVenc] || "") : null,
        status: idxStatus >= 0 ? mapStatus(values[idxStatus] || "") : "PENDENTE",
      });
    }
  }

  return result;
}

function cookiesFrom(response: Response) {
  const headers = response.headers as Headers & { getSetCookie?: () => string[] };
  const values = typeof headers.getSetCookie === "function" ? headers.getSetCookie() : [response.headers.get("set-cookie") || ""];
  return values.filter(Boolean).map((value) => value.split(";", 1)[0]).join("; ");
}

async function fetchWithTimeout(url: string, init: RequestInit = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    return await fetch(url, { ...init, signal: controller.signal, redirect: "follow" });
  } finally {
    clearTimeout(timer);
  }
}

export async function consultarDnitPublico(placa: string, renavam: string) {
  const cleanPlaca = placa.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  const cleanRenavam = renavam.replace(/\D/g, "");
  if (!cleanPlaca || !cleanRenavam) throw new Error("Placa e RENAVAM são obrigatórios para consultar o DNIT.");

  const headers = {
    accept: "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8",
    "user-agent": "Mozilla/5.0 (compatible; RadasaSystem/1.0; +https://radasa.com.br)",
  };
  const landing = await fetchWithTimeout(DNIT_PUBLIC_URL, { headers });
  if (!landing.ok) throw new Error(`Portal do DNIT indisponível (HTTP ${landing.status}).`);
  const landingHtml = await landing.text();
  const query = buildDnitQueryFromForm(landingHtml, cleanPlaca, cleanRenavam, landing.url || DNIT_PUBLIC_URL);

  let responseText = landingHtml;
  if (query) {
    const cookie = cookiesFrom(landing);
    const response = await fetchWithTimeout(query.url, {
      method: query.method,
      headers: {
        ...headers,
        ...(query.method === "POST" ? { "content-type": "application/x-www-form-urlencoded" } : {}),
        ...(cookie ? { cookie } : {}),
        referer: landing.url || DNIT_PUBLIC_URL,
      },
      body: query.body,
    });
    if (!response.ok) throw new Error(`Consulta do DNIT falhou (HTTP ${response.status}).`);
    responseText = await response.text();
  } else {
    const fallback = new URL(landing.url || DNIT_PUBLIC_URL);
    fallback.searchParams.set("placa", cleanPlaca);
    fallback.searchParams.set("renavam", cleanRenavam);
    const response = await fetchWithTimeout(fallback.toString(), { headers });
    if (response.ok) responseText = await response.text();
  }

  const multas = parseDnitInfractionsHtml(responseText);
  const plain = textFromHtml(responseText);
  if (!multas.length && !/nada consta|nenhuma (?:multa|infra[cç][aã]o)|n[aã]o foram encontrad[ao]s/i.test(plain)) {
    throw new Error("O portal público do DNIT mudou o formato da consulta. Nenhum dado foi importado.");
  }
  return { fonte: "DNIT_PUBLICO", multas };
}
