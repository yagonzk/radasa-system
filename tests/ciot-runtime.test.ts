import { expect, it } from "vitest";
import {
  getRuntimeAnttMtls,
  runWithRuntimeBindings,
} from "../server/lib/runtime-bindings.js";

it("reuses the company SEFAZ mTLS binding when no separate ANTT binding exists", async () => {
  const sefaz = { fetch: async () => Response.json({ source: "sefaz" }) };
  await runWithRuntimeBindings({ SEFAZ_MTLS: sefaz }, async () => {
    expect(
      await getRuntimeAnttMtls()
        .binding?.fetch("https://appservices-hml.antt.gov.br")
        .then((r) => r.json()),
    ).toEqual({ source: "sefaz" });
  });
});
it("keeps certificate bindings isolated across concurrent requests and prefers explicit ANTT binding", async () => {
  const binding = (source: string) => ({
    fetch: async () => Response.json({ source }),
  });
  const results = await Promise.all(
    ["a", "b"].map((source) =>
      runWithRuntimeBindings(
        { ANTT_CIOT_MTLS: binding(source), SEFAZ_MTLS: binding("fallback") },
        async () => {
          await Promise.resolve();
          return getRuntimeAnttMtls()
            .binding?.fetch("https://appservices-hml.antt.gov.br")
            .then((r) => r.json());
        },
      ),
    ),
  );
  expect(results).toEqual([{ source: "a" }, { source: "b" }]);
});
