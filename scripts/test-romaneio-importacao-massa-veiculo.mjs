import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const file = path.join(root, "client/src/pages/Romaneios.tsx");
const source = fs.readFileSync(file, "utf8");

const checks = [
  [
    "preserva a placa OCR quando o cadastro de veículos ainda não estiver disponível",
    /placaVeiculo:\s*registered\s*\?\s*formatPlate\(registered\.placa\)\s*:\s*String\(importedPlate \?\? ""\)\.trim\(\)\.toUpperCase\(\)/s,
  ],
  [
    "revalida a lista de veículos ao confirmar a importação em massa",
    /const refreshedVehicles = await refreshVeiculos\(\);[\s\S]*?const vehicleSource =/,
  ],
  [
    "usa código do veículo ou placa para resolver o veículo cadastrado",
    /const resolveRegisteredVehicle = [\s\S]*?documento\.veiculoCodigo[\s\S]*?findRegisteredVehicleByPlate\(documento\.placaVeiculo, sourceVehicles\)/,
  ],
  [
    "status Pronto depende de veículo realmente vinculado",
    /const isBulkEntryReady = [\s\S]*?resolveRegisteredVehicle\(entry\.result\.documento, sourceVehicles\)/,
  ],
  [
    "não exibe mais a mensagem genérica antiga que escondia a causa",
    /Nenhum PDF pode ser cadastrado até a placa do veículo ser reconhecida no cadastro\./,
  ],
];

let failed = 0;
for (const [label, pattern] of checks) {
  if (!pattern.test(source)) {
    failed += 1;
    console.error(`FALHOU: ${label}`);
  } else {
    console.log(`OK: ${label}`);
  }
}

if (/placaVeiculo:\s*registered \? formatPlate\(registered\.placa\) : ""/.test(source)) {
  failed += 1;
  console.error("FALHOU: ainda existe lógica que apaga a placa importada quando não encontra veículo.");
}

if (failed) process.exit(1);
console.log("OK: regressão de importação em massa protegida.");
