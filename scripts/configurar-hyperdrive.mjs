import fs from "node:fs";
import path from "node:path";

const id = String(process.argv[2] || "").trim();
if (!/^[a-f0-9]{16,128}$/i.test(id)) {
  console.error("Uso: node scripts/configurar-hyperdrive.mjs <HYPERDRIVE_ID>");
  process.exit(1);
}

const file = path.resolve("wrangler.jsonc");
let text = fs.readFileSync(file, "utf8");

const activeBlock = /\n\s*"hyperdrive"\s*:\s*\[[\s\S]*?\]\s*,?/m;
const block = `\n  "hyperdrive": [\n    {\n      "binding": "HYPERDRIVE",\n      "id": "${id}"\n    }\n  ],`;

if (activeBlock.test(text)) {
  text = text.replace(activeBlock, block);
} else {
  const varsIndex = text.indexOf('  "vars": {');
  if (varsIndex < 0) throw new Error('Bloco "vars" não encontrado no wrangler.jsonc.');
  text = `${text.slice(0, varsIndex)}${block}\n\n${text.slice(varsIndex)}`;
}

fs.writeFileSync(file, text);
console.log(`Binding HYPERDRIVE configurado em wrangler.jsonc com ID ${id}.`);
