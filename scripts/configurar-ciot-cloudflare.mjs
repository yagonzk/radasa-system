import fs from "node:fs/promises";
const args = process.argv.slice(2);
function arg(name) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}
const requestedCertificateId = arg("--certificate-id");
const environment = arg("--environment") || "homologacao";
const productionConfirmed = args.includes("--confirmar-producao");
if (
  (requestedCertificateId &&
    !/^[a-f\d-]{32,36}$/i.test(requestedCertificateId)) ||
  !["homologacao", "producao"].includes(environment) || (environment === "producao" && !productionConfirmed)
) {
  console.error(
    "Uso: pnpm run ciot:configurar --environment homologacao (ou producao --confirmar-producao) [--certificate-id ID_DO_CERTIFICADO]",
  );
  process.exit(1);
}
const filename = "wrangler.jsonc";
const original = await fs.readFile(filename, "utf8");
// Strip JSONC comments only outside quoted strings; preserve URLs and escapes.
const json = original
  .replace(
    /("(?:\\.|[^"\\])*")|\/\*[\s\S]*?\*\/|\/\/[^\r\n]*/g,
    (match, string) => string || "",
  )
  .replace(/,\s*([}\]])/g, "$1");
const config = JSON.parse(json);
const existing =
  (config.mtls_certificates || []).find(
    (item) => item.binding === "ANTT_CIOT_MTLS",
  ) ??
  (config.mtls_certificates || []).find(
    (item) => item.binding === "SEFAZ_MTLS",
  );
const certificateId = requestedCertificateId || existing?.certificate_id;
if (!/^[a-f\d-]{32,36}$/i.test(certificateId || "")) {
  console.error(
    "Nenhum vínculo mTLS encontrado. Cadastre o certificado da empresa no Cloudflare uma vez e informe --certificate-id ID_DO_CERTIFICADO. O CNPJ vem automaticamente de Cadastros > Empresa.",
  );
  process.exit(1);
}
config.mtls_certificates = [
  ...(config.mtls_certificates || []).filter(
    (item) => item.binding !== "ANTT_CIOT_MTLS",
  ),
  { binding: "ANTT_CIOT_MTLS", certificate_id: certificateId },
];
config.vars = {
  ...config.vars,
  ANTT_CIOT_ENVIRONMENT: environment,
  ANTT_CIOT_ENABLE_NETWORK: "true",
  ANTT_CIOT_BASE_URL:
    environment === "producao"
      ? "https://appservices.antt.gov.br/pefServices"
      : "https://appservices-hml.antt.gov.br/pefServices",
};
// Company identity comes from Cadastros > Empresa; remove the obsolete duplicate setting.
delete config.vars.ANTT_CIOT_MTLS_CNPJ;
await fs.copyFile(filename, `${filename}.antes-ciot`);
await fs.writeFile(filename, JSON.stringify(config, null, 2) + "\n");
console.log(
  `CIOT configurado para ${environment}. Backup: ${filename}.antes-ciot. Publique com pnpm run deploy:cloudflare.`,
);
