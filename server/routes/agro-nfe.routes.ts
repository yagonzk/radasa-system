import { Router } from "express";
import { requireRole } from "../middlewares/auth.js";
import { getRuntimeAnttConnector } from "../lib/runtime-bindings.js";
import { AppError } from "../utils/app-error.js";

// O certificado e sua senha NUNCA são gravados no banco do Worker. O PC do
// conector, protegido por ACL Windows, guarda cada emitente em cofre criptografado.
export const agroNfeRoutes = Router();
const CNPJ = /^\d{14}$/;
const HOST = "ciot.radasa.com.br";

async function bridge(method: "GET" | "POST" | "DELETE", path: string, payload?: object) {
  const connector = getRuntimeAnttConnector();
  if (!connector.url || !connector.token || connector.token.length < 48)
    throw new AppError(503, "Conector local não configurado. Instale e configure primeiro o conector CIOT no PC.");
  let uri: URL;
  try { uri = new URL(connector.url); }
  catch { throw new AppError(503, "URL do conector local inválida."); }
  if (uri.hostname !== HOST || uri.protocol !== "https:" || uri.port || uri.username || uri.password ||
      uri.search || uri.hash || !["", "/"].includes(uri.pathname))
    throw new AppError(503, "O conector deve usar exclusivamente https://ciot.radasa.com.br.");
  try {
    const response = await fetch(`${uri.origin}${path}`, {
      method, redirect: "manual", signal: AbortSignal.timeout(method === "GET" ? 10_000 : 25_000),
      headers: { "Authorization": `Bearer ${connector.token}`, "Content-Type": "application/json" },
      ...(payload ? { body: JSON.stringify(payload) } : {}),
    });
    let result: any;
    try { result = await response.json(); } catch { /* Não propagar HTML externo para o navegador. */ }
    if (!response.ok) {
      const code = /^[A-Z][A-Z0-9_]{2,80}$/.test(String(result?.error || "")) ? result.error : "CONNECTOR_REQUEST_FAILED";
      throw new AppError(response.status >= 500 ? 503 : 422, `Conector fiscal: ${code}.`, { code });
    }
    if (!result || typeof result !== "object" || Array.isArray(result))
      throw new AppError(502, "Conector fiscal retornou resposta inválida.");
    return result;
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(503, "Conector fiscal offline ou sem resposta. Confirme o PC e o Cloudflare Tunnel.");
  }
}

// Certificados são sensíveis: apenas ADMIN autenticado e ativo pode visualizar
// metadados, cadastrar, substituir, testar e remover emitentes fiscais.
agroNfeRoutes.use(requireRole("ADMIN"));

agroNfeRoutes.get("/emitentes", async (_req, res, next) => {
  try { res.json(await bridge("GET", "/v1/agro/nfe/emitentes")); }
  catch (error) { next(error); }
});
agroNfeRoutes.post("/emitentes", async (req, res, next) => {
  try {
    const { cnpj, uf, inscricaoEstadual, nome, pfxBase64, pfxPassword } = req.body || {};
    if (typeof cnpj !== "string" || !CNPJ.test(cnpj.replace(/\D/g, "")) ||
        typeof uf !== "string" || !/^[A-Z]{2}$/.test(uf) ||
        typeof inscricaoEstadual !== "string" || !/^\d{2,14}$/.test(inscricaoEstadual.replace(/\D/g, "")) ||
        typeof pfxBase64 !== "string" || pfxBase64.length > 4.2 * 1024 * 1024 ||
        typeof pfxPassword !== "string" || !pfxPassword || pfxPassword.length > 512 ||
        typeof nome !== "string" || nome.length > 120)
      throw new AppError(422, "Informe CNPJ, UF, inscrição estadual, arquivo PFX/P12 e senha válidos.");
    const result = await bridge("POST", "/v1/agro/nfe/emitentes", {
      cnpj: cnpj.replace(/\D/g, ""), uf, inscricaoEstadual, nome, pfxBase64, pfxPassword,
    });
    res.json(result);
  } catch (error) { next(error); }
});
agroNfeRoutes.post("/emitentes/:cnpj/homologacao", async (req, res, next) => {
  try {
    const id = String(req.params.cnpj || "");
    if (!CNPJ.test(id)) throw new AppError(422, "CNPJ inválido.");
    res.json(await bridge("POST", `/v1/agro/nfe/emitentes/${id}/homologacao`, {}));
  } catch (error) { next(error); }
});
agroNfeRoutes.delete("/emitentes/:cnpj", async (req, res, next) => {
  try {
    const id = String(req.params.cnpj || "");
    if (!CNPJ.test(id)) throw new AppError(422, "CNPJ inválido.");
    res.json(await bridge("DELETE", `/v1/agro/nfe/emitentes/${id}`));
  } catch (error) { next(error); }
});
