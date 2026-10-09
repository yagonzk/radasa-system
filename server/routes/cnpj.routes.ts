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
    // BrasilAPI é a fonte principal. CNPJ.ws é consultada quando a primeira
    // fonte estiver indisponível, retornar dados inválidos ou exceder o timeout.
    // Não repetir imediatamente chamadas lentas para a mesma fonte.
    async function requestJson(url: string, timeoutMs: number) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await fetch(url, {
          headers: { Accept: "application/json", "User-Agent": "Radasa-System/1.0" },
          signal: controller.signal,
        });
        const data = (await response.json().catch(() => null)) as any;
        return { status: response.status, ok: response.ok, data };
      } finally {
        clearTimeout(timer);
      }
    }

    let brasil: Awaited<ReturnType<typeof requestJson>> | undefined;
    try {
      brasil = await requestJson(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`, 5_000);
    } catch (error) {
      console.warn("Consulta BrasilAPI falhou; usando fonte alternativa:", error);
    }

    let body: any = brasil?.ok ? brasil.data : null;
    let fonte: "brasilapi" | "cnpjws" = "brasilapi";
    const brasilValido = body && onlyDigits(body.cnpj) === cnpj &&
      firstText(body.razao_social, body.nome_empresarial, body.nome);

    let alternativa: Awaited<ReturnType<typeof requestJson>> | undefined;
    if (!brasilValido) {
      try {
        alternativa = await requestJson(`https://publica.cnpj.ws/cnpj/${cnpj}`, 8_000);
        if (alternativa.ok && onlyDigits(alternativa.data?.estabelecimento?.cnpj) === cnpj &&
            firstText(alternativa.data?.razao_social)) {
          body = alternativa.data;
          fonte = "cnpjws";
        } else {
          body = null;
        }
      } catch (error) {
        console.warn("Consulta alternativa CNPJ.ws falhou:", error);
        body = null;
      }
    }

    if (!body) {
      const notFound = brasil?.status === 404 && alternativa?.status === 404;
      res.status(notFound ? 404 : 503).json({
        message: notFound
          ? "CNPJ não encontrado nas bases de consulta."
          : "Os serviços públicos de consulta de CNPJ estão temporariamente indisponíveis. Tente novamente ou preencha manualmente.",
      });
      return;
    }

    const est = fonte === "cnpjws" ? body.estabelecimento ?? {} : body;
    const cnpjRetornado = fonte === "cnpjws" ? est.cnpj : body.cnpj;
    if (onlyDigits(cnpjRetornado) !== cnpj) {
      res.status(502).json({ message: "A consulta retornou um CNPJ diferente do solicitado." });
      return;
    }

    res.json({
      cnpj,
      razaoSocial: firstText(body.razao_social, body.nome, body.nome_empresarial),
      nomeFantasia: firstText(est.nome_fantasia, est.fantasia, est.titulo_estabelecimento),
      inscricaoEstadual: firstText(
        est.inscricoes_estaduais?.[0]?.inscricao_estadual,
        est.inscricao_estadual, est.ie,
      ),
      email: firstText(est.email),
      telefone: firstText(
        est.ddd_telefone_1,
        est.ddd1 && est.telefone1 ? `${est.ddd1}${est.telefone1}` : "",
        est.telefone, est.ddd_telefone_2,
      ),
      cep: onlyDigits(est.cep),
      logradouro: firstText(
        est.descricao_tipo_de_logradouro && est.logradouro
          ? `${est.descricao_tipo_de_logradouro} ${est.logradouro}` : "",
        est.tipo_logradouro && est.logradouro
          ? `${est.tipo_logradouro} ${est.logradouro}` : "",
        est.logradouro,
      ),
      numero: firstText(est.numero),
      complemento: firstText(est.complemento),
      bairro: firstText(est.bairro),
      cidade: firstText(est.cidade?.nome, est.municipio, est.cidade),
      uf: firstText(est.estado?.sigla, est.uf).toUpperCase(),
      situacaoCadastral: firstText(
        est.situacao_cadastral?.descricao,
        est.descricao_situacao_cadastral, est.situacao,
      ),
      dataAbertura: firstText(est.data_inicio_atividade, est.abertura),
      naturezaJuridica: firstText(
        body.natureza_juridica?.descricao,
        body.natureza_juridica, body.descricao_natureza_juridica,
      ),
      atividadePrincipal: firstText(
        est.atividade_principal?.descricao,
        est.cnae_fiscal_descricao, est.descricao_atividade_principal,
      ),
    });
  } catch (error: any) {
    console.error("Erro inesperado na consulta de CNPJ:", error);
    res.status(503).json({ message: "Não foi possível consultar o CNPJ. Tente novamente ou preencha manualmente." });
  }
});
