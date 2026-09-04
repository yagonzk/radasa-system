import type { Request, Response } from "express";
import { manutencaoService as s } from "../services/manutencao.service.js";
import { AppError } from "../utils/app-error.js";
const id = (r: Request) => Array.isArray(r.params.id) ? r.params.id[0] : r.params.id;
const childId = (r: Request, name: string) => {
  const value = r.params[name];
  return Array.isArray(value) ? value[0] : value;
};
function sendFile(res: Response, file: { mime: string; buffer: Buffer; nome: string }) {
  res.setHeader("Content-Type", file.mime || "application/octet-stream");
  res.setHeader("Content-Disposition", `inline; filename*=UTF-8''${encodeURIComponent(file.nome)}`);
  res.send(file.buffer);
}
export const manutencaoController = {
  dashboard: async (_r: Request, res: Response) => res.json(await s.dashboard()),
  planos: async (_r: Request, res: Response) => res.json(await s.planos()),
  criarPlano: async (r: Request, res: Response) => res.status(201).json(await s.criarPlano(r.body)),
  removerPlano: async (r: Request, res: Response) => { await s.removerPlano(id(r)); res.status(204).send(); },
  ordens: async (_r: Request, res: Response) => res.json(await s.ordens()),
  obterOs: async (r: Request, res: Response) => res.json(await s.obterOs(id(r))),
  criarOs: async (r: Request, res: Response) => res.status(201).json(await s.criarOs(r.body)),
  atualizarOs: async (r: Request, res: Response) => res.json(await s.atualizarOs(id(r), r.body)),
  removerOs: async (r: Request, res: Response) => { await s.removerOs(id(r)); res.status(204).send(); },
  concluirOs: async (r: Request, res: Response) => res.json(await s.concluirOs(id(r), r.body)),
  adicionarNotaFiscal: async (r: Request, res: Response) => {
    if (!r.file) throw new AppError(400, "Selecione o arquivo da Nota Fiscal.");
    res.status(201).json(await s.adicionarNotaFiscal(id(r), r.body, r.file));
  },
  arquivoNotaFiscal: async (r: Request, res: Response) => sendFile(res, await s.arquivoNotaFiscal(id(r), childId(r, "notaId"))),
  removerNotaFiscal: async (r: Request, res: Response) => { await s.removerNotaFiscal(id(r), childId(r, "notaId")); res.status(204).send(); },
  adicionarAnexo: async (r: Request, res: Response) => {
    if (!r.file) throw new AppError(400, "Selecione um arquivo.");
    res.status(201).json(await s.adicionarAnexo(id(r), r.body, r.file));
  },
  arquivoAnexo: async (r: Request, res: Response) => sendFile(res, await s.arquivoAnexo(id(r), childId(r, "anexoId"))),
  removerAnexo: async (r: Request, res: Response) => { await s.removerAnexo(id(r), childId(r, "anexoId")); res.status(204).send(); },
  documentos: async (_r: Request, res: Response) => res.json(await s.documentos()),
  criarDocumento: async (r: Request, res: Response) => res.status(201).json(await s.criarDocumento(r.body)),
  removerDocumento: async (r: Request, res: Response) => { await s.removerDocumento(id(r)); res.status(204).send(); },
};
