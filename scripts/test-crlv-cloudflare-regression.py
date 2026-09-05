
from pathlib import Path

root = Path(__file__).resolve().parents[1]
route = (root / "server/routes/veiculos.routes.ts").read_text(encoding="utf-8")
client = (root / "client/src/components/cadastros/VeiculoTab.tsx").read_text(encoding="utf-8")

assert 'import { interpretarCrlvPdf } from "../services/crlv-pdf.service.js";' not in route, "rota ainda importa pdf-parse indiretamente"
assert '"/crlv-texto/interpretar"' in route, "rota de texto do CRLV não existe"
assert 'extrairTextoPdf' in client, "cliente não extrai o texto do PDF no navegador"
assert '"/veiculos/crlv-texto/interpretar"' in client, "cliente ainda não envia texto para a API"
assert '"/veiculos/crlv-pdf/interpretar"' not in client, "cliente ainda chama parser PDF no Worker"
print("CRLV Cloudflare regression: PASS")
