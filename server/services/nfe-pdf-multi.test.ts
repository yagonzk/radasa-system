import { describe, expect, it } from "vitest";
import { interpretarNfesPdf } from "./nfe-pdf.service.js";

describe("interpretarNfesPdf", () => {
  it("separa várias DANFEs contidas no mesmo PDF", () => {
    const texto = `
DANFE NOTA FISCAL ELETRÔNICA NF-e Nº 62889 SÉRIE 004
CHAVE DE ACESSO 51260902518930000167550040000628891001690700
DATA DE EMISSÃO 10/09/2026
VALOR TOTAL DA NOTA 5.000,00
DANFE NOTA FISCAL ELETRÔNICA NF-e Nº 62890 SÉRIE 004
CHAVE DE ACESSO 51260902518930000167550040000628901001690706
DATA DE EMISSÃO 10/09/2026
VALOR TOTAL DA NOTA 20.000,00
`;
    const docs = interpretarNfesPdf(texto);
    expect(docs).toHaveLength(2);
    expect(docs.map((doc) => doc.numero)).toEqual(["62889", "62890"]);
    expect(docs.map((doc) => doc.valorNota)).toEqual([5000, 20000]);
  });
});
