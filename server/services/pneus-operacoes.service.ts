import { prisma } from "../lib/prisma.js";
import { AppError } from "../utils/app-error.js";
import { parseDateOnly } from "../utils/date.js";
import { created, dateOnly, number } from "../utils/serialize.js";

const installationInclude = {
  pneu: true,
  veiculo: true,
  carreta: true,
} as const;

const serializeInstallation = (item: any) => ({
  ...item,
  dataInstalacao: dateOnly(item.dataInstalacao),
  dataRetirada: item.dataRetirada ? dateOnly(item.dataRetirada) : null,
  kmInstalacao: number(item.kmInstalacao),
  kmRetirada: item.kmRetirada == null ? null : number(item.kmRetirada),
  createdAt: created(item.createdAt),
});

const serializeRotation = (item: any) => ({
  ...item,
  data: dateOnly(item.data),
  quilometragem: number(item.quilometragem),
  createdAt: created(item.createdAt),
});

export const pneusOperacoesService = {
  async listInstallations() {
    const items = await prisma.pneuInstalacao.findMany({
      include: installationInclude,
      orderBy: [{ ativo: "desc" }, { dataInstalacao: "desc" }],
    });
    return items.map(serializeInstallation);
  },

  async install(pneuId: string, input: any) {
    const pneu = await prisma.pneu.findFirst({ where: { id: pneuId, deletedAt: null } });
    if (!pneu) throw new AppError(404, "Pneu não encontrado.");
    if (pneu.status !== "ESTOQUE") {
      throw new AppError(409, "Somente pneus em estoque podem ser instalados.");
    }

    const target = input.carretaId || input.veiculoId;
    const occupied = await prisma.pneuInstalacao.findFirst({
      where: {
        ativo: true,
        OR: [
          { carretaId: target, eixo: input.eixo, posicao: input.posicao },
          { carretaId: null, veiculoId: target, eixo: input.eixo, posicao: input.posicao },
        ],
      },
    });
    if (occupied) throw new AppError(409, "Esta posição já possui um pneu instalado.");

    return prisma.$transaction(async (tx: any) => {
      const installation = await tx.pneuInstalacao.create({
        data: {
          pneuId,
          veiculoId: input.veiculoId,
          carretaId: input.carretaId || null,
          eixo: input.eixo,
          posicao: input.posicao,
          dataInstalacao: parseDateOnly(input.dataInstalacao),
          kmInstalacao: Number(input.kmInstalacao),
          responsavel: input.responsavel,
        },
        include: installationInclude,
      });
      await tx.pneu.update({
        where: { id: pneuId },
        data: {
          status: "INSTALADO",
          eventos: {
            create: {
              tipo: "INSTALACAO",
              data: parseDateOnly(input.dataInstalacao),
              quilometragem: Number(input.kmInstalacao),
              responsavel: input.responsavel,
              observacoes: `Instalado em ${installation.carreta?.placa || installation.veiculo.placa}, eixo ${input.eixo}, posição ${input.posicao}.`,
              dados: { veiculoId: input.veiculoId, carretaId: input.carretaId || null, eixo: input.eixo, posicao: input.posicao },
            },
          },
        },
      });
      return serializeInstallation(installation);
    });
  },

  async retire(pneuId: string, input: any) {
    const current = await prisma.pneuInstalacao.findFirst({
      where: { pneuId, ativo: true },
      include: installationInclude,
    });
    if (!current) throw new AppError(404, "Este pneu não possui instalação ativa.");

    return prisma.$transaction(async (tx: any) => {
      const installation = await tx.pneuInstalacao.update({
        where: { id: current.id },
        data: {
          ativo: false,
          dataRetirada: parseDateOnly(input.dataRetirada),
          kmRetirada: Number(input.kmRetirada),
          motivoRetirada: input.motivoRetirada,
          statusDestino: input.statusDestino,
        },
        include: installationInclude,
      });
      await tx.pneu.update({
        where: { id: pneuId },
        data: {
          status: input.statusDestino,
          kmAtual: { increment: Math.max(0, Number(input.kmRetirada) - number(current.kmInstalacao)) },
          eventos: {
            create: {
              tipo: "RETIRADA",
              data: parseDateOnly(input.dataRetirada),
              quilometragem: Number(input.kmRetirada),
              responsavel: input.responsavel || current.responsavel,
              observacoes: input.motivoRetirada,
              dados: { eixo: current.eixo, posicao: current.posicao, statusDestino: input.statusDestino },
            },
          },
        },
      });
      return serializeInstallation(installation);
    });
  },

  async listRotations() {
    const items = await prisma.pneuRodizio.findMany({
      include: { veiculo: true, carreta: true, movimentos: { include: { pneu: true } } },
      orderBy: [{ data: "desc" }, { createdAt: "desc" }],
    });
    return items.map(serializeRotation);
  },

  async undoRotation(id: string) {
    const rotation: any = await prisma.pneuRodizio.findUnique({
      where: { id },
      include: { veiculo: true, carreta: true, movimentos: { include: { pneu: true } } },
    });
    if (!rotation) throw new AppError(404, "Rodízio não encontrado.");
    if (!rotation.movimentos.length) throw new AppError(409, "Este rodízio não possui movimentações para desfazer.");

    const pneuIds = rotation.movimentos.map((m: any) => m.pneuId);
    const laterRotation = await prisma.pneuRodizioMovimento.findFirst({
      where: {
        pneuId: { in: pneuIds },
        rodizio: { createdAt: { gt: rotation.createdAt } },
      },
      include: { rodizio: true },
    });
    if (laterRotation) {
      throw new AppError(409, "Não é possível desfazer este rodízio porque um dos pneus possui um rodízio posterior.");
    }

    const active: any[] = await prisma.pneuInstalacao.findMany({
      where: { pneuId: { in: pneuIds }, ativo: true },
    });
    if (active.length !== pneuIds.length) {
      throw new AppError(409, "Não é possível desfazer: um dos pneus já foi retirado ou reinstalado após este rodízio.");
    }

    const crossVehicle = Boolean(rotation.carretaId && rotation.carretaId !== rotation.veiculoId);
    const byPneu = new Map<string, any>(active.map((i: any) => [i.pneuId, i]));

    // Só desfaz quando os pneus ainda estão exatamente nos destinos registrados.
    for (const movement of rotation.movimentos) {
      const current = byPneu.get(movement.pneuId);
      if (!current || current.eixo !== movement.eixoDestino || current.posicao !== movement.posicaoDestino) {
        throw new AppError(409, "Não é possível desfazer: a posição atual de um dos pneus já foi alterada depois deste rodízio.");
      }
    }

    const movingPneuIds = new Set(pneuIds);
    for (const movement of rotation.movimentos) {
      const current = byPneu.get(movement.pneuId)!;
      const originVehicleId = crossVehicle
        ? (current.veiculoId === rotation.veiculoId ? rotation.carretaId : rotation.veiculoId)
        : current.veiculoId;
      const occupied = await prisma.pneuInstalacao.findFirst({
        where: {
          ativo: true,
          veiculoId: originVehicleId,
          carretaId: null,
          eixo: movement.eixoOrigem,
          posicao: movement.posicaoOrigem,
        },
      });
      if (occupied && !movingPneuIds.has(occupied.pneuId)) {
        throw new AppError(409, "Não é possível desfazer: uma posição de origem já está ocupada por outro pneu.");
      }
    }

    await prisma.$transaction(async (tx: any) => {
      for (const current of active) {
        await tx.pneuInstalacao.update({
          where: { id: current.id },
          data: { eixo: `TEMP-UNDO-${current.id}`, posicao: `TEMP-UNDO-${current.id}` },
        });
      }

      for (const movement of rotation.movimentos) {
        const current = byPneu.get(movement.pneuId)!;
        const originVehicleId = crossVehicle
          ? (current.veiculoId === rotation.veiculoId ? rotation.carretaId : rotation.veiculoId)
          : current.veiculoId;
        await tx.pneuInstalacao.update({
          where: { id: current.id },
          data: {
            veiculoId: originVehicleId,
            carretaId: null,
            eixo: movement.eixoOrigem,
            posicao: movement.posicaoOrigem,
          },
        });
        await tx.pneuEvento.create({
          data: {
            pneuId: movement.pneuId,
            tipo: "ALTERACAO",
            data: new Date(),
            quilometragem: Number(rotation.quilometragem),
            responsavel: rotation.responsavel,
            observacoes: `Rodízio desfeito: ${movement.eixoDestino} / ${movement.posicaoDestino} → ${movement.eixoOrigem} / ${movement.posicaoOrigem}.`,
            dados: { rodizioDesfeitoId: rotation.id, movimentoId: movement.id },
          },
        });
      }

      await tx.pneuRodizio.delete({ where: { id: rotation.id } });
    });

    return { ok: true };
  },

  async rotate(input: any) {
    const destinations = new Set(input.movimentos.map((m: any) => `${m.eixoDestino}:${m.posicaoDestino}`));
    if (destinations.size !== input.movimentos.length) throw new AppError(400, "As posições de destino não podem se repetir.");

    const ids = input.movimentos.map((m: any) => m.pneuId);
    const active: any[] = await prisma.pneuInstalacao.findMany({ where: { pneuId: { in: ids }, ativo: true } });
    if (active.length !== ids.length) throw new AppError(409, "Todos os pneus do rodízio precisam estar instalados.");

    const crossVehicle = Boolean(input.carretaId && input.carretaId !== input.veiculoId);
    const allowedVehicles = new Set([input.veiculoId, ...(crossVehicle ? [input.carretaId] : [])]);
    const byPneu = new Map<string, any>(active.map((i: any) => [i.pneuId, i]));

    for (const movement of input.movimentos) {
      const current = byPneu.get(movement.pneuId);
      if (!current || current.eixo !== movement.eixoOrigem || current.posicao !== movement.posicaoOrigem) {
        throw new AppError(409, "Uma das posições de origem não corresponde à instalação atual.");
      }
      if (current.carretaId || !allowedVehicles.has(current.veiculoId)) {
        throw new AppError(409, "Os pneus selecionados não pertencem aos caminhões informados para o rodízio.");
      }
    }

    if (crossVehicle && (active.length < 1 || active.length > 2)) {
      throw new AppError(400, "No rodízio entre caminhões, mova um pneu para uma posição livre ou troque dois pneus entre os caminhões.");
    }

    // Garante que cada destino esteja realmente livre, exceto quando o pneu que ocupa
    // o destino também participa do mesmo rodízio e será movido para outra posição.
    const movingPneuIds = new Set(ids);
    for (const movement of input.movimentos) {
      const current = byPneu.get(movement.pneuId)!;
      const destinationVehicleId = crossVehicle
        ? (current.veiculoId === input.veiculoId ? input.carretaId : input.veiculoId)
        : current.veiculoId;
      const occupied = await prisma.pneuInstalacao.findFirst({
        where: {
          ativo: true,
          veiculoId: destinationVehicleId,
          carretaId: null,
          eixo: movement.eixoDestino,
          posicao: movement.posicaoDestino,
        },
      });
      if (occupied && !movingPneuIds.has(occupied.pneuId)) {
        throw new AppError(409, "A posição de destino já possui um pneu instalado.");
      }
    }

    return prisma.$transaction(async (tx: any) => {
      // Libera temporariamente as duas posições para permitir a troca inclusive entre veículos.
      for (const current of active) {
        await tx.pneuInstalacao.update({ where: { id: current.id }, data: { eixo: `TEMP-${current.id}`, posicao: `TEMP-${current.id}` } });
      }

      const rotation = await tx.pneuRodizio.create({
        data: {
          veiculoId: input.veiculoId,
          // Em rodízio entre caminhões este campo registra o segundo veículo.
          carretaId: crossVehicle ? input.carretaId : null,
          data: parseDateOnly(input.data),
          quilometragem: Number(input.quilometragem),
          responsavel: input.responsavel,
          motivo: input.motivo,
          movimentos: { create: input.movimentos },
        },
        include: { veiculo: true, carreta: true, movimentos: { include: { pneu: true } } },
      });

      for (const movement of input.movimentos) {
        const current = byPneu.get(movement.pneuId)!;
        const destinationVehicleId = crossVehicle
          ? (current.veiculoId === input.veiculoId ? input.carretaId : input.veiculoId)
          : current.veiculoId;

        await tx.pneuInstalacao.update({
          where: { id: current.id },
          data: {
            veiculoId: destinationVehicleId,
            carretaId: null,
            eixo: movement.eixoDestino,
            posicao: movement.posicaoDestino,
          },
        });
        await tx.pneuEvento.create({
          data: {
            pneuId: movement.pneuId,
            tipo: "RODIZIO",
            data: parseDateOnly(input.data),
            quilometragem: Number(input.quilometragem),
            responsavel: input.responsavel,
            observacoes: crossVehicle
              ? `Rodízio entre caminhões: ${movement.eixoOrigem} / ${movement.posicaoOrigem} → ${movement.eixoDestino} / ${movement.posicaoDestino}. ${input.motivo}`
              : `${movement.eixoOrigem} / ${movement.posicaoOrigem} → ${movement.eixoDestino} / ${movement.posicaoDestino}. ${input.motivo}`,
            dados: {
              ...movement,
              veiculoOrigemId: current.veiculoId,
              veiculoDestinoId: destinationVehicleId,
              entreCaminhoes: crossVehicle,
            },
          },
        });
      }
      return serializeRotation(rotation);
    });
  },
};
