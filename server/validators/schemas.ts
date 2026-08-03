import { z } from "zod";

const id = z.string().min(1).max(100);
const text = (max = 255) => z.string().trim().min(1).max(max);
const optionalText = (max = 255) => z.string().trim().max(max).optional().or(z.literal(""));
const money = z.coerce.number().finite().min(0);
const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use AAAA-MM-DD");

export const idParamsSchema = z.object({
  body: z.unknown().optional(),
  query: z.unknown().optional(),
  params: z.object({ id }),
});

export const motoristaBody = z.object({
  id: id.optional(), nome: text(), cpf: text(30), salarioBase: money,
  status: z.enum(["ATIVO", "DEMITIDO"]).default("ATIVO"), createdAt: z.string().optional(),
});
export const chapaBody = z.object({
  id: id.optional(), nome: text(), valorFixo: money, createdAt: z.string().optional(),
});
export const clienteBody = z.object({
  id: id.optional(), nomeFantasia: text(), codigoInterno: text(100), email: z.string().trim().max(255), telefone: z.string().trim().max(100), enderecoFiscal: z.string().trim().max(1000), createdAt: z.string().optional(),
});
export const produtoBody = z.object({
  id: id.optional(), nome: text(), codigoInterno: text(100),
  categoriaEstoque: z.string().trim().min(1).max(80).default("Produtos de piscina"),
  createdAt: z.string().optional(),
});

export const estoqueMovimentacaoBody = z.object({
  id: id.optional(), produtoId: id, tipo: z.enum(["ENTRADA", "SAIDA"]),
  quantidade: z.coerce.number().finite().positive(),
  valorUnitario: z.coerce.number().finite().min(0).optional().default(0),
  data: dateOnly, observacoes: z.string().trim().max(2000).optional().or(z.literal("")),
  pdfUrl: z.string().optional().nullable(), pdfName: z.string().trim().max(255).optional().nullable(),
  createdAt: z.string().optional(),
});
export const localBody = z.object({
  id: id.optional(), cidade: text(), valorComissao: money, createdAt: z.string().optional(),
});
export const veiculoBody = z.object({
  id: id.optional(), placa: text(20), modelo: optionalText(255), quantidadePneus: z.coerce.number().int().min(4).max(16).default(10), quantidadeEstepes: z.coerce.number().int().min(0).max(3).default(1), createdAt: z.string().optional(),
});
export const viagemBody = z.object({
  id: id.optional(), placa: text(20), motoristaId: id, valorFrete: money, dataManifesto: dateOnly, cidadeEntrega: text(), distanciaKm: money, valorPedagio: money, valorDiaria: money, valorAbastecimento: money, valorChapa: money, createdAt: z.string().optional(),
});
export const fechamentoBody = z.object({
  id: id.optional(), motoristaId: id, dataInicio: dateOnly, dataFim: dateOnly,
  viagens: z.array(z.object({ localId: id, quantidade: z.coerce.number().int().min(1) })),
  valorTotal: money.optional(), createdAt: z.string().optional(),
});
export const tipoManifesto = z.enum(["Bonificação - Lebrinha", "Acertar c/ Lebrinha", "Receber c/ Cliente"]);
export const manifestoProdutoBody = z.object({
  produtoId: id, quantidade: money, valorUnitario: money, valorTotal: money, tipoManifesto: tipoManifesto.optional(),
});
export const manifestoBody = z.object({
  id: id.optional(), clienteId: id, dataManifesto: dateOnly, produtos: z.array(manifestoProdutoBody), tipoManifesto, pdfUrl: z.string().max(20_000_000).optional().or(z.literal("")), createdAt: z.string().optional(),
});

export const abastecimentoProdutoBody = z.object({
  produtoId: id,
  quantidadeLitros: z.coerce.number().finite().positive(),
  valorUnitario: z.coerce.number().finite().min(0),
  valorTotal: money.optional(),
});

export const abastecimentoBody = z.object({
  id: id.optional(), clienteId: id, veiculoId: id, dataEmissao: dateOnly,
  produtos: z.array(abastecimentoProdutoBody).min(1, "Adicione pelo menos um produto."),
  valorDesconto: z.coerce.number().finite().min(0).optional().default(0),
  valorTotal: money.optional(),
  hodometro: z.coerce.number().finite().min(0),
  pdfUrl: z.string().max(20_000_000).optional().nullable().or(z.literal("")),
  createdAt: z.string().optional(),
});

export const pneuBody = z.object({
  id: id.optional(), numeroFogo: text(100), codigoBarras: optionalText(255), qrCode: optionalText(255),
  marca: text(120), modelo: text(120), medida: text(80), dot: text(20), numeroSerie: optionalText(120),
  tipo: z.enum(["DIRECIONAL", "TRACAO", "LIVRE"]), valorCompra: money, fornecedor: text(180), dataCompra: dateOnly,
  maxRecapagens: z.coerce.number().int().min(0).max(20).default(0), recapagensRealizadas: z.coerce.number().int().min(0).max(20).default(0),
  status: z.enum(["ESTOQUE", "INSTALADO", "MANUTENCAO", "RECAPAGEM", "DESCARTADO"]).default("ESTOQUE"),
  condicao: z.enum(["NOVO", "USADO", "RECAPADO", "AGUARDANDO_RECAPAGEM"]).default("NOVO"),
  sulcoInicial: z.coerce.number().finite().min(0).max(100).optional().nullable(), sulcoAtual: z.coerce.number().finite().min(0).max(100).optional().nullable(),
  kmAtual: z.coerce.number().finite().min(0).default(0), proximoRodizioKm: z.coerce.number().finite().min(0).optional().nullable(),
  observacoes: z.string().max(5000).optional().or(z.literal("")), fotos: z.array(z.string().max(20_000_000)).max(10).optional(), createdAt: z.string().optional(),
});

export const bodySchema = (schema: z.ZodTypeAny) => z.object({ body: schema, params: z.unknown().optional(), query: z.unknown().optional() });
export const partialBodySchema = (schema: z.AnyZodObject) => z.object({ body: schema.partial(), params: z.object({ id }), query: z.unknown().optional() });

const username = z.string().trim().toLowerCase().min(3, "O usuário deve ter pelo menos 3 caracteres").max(30).regex(/^[a-z0-9._-]+$/, "Use apenas letras, números, ponto, hífen ou sublinhado");
const password = z.string().min(8, "A senha deve ter pelo menos 8 caracteres").max(200);

export const loginSchema = bodySchema(z.object({ identifier: z.string().trim().min(3).max(255), password }));
export const registerSchema = bodySchema(z.object({ name: text(120), username, email: z.string().trim().email().transform(v => v.toLowerCase()), password }));
export const changePasswordSchema = bodySchema(z.object({ currentPassword: password, newPassword: password }));
export const createUserSchema = bodySchema(z.object({ name: text(), username, email: z.string().email().transform(v => v.toLowerCase()), password, role: z.enum(["ADMIN", "GERENTE", "BORRACHARIA", "MANUTENCAO", "VISUALIZACAO", "USER"]).default("VISUALIZACAO") }));

export const migrationSchema = bodySchema(z.object({
  motoristas: z.array(motoristaBody).default([]), chapas: z.array(chapaBody).default([]), clientes: z.array(clienteBody).default([]), produtos: z.array(produtoBody).default([]), locais: z.array(localBody).default([]), veiculos: z.array(veiculoBody).default([]), viagens: z.array(viagemBody).default([]), fechamentos: z.array(fechamentoBody).default([]), manifestos: z.array(manifestoBody).default([]),
}));

export const pneuInstalacaoBody = z.object({
  veiculoId: id,
  carretaId: id.optional().nullable().or(z.literal("")),
  eixo: text(80),
  posicao: text(80),
  dataInstalacao: dateOnly,
  kmInstalacao: z.coerce.number().finite().min(0),
  responsavel: text(160),
});

export const pneuRetiradaBody = z.object({
  dataRetirada: dateOnly,
  kmRetirada: z.coerce.number().finite().min(0),
  motivoRetirada: text(1000),
  statusDestino: z.enum(["ESTOQUE", "MANUTENCAO", "RECAPAGEM"]).default("ESTOQUE"),
});

export const pneuRodizioBody = z.object({
  veiculoId: id,
  carretaId: id.optional().nullable().or(z.literal("")),
  data: dateOnly,
  quilometragem: z.coerce.number().finite().min(0),
  responsavel: text(160),
  motivo: text(1000),
  movimentos: z.array(z.object({
    pneuId: id,
    eixoOrigem: text(80),
    posicaoOrigem: text(80),
    eixoDestino: text(80),
    posicaoDestino: text(80),
  })).min(2, "Selecione ao menos duas posições para o rodízio."),
});


export const pneuSulcoBody = z.object({
  data: dateOnly, quilometragem: z.coerce.number().finite().min(0).optional().nullable(),
  sulcoInterno: z.coerce.number().finite().min(0).max(100), sulcoCentral: z.coerce.number().finite().min(0).max(100),
  sulcoExterno: z.coerce.number().finite().min(0).max(100), responsavel: text(160), observacoes: optionalText(2000),
});
export const pneuCalibragemBody = z.object({
  data: dateOnly, pressaoRecomendada: z.coerce.number().finite().positive(), pressaoEncontrada: z.coerce.number().finite().min(0),
  pressaoAjustada: z.coerce.number().finite().min(0), responsavel: text(160), observacoes: optionalText(2000),
});
export const pneuRecapagemBody = z.object({
  empresaRecapadora: text(180), dataEnvio: dateOnly, dataRetorno: dateOnly.optional().nullable().or(z.literal("")),
  valor: money, garantiaMeses: z.coerce.number().int().min(0).max(120).default(0), tipoRecapagem: text(120),
  numeroRecapagem: z.coerce.number().int().min(1).max(20), observacoes: optionalText(2000),
});
export const pneuConsertoBody = z.object({
  tipo: z.enum(["FURO", "REMENDO", "VULCANIZACAO", "CORTE_LATERAL", "OUTRO"]), data: dateOnly, valor: money,
  responsavel: text(160), observacoes: optionalText(2000), fotosAntes: z.array(z.string().max(20_000_000)).max(10).optional(),
  fotosDepois: z.array(z.string().max(20_000_000)).max(10).optional(),
});
export const pneuInspecaoBody = z.object({
  data: dateOnly, responsavel: text(160), pressaoOk: z.boolean(), sulcoOk: z.boolean(), cortes: z.boolean().default(false),
  bolhas: z.boolean().default(false), trincas: z.boolean().default(false), desgasteIrregular: z.boolean().default(false),
  lonaAparente: z.boolean().default(false), observacoes: optionalText(2000), fotos: z.array(z.string().max(20_000_000)).max(10).optional(),
});
