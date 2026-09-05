export type EstoqueNfeFornecedor = {
  documento: string;
  razaoSocial: string;
  nomeFantasia: string;
  inscricaoEstadual: string;
  telefone: string;
  endereco: string;
  cidade: string;
  uf: string;
  cep: string;
};

export type EstoqueNfeItem = {
  nItem: string;
  codigoFornecedor: string;
  nome: string;
  ncm: string;
  unidade: string;
  quantidade: number;
  valorUnitario: number;
  valorTotal: number;
};

export type EstoqueNfeParsed = {
  chave: string;
  numero: string;
  serie: string;
  dataEmissao: string;
  fornecedor: EstoqueNfeFornecedor;
  itens: EstoqueNfeItem[];
};

const decodeXml = (value: string) => value
  .replace(/&lt;/g, "<")
  .replace(/&gt;/g, ">")
  .replace(/&quot;/g, '"')
  .replace(/&apos;/g, "'")
  .replace(/&amp;/g, "&");

function tag(xml: string, name: string) {
  const match = new RegExp(`<(?:(?:\\w+):)?${name}\\b[^>]*>([\\s\\S]*?)<\\/(?:(?:\\w+):)?${name}>`, "i").exec(xml);
  return match ? decodeXml(match[1].replace(/<[^>]+>/g, "").trim()) : "";
}

function block(xml: string, name: string) {
  const match = new RegExp(`<(?:(?:\\w+):)?${name}\\b[^>]*>([\\s\\S]*?)<\\/(?:(?:\\w+):)?${name}>`, "i").exec(xml);
  return match?.[1] ?? "";
}

function numberValue(value: string) {
  const parsed = Number(String(value || "0").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}

export function parseEstoqueNfeXml(xml: string): EstoqueNfeParsed {
  const source = String(xml ?? "").trim();
  if (!source || !/<(?:\w+:)?(?:NFe|nfeProc)\b/i.test(source)) throw new Error("XML de NF-e inválido.");

  const infMatch = /<(?:(?:\w+):)?infNFe\b([^>]*)>([\s\S]*?)<\/(?:(?:\w+):)?infNFe>/i.exec(source);
  const infAttrs = infMatch?.[1] ?? "";
  const inf = infMatch?.[2] ?? source;
  const idMatch = /\bId\s*=\s*["']NFe(\d{44})["']/i.exec(infAttrs);
  const emit = block(inf, "emit");
  const enderecoEmit = block(emit, "enderEmit");
  const ide = block(inf, "ide");

  const detRegex = /<(?:(?:\w+):)?det\b([^>]*)>([\s\S]*?)<\/(?:(?:\w+):)?det>/gi;
  const itens: EstoqueNfeItem[] = [];
  let detMatch: RegExpExecArray | null;
  while ((detMatch = detRegex.exec(inf))) {
    const attrs = detMatch[1] ?? "";
    const det = detMatch[2] ?? "";
    const prod = block(det, "prod") || det;
    const nItem = /\bnItem\s*=\s*["']([^"']+)["']/i.exec(attrs)?.[1] ?? String(itens.length + 1);
    const quantidade = numberValue(tag(prod, "qCom"));
    const valorUnitario = numberValue(tag(prod, "vUnCom"));
    itens.push({
      nItem,
      codigoFornecedor: tag(prod, "cProd"),
      nome: tag(prod, "xProd"),
      ncm: tag(prod, "NCM"),
      unidade: tag(prod, "uCom"),
      quantidade,
      valorUnitario,
      valorTotal: numberValue(tag(prod, "vProd")) || quantidade * valorUnitario,
    });
  }

  if (!itens.length) throw new Error("Nenhum produto encontrado na NF-e.");
  const documento = (tag(emit, "CNPJ") || tag(emit, "CPF")).replace(/\D/g, "");
  const logradouro = tag(enderecoEmit, "xLgr");
  const numeroEndereco = tag(enderecoEmit, "nro");
  const bairro = tag(enderecoEmit, "xBairro");
  const cep = tag(enderecoEmit, "CEP");
  const endereco = [logradouro, numeroEndereco, bairro, cep ? `CEP ${cep}` : ""].filter(Boolean).join(", ");
  const dataEmissaoRaw = tag(ide, "dhEmi") || tag(ide, "dEmi");

  return {
    chave: idMatch?.[1] ?? "",
    numero: tag(ide, "nNF"),
    serie: tag(ide, "serie"),
    dataEmissao: dataEmissaoRaw ? dataEmissaoRaw.slice(0, 10) : "",
    fornecedor: {
      documento,
      razaoSocial: tag(emit, "xNome"),
      nomeFantasia: tag(emit, "xFant"),
      inscricaoEstadual: tag(emit, "IE"),
      telefone: tag(enderecoEmit, "fone"),
      endereco,
      cidade: tag(enderecoEmit, "xMun"),
      uf: tag(enderecoEmit, "UF").toUpperCase().slice(0, 2),
      cep,
    },
    itens,
  };
}
