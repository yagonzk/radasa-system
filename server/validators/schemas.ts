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
  id: id.optional(), nome: text(), codigoInterno: text(100), createdAt: z.string().optional(),
});
export const localBody = z.object({
  id: id.optional(), cidade: text(), valorComissao: money, createdAt: z.string().optional(),
});
export const veiculoBody = z.object({
  id: id.optional(), placa: text(20), modelo: optionalText(255), createdAt: z.string().optional(),
});
export const viagemBody = z.object({
  id: id.optional(), placa: text(20), motoristaId: id, valorFrete: money, dataManifesto: dateOnly, cidadeEntrega: text(), distanciaKm: money, valorPedagio: money, valorDiaria: money, valorAbastecimento: money, valorChapa: money, createdAt: z.string().optional(),
});
export const fechamentoBody = z.object({
  id: id.optional(), motoristaId: id, dataInicio: dateOnly, dataFim: dateOnly,
  viagens: z.array(z.object({ localId: id, quantidade: z.coerce.number().int().min(0) })),
  valorTotal: money.optional(), createdAt: z.string().optional(),
});
export const tipoManifesto = z.enum(["Bonificação - Lebrinha", "Acertar c/ Lebrinha", "Receber c/ Cliente"]);
export const manifestoProdutoBody = z.object({
  produtoId: id, quantidade: money, valorUnitario: money, valorTotal: money, tipoManifesto: tipoManifesto.optional(),
});
export const manifestoBody = z.object({
  id: id.optional(), clienteId: id, dataManifesto: dateOnly, produtos: z.array(manifestoProdutoBody), tipoManifesto, pdfUrl: z.string().max(20_000_000).optional().or(z.literal("")), createdAt: z.string().optional(),
});

export const bodySchema = (schema: z.ZodTypeAny) => z.object({ body: schema, params: z.unknown().optional(), query: z.unknown().optional() });
export const partialBodySchema = (schema: z.AnyZodObject) => z.object({ body: schema.partial(), params: z.object({ id }), query: z.unknown().optional() });

const username = z.string().trim().toLowerCase().min(3, "O usuário deve ter pelo menos 3 caracteres").max(30).regex(/^[a-z0-9._-]+$/, "Use apenas letras, números, ponto, hífen ou sublinhado");
const password = z.string().min(8, "A senha deve ter pelo menos 8 caracteres").max(200);

export const loginSchema = bodySchema(z.object({ identifier: z.string().trim().min(3).max(255), password }));
export const registerSchema = bodySchema(z.object({ name: text(120), username, email: z.string().trim().email().transform(v => v.toLowerCase()), password }));
export const changePasswordSchema = bodySchema(z.object({ currentPassword: password, newPassword: password }));
export const createUserSchema = bodySchema(z.object({ name: text(), username, email: z.string().email().transform(v => v.toLowerCase()), password, role: z.enum(["ADMIN", "USER"]).default("USER") }));

export const migrationSchema = bodySchema(z.object({
  motoristas: z.array(motoristaBody).default([]), chapas: z.array(chapaBody).default([]), clientes: z.array(clienteBody).default([]), produtos: z.array(produtoBody).default([]), locais: z.array(localBody).default([]), veiculos: z.array(veiculoBody).default([]), viagens: z.array(viagemBody).default([]), fechamentos: z.array(fechamentoBody).default([]), manifestos: z.array(manifestoBody).default([]),
}));
