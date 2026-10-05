import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const romaneiosFile = path.join(root, "client/src/pages/Romaneios.tsx");
const pdfTextFile = path.join(root, "client/src/lib/pdfText.ts");
const serviceFile = path.join(root, "server/services/manifestos.service.ts");
const romaneios = fs.readFileSync(romaneiosFile, "utf8");
const pdfText = fs.readFileSync(pdfTextFile, "utf8");
const service = fs.readFileSync(serviceFile, "utf8");

const checks = [
  [
    "preserva a placa lida quando o cache local ainda não conhece o veículo",
    /placaVeiculo:\s*registered\s*\?\s*formatPlate\(registered\.placa\)\s*:\s*String\(importedPlate \?\? ""\)\.trim\(\)\.toUpperCase\(\)/s,
    romaneios,
  ],
  [
    "não trata o código externo impresso no SIGA como ID interno do veículo",
    /veiculoCodigo:\s*registered\?\.id \?\? ""/,
    romaneios,
  ],
  [
    "status Pronto exige placa brasileira completa e não um código externo qualquer",
    /const isBulkEntryReady = [\s\S]*?normalizePlate\(entry\.result\.documento\.placaVeiculo\)\.length === 7/,
    romaneios,
  ],
  [
    "OCR forçado preserva o cabeçalho digital confiável antes do texto OCR",
    /const trustedHeader = digitalHeader \? `\$\{digitalHeader\}\\n` : "";[\s\S]*?OCR_PRIMARY_MARKER[\s\S]*?trustedHeader[\s\S]*?ocrText/,
    pdfText,
  ],
  [
    "backend resolve veículo diretamente no banco durante importação em massa",
    /const vehicles = await prisma\.veiculo\.findMany\([\s\S]*?const vehicleLookups = buildVehicleLookups\(vehicles\)/,
    service,
  ],
  [
    "backend grava sempre o ID, placa e modelo do cadastro real",
    /veiculoCodigo:\s*entry\.vehicle\.id,[\s\S]*?placaVeiculo:\s*formatPlate\(entry\.vehicle\.placa\),[\s\S]*?modeloVeiculo:\s*entry\.vehicle\.modelo/,
    service,
  ],
];

let failed = 0;
for (const [label, pattern, source] of checks) {
  if (!pattern.test(source)) {
    failed += 1;
    console.error(`FALHOU: ${label}`);
  } else {
    console.log(`OK: ${label}`);
  }
}

if (/entry\.result\.documento\.veiculoCodigo\s*\|\|\s*resolveRegisteredVehicle/.test(romaneios)) {
  failed += 1;
  console.error("FALHOU: código externo ainda pode marcar PDF como Pronto sem placa válida.");
}

if (failed) process.exit(1);
console.log("OK: regressão de vínculo de veículo na importação em massa protegida.");
