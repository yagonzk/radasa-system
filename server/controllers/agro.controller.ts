import type { Request, Response } from "express";
import { agroEstoqueService } from "../services/agro-estoque.service.js";
import { agroLavourasService } from "../services/agro-lavouras.service.js";
import { agroRelatoriosService } from "../services/agro-relatorios.service.js";
import { requestParam } from "../utils/request-param.js";

export const agroController = {
  status: async (_req: Request, res: Response) => res.json({ module: "AGRO", available: true }),
  dashboard: async (_req: Request, res: Response) => res.json(await agroEstoqueService.dashboard()),
  relatorios: async (req: Request, res: Response) => res.json(await agroRelatoriosService.report(req.query)),
  estoque: async (req: Request, res: Response) => res.json(await agroEstoqueService.listEstoque(String(req.query.localId ?? ""))),

  locais: async (_req: Request, res: Response) => res.json(await agroEstoqueService.listLocais()),
  criarLocal: async (req: Request, res: Response) => res.status(201).json(await agroEstoqueService.createLocal(req.body)),
  atualizarLocal: async (req: Request, res: Response) => res.json(await agroEstoqueService.updateLocal(requestParam(req.params.id), req.body)),

  posicoes: async (req: Request, res: Response) => res.json(await agroEstoqueService.listPosicoes(String(req.query.localId ?? ""))),
  criarPosicao: async (req: Request, res: Response) => res.status(201).json(await agroEstoqueService.createPosicao(req.body)),
  atualizarPosicao: async (req: Request, res: Response) => res.json(await agroEstoqueService.updatePosicao(requestParam(req.params.id), req.body)),
  mapaBarracao: async (req: Request, res: Response) => res.json(await agroEstoqueService.mapaBarracao(String(req.query.localId ?? ""))),

  produtos: async (_req: Request, res: Response) => res.json(await agroEstoqueService.listProdutos()),
  criarProduto: async (req: Request, res: Response) => res.status(201).json(await agroEstoqueService.createProduto(req.body)),
  atualizarProduto: async (req: Request, res: Response) => res.json(await agroEstoqueService.updateProduto(requestParam(req.params.id), req.body)),
  removerProduto: async (req: Request, res: Response) => res.json(await agroEstoqueService.removeProduto(requestParam(req.params.id))),

  lotes: async (req: Request, res: Response) => res.json(await agroEstoqueService.listLotes(String(req.query.produtoId ?? ""), String(req.query.localId ?? ""), String(req.query.posicaoId ?? ""))),
  criarLote: async (req: Request, res: Response) => res.status(201).json(await agroEstoqueService.createLote(req.body)),
  atualizarLote: async (req: Request, res: Response) => res.json(await agroEstoqueService.updateLote(requestParam(req.params.id), req.body)),
  removerLote: async (req: Request, res: Response) => res.json(await agroEstoqueService.removeLote(requestParam(req.params.id))),

  movimentacoes: async (req: Request, res: Response) => res.json(await agroEstoqueService.listMovimentacoes(req.query)),
  criarMovimentacao: async (req: Request, res: Response) => res.status(201).json(await agroEstoqueService.createMovimentacao(req.body, req.user?.id)),

  transferencias: async (req: Request, res: Response) => res.json(await agroEstoqueService.listTransferencias(req.query)),
  criarTransferencia: async (req: Request, res: Response) => res.status(201).json(await agroEstoqueService.createTransferencia(req.body, req.user?.id)),

  inventarios: async (_req: Request, res: Response) => res.json(await agroEstoqueService.listInventarios()),
  inventario: async (req: Request, res: Response) => res.json(await agroEstoqueService.getInventario(requestParam(req.params.id))),
  criarInventario: async (req: Request, res: Response) => res.status(201).json(await agroEstoqueService.createInventario(req.body, req.user?.id)),
  atualizarItemInventario: async (req: Request, res: Response) => res.json(await agroEstoqueService.updateInventarioItem(requestParam(req.params.id), requestParam(req.params.itemId), req.body)),
  finalizarInventario: async (req: Request, res: Response) => res.json(await agroEstoqueService.finalizarInventario(requestParam(req.params.id), req.user?.id)),
  cancelarInventario: async (req: Request, res: Response) => res.json(await agroEstoqueService.cancelarInventario(requestParam(req.params.id))),

  fazendas: async (_req: Request, res: Response) => res.json(await agroLavourasService.listFazendas()),
  criarFazenda: async (req: Request, res: Response) => res.status(201).json(await agroLavourasService.createFazenda(req.body)),
  atualizarFazenda: async (req: Request, res: Response) => res.json(await agroLavourasService.updateFazenda(requestParam(req.params.id), req.body)),

  talhoes: async (req: Request, res: Response) => res.json(await agroLavourasService.listTalhoes(String(req.query.fazendaId ?? ""))),
  criarTalhao: async (req: Request, res: Response) => res.status(201).json(await agroLavourasService.createTalhao(req.body)),
  atualizarTalhao: async (req: Request, res: Response) => res.json(await agroLavourasService.updateTalhao(requestParam(req.params.id), req.body)),

  safras: async (_req: Request, res: Response) => res.json(await agroLavourasService.listSafras()),
  criarSafra: async (req: Request, res: Response) => res.status(201).json(await agroLavourasService.createSafra(req.body)),
  atualizarSafra: async (req: Request, res: Response) => res.json(await agroLavourasService.updateSafra(requestParam(req.params.id), req.body)),

  culturas: async (_req: Request, res: Response) => res.json(await agroLavourasService.listCulturas()),
  criarCultura: async (req: Request, res: Response) => res.status(201).json(await agroLavourasService.createCultura(req.body)),
  atualizarCultura: async (req: Request, res: Response) => res.json(await agroLavourasService.updateCultura(requestParam(req.params.id), req.body)),

  lavouras: async (_req: Request, res: Response) => res.json(await agroLavourasService.listLavouras()),
  criarLavoura: async (req: Request, res: Response) => res.status(201).json(await agroLavourasService.createLavoura(req.body)),
  atualizarLavoura: async (req: Request, res: Response) => res.json(await agroLavourasService.updateLavoura(requestParam(req.params.id), req.body)),

  operacoes: async (req: Request, res: Response) => res.json(await agroLavourasService.listOperacoes(req.query)),
  criarOperacao: async (req: Request, res: Response) => res.status(201).json(await agroLavourasService.createOperacao(req.body, req.user?.id)),
};
