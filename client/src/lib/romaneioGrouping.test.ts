import { describe, expect, it } from "vitest";
import * as grouping from "./romaneioGrouping.js";

describe("pagamento em lote dos romaneios", () => {
  it("seleciona somente cobranças de cliente ainda não pagas dos romaneios marcados", () => {
    const buildBulkPaymentTargets = (grouping as Record<string, unknown>)["buildBulkPaymentTargets"];
    expect(typeof buildBulkPaymentTargets).toBe("function");

    const targets = (buildBulkPaymentTargets as (romaneios: any[], selectedIds: Set<string>) => any[])(
      [
        {
          id: "m1",
          tipoManifesto: "Bonificação - Lebrinha",
          produtos: [
            { id: "p1", tipoManifesto: "Receber c/ Cliente", pagoCliente: false },
            { id: "p2", tipoManifesto: "Receber c/ Cliente", pagoCliente: true },
            { id: "p3", tipoManifesto: "Acertar c/ Lebrinha", pagoCliente: null },
          ],
        },
        {
          id: "m2",
          tipoManifesto: "Receber c/ Cliente",
          produtos: [
            { id: "p4", tipoManifesto: null, pagoCliente: null },
          ],
        },
        {
          id: "m3",
          tipoManifesto: "Receber c/ Cliente",
          produtos: [
            { id: "p5", tipoManifesto: null, pagoCliente: false },
          ],
        },
      ],
      new Set(["m1", "m2"]),
    );

    expect(targets).toEqual([
      { manifestoId: "m1", produtoId: "p1" },
      { manifestoId: "m2", produtoId: "p4" },
    ]);
  });
});
