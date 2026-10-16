import { expect, it } from "vitest";
import express from "express";
import { createServer } from "node:http";
import { cteRoutes } from "../server/routes/cte.routes.js";
import { interpretarCteXml } from "../server/services/cte-documento.service.js";
function xml(key: string, n = 1) {
  return `<cteProc><CTe><infCte Id="CTe${key}"><ide><nCT>${n}</nCT><toma3><toma>0</toma></toma3></ide><emit><CNPJ>15209274000162</CNPJ></emit><rem><CNPJ>12345678000195</CNPJ><xNome>Cliente do frete</xNome></rem><vPrest><vTPrest>${100 * n}</vTPrest></vPrest><infCTeNorm><infCarga><proPred>AGUA</proPred><vCarga>${1000 * n}</vCarga><infQ><tpMed>PESO</tpMed><qCarga>${10 * n}</qCarga></infQ></infCarga></infCTeNorm></infCte></CTe></cteProc>`;
}
it("reads freight customer from ide.toma3 instead of confusing recipient and carrier", () => {
  const cte = interpretarCteXml(xml("1".repeat(44)));
  expect(cte.tomadorCnpj).toBe("12345678000195");
  expect(cte.tomadorNome).toBe("Cliente do frete");
});
it("multipart import sums distinct XMLs and reports duplicates and invalid files", async () => {
  const app = express();
  app.use("/cte", cteRoutes);
  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const address = server.address() as { port: number };
    const data = new FormData();
    for (const [name, contents] of [
      ["one.xml", xml("1".repeat(44), 1)],
      ["two.xml", xml("2".repeat(44), 2)],
      ["duplicate.xml", xml("1".repeat(44), 1)],
      ["bad.xml", "<foo/>"],
    ])
      data.append(
        "arquivos",
        new Blob([contents], { type: "application/xml" }),
        name,
      );
    const response = await fetch(
      `http://127.0.0.1:${address.port}/cte/interpretar`,
      { method: "POST", body: data },
    );
    const result = await response.json();
    expect(response.status).toBe(200);
    expect(result.ctes).toHaveLength(2);
    expect(result.resumo.valorFrete).toBe(300);
    expect(result.resumo.pesoKg).toBe(30);
    expect(result.erros).toHaveLength(2);
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
});
