import { Router } from "express";

export const cnpjRoutes = Router();

function onlyDigits(value: unknown) {
  return String(value ?? "").replace(/\D/g, "");
}

function isValidCnpj(value: string) {
  if (!/^\d{14}$/.test(value) || /^(\d)\1+$/.test(value)) return false;
  const check = (size: number) => {
    let weight = size - 7;
    let sum = 0;
    for (let index = 0; index < size; index++) {
      sum += Number(value[index]) * weight;
      weight = weight === 2 ? 9 : weight - 1;
    }
    const remainder = sum % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };
  return Number(value[12]) === check(12) && Number(value[13]) === check(13);
}

function firstText(...values: unknown[]) {
  for (const value of values) {
    const text = String(value ?? "").trim();
    if (text) return text;
  }

  return "";
}

cnpjRoutes.get("/:cnpj", async (req, res, next) => {
  const cnpj = onlyDigits(req.params.cnpj);

  if (!isValidCnpj(cnpj)) {
    res.status(400).json({ message: "Informe um CNPJ válido com 14 dígitos." });
    return;
  }

  try {
    // Repetir apenas falhas transitórias da consulta pública (nunca gravações).
    // Cada tentativa tem seu próprio timeout; 503 do Worker antes da rota
    // continua dependendo da saúde/implantação da infraestrutura Cloudflare.
    let response: Response | undefined;
    for (let attempt = 0; attempt < 2; attempt++) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 7_000);
      try {
        response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`, {
          headers: { Accept: "application/json", "User-Agent": "Radasa-System/1.0" },
          signal: controller.signal,
        });
        if (![429, 500, 502, 503, 504].includes(response.status) || attempt === 1) break;
      } catch (error: any) {
        if (attempt === 1) throw error;
      } finally {
        clearTimeout(timeout);
      }
      await new Promise((resolve) => setTimeout(resolve, 400));
    }
    if (!response) throw new Error("Nenhuma resposta do serviço de consulta de CNPJ.");

    const body = (await response.json().catch(() => null)) as any;

    if (response.status === 404) {
      res.status(404).json({
        message: "CNPJ não encontrado na base de consulta.",
      });
      return;
    }

    if (!response.ok) {
      res.status(response.status === 400 ? 400 : 503).json({
        message: response.status === 429
          ? "A consulta de CNPJ está temporariamente limitada. Aguarde um momento e tente novamente."
          : "O serviço público de CNPJ está temporariamente indisponível. Tente novamente ou preencha manualmente.",
      });
      return;
    }

    if (onlyDigits(body?.cnpj) !== cnpj || !firstText(body?.razao_social, body?.nome_empresarial, body?.nome)) {
      res.status(502).json({ message: "A consulta não retornou dados válidos para este CNPJ." });
      return;
    }
    const atividadePrincipal = firstText(
      body?.cnae_fiscal_descricao,
      body?.descricao_atividade_principal,
    );

    res.json({
      cnpj: onlyDigits(body?.cnpj || cnpj),
      razaoSocial: firstText(
        body?.razao_social,
        body?.nome,
        body?.nome_empresarial,
      ),
      nomeFantasia: firstText(
        body?.nome_fantasia,
        body?.fantasia,
        body?.titulo_estabelecimento,
      ),
      inscricaoEstadual: firstText(
        body?.inscricao_estadual,
        body?.ie,
      ),
      email: firstText(body?.email),
      telefone: firstText(
        body?.ddd_telefone_1,
        body?.telefone,
        body?.ddd_telefone_2,
      ),
      cep: onlyDigits(body?.cep),
      logradouro: firstText(
        body?.descricao_tipo_de_logradouro && body?.logradouro
          ? `${body.descricao_tipo_de_logradouro} ${body.logradouro}`
          : "",
        body?.logradouro,
      ),
      numero: firstText(body?.numero),
      complemento: firstText(body?.complemento),
      bairro: firstText(body?.bairro),
      cidade: firstText(body?.municipio, body?.cidade),
      uf: firstText(body?.uf).toUpperCase(),
      situacaoCadastral: firstText(
        body?.descricao_situacao_cadastral,
        body?.situacao,
      ),
      dataAbertura: firstText(
        body?.data_inicio_atividade,
        body?.abertura,
      ),
      naturezaJuridica: firstText(
        body?.natureza_juridica,
        body?.descricao_natureza_juridica,
      ),
      atividadePrincipal,
    });
  } catch (error: any) {
    if (error?.name === "AbortError") {
      res.status(504).json({
        message: "A consulta do CNPJ demorou demais. Tente novamente.",
      });
      return;
    }

    console.error("Falha na consulta pública de CNPJ:", error);
    res.status(503).json({ message: "Não foi possível acessar o serviço público de CNPJ. Tente novamente ou preencha manualmente." });
  }
});
