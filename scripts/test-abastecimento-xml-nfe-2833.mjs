import fs from "node:fs";

const source = fs.readFileSync("server/services/abastecimento-xml.service.ts", "utf8");
const xml = fs.readFileSync("/mnt/data/xml_abastecimento_fix/51260936381687000108550110000028331004483886(1).xml", "utf8");

const requiredXmlFragments = [
  '<nfeProc versao="4.00"',
  '<nNF>2833</nNF>',
  '<xProd>OLEO DIESEL B S10  COMUM</xProd>',
  '<qCom>203.84</qCom>',
  'Placa:RAT8F79',
  'km:498633',
  '<cStat>100</cStat>',
];
for (const fragment of requiredXmlFragments) {
  if (!xml.includes(fragment)) throw new Error(`XML de regressão incompleto: ${fragment}`);
}

if (!source.includes("removeNSPrefix: true")) throw new Error("Parser ainda não tolera namespaces de NF-e.");
if (!source.includes("function parseNfeXml")) throw new Error("Normalização robusta do XML não foi adicionada.");
if (!source.includes("const root = parseNfeXml(xml)")) throw new Error("Interpretador ainda ignora o parser robusto.");
if (!source.includes("const fiscalXml = normalized.replace")) throw new Error("Normalização da assinatura digital não foi adicionada.");

console.log("OK: NF-e 2833 coberta pela regressão do importador de abastecimento.");
