import bcrypt from "bcryptjs";
import { createHash, randomBytes } from "node:crypto";
import jwt from "jsonwebtoken";
import { prisma } from "../lib/prisma.js";
import { env } from "../config/env.js";
import { AppError } from "../utils/app-error.js";
import { emailService } from "./email.service.js";
import { logger } from "../config/logger.js";

function publicUser(user: {
  id: string;
  name: string;
  username: string;
  email: string;
  telefone: string;
  cpf: string | null;
  fotoPerfil: string | null;
  role: "ADMIN" | "GERENTE" | "BORRACHARIA" | "MANUTENCAO" | "VISUALIZACAO" | "USER";
  motoristaId?: string | null;
  permissoes?: unknown;
}) {
  return {
    id: user.id,
    name: user.name,
    username: user.username,
    email: user.email,
    telefone: user.telefone,
    cpf: user.cpf,
    fotoPerfil: user.fotoPerfil,
    role: user.role,
    motoristaId: user.motoristaId ?? null,
    permissoes: user.permissoes ?? {},
  };
}

function signToken(user: { id: string; email: string; role: "ADMIN" | "GERENTE" | "BORRACHARIA" | "MANUTENCAO" | "VISUALIZACAO" | "USER" }) {
  return jwt.sign(
    { email: user.email, role: user.role },
    env.JWT_SECRET,
    {
      subject: user.id,
      expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions["expiresIn"],
    }
  );
}

const PASSWORD_RESET_GENERIC_MESSAGE =
  "Se existir uma conta com os dados informados, enviaremos um link de recuperação para o e-mail cadastrado.";

function passwordResetHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function passwordResetUrl(token: string) {
  const baseUrl = env.PASSWORD_RESET_BASE_URL.replace(/\/$/, "");
  return `${baseUrl}/redefinir-senha?token=${encodeURIComponent(token)}`;
}

export const authService = {
  async login(identifier: string, password: string) {
    const normalizedIdentifier = identifier.trim().toLowerCase();
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: normalizedIdentifier },
          { username: normalizedIdentifier },
        ],
      },
    });

    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      throw new AppError(401, "Usuário, e-mail ou senha inválidos.");
    }

    if (!user.active) {
      throw new AppError(403, "Sua conta está aguardando aprovação do administrador.");
    }

    return { token: signToken(user), user: publicUser(user) };
  },

  async register(input: {
    name: string;
    username: string;
    email: string;
    password: string;
  }) {
    const username = input.username.trim().toLowerCase();
    const email = input.email.trim().toLowerCase();

    const existing = await prisma.user.findFirst({
      where: { OR: [{ username }, { email }] },
      select: { username: true, email: true },
    });

    if (existing?.username === username) {
      throw new AppError(409, "Este nome de usuário já está em uso.");
    }
    if (existing?.email === email) {
      throw new AppError(409, "Este e-mail já está cadastrado.");
    }

    await prisma.user.create({
      data: {
        name: input.name.trim(),
        username,
        email,
        passwordHash: await bcrypt.hash(input.password, 12),
        role: "VISUALIZACAO",
        active: false,
      },
    });

    return {
      message: "Conta criada com sucesso e enviada para aprovação do administrador.",
    };
  },

  async forgotPassword(identifier: string) {
    if (!emailService.isConfigured()) {
      throw new AppError(503, "O serviço de recuperação por e-mail ainda não está disponível. Tente novamente em alguns minutos.");
    }

    const normalizedIdentifier = identifier.trim().toLowerCase();
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: normalizedIdentifier },
          { username: normalizedIdentifier },
        ],
      },
      select: { id: true, name: true, email: true },
    });

    if (!user) {
      return { message: PASSWORD_RESET_GENERIC_MESSAGE };
    }

    const token = randomBytes(32).toString("base64url");
    const tokenHash = passwordResetHash(token);
    const expiresAt = new Date(Date.now() + env.PASSWORD_RESET_TTL_MINUTES * 60_000);

    const resetToken = await prisma.$transaction(async (tx) => {
      await tx.passwordResetToken.deleteMany({ where: { userId: user.id } });
      return tx.passwordResetToken.create({
        data: { userId: user.id, tokenHash, expiresAt },
        select: { id: true },
      });
    });

    try {
      await emailService.sendPasswordReset({
        to: user.email,
        name: user.name,
        resetUrl: passwordResetUrl(token),
        expiresMinutes: env.PASSWORD_RESET_TTL_MINUTES,
      });
    } catch (error) {
      await prisma.passwordResetToken.deleteMany({ where: { id: resetToken.id } }).catch(() => undefined);
      logger.error({ error, userId: user.id }, "Não foi possível concluir o envio da recuperação de senha.");
      // Mantemos a mesma resposta pública para não revelar se a conta existe.
    }

    return { message: PASSWORD_RESET_GENERIC_MESSAGE };
  },

  async resetPassword(token: string, newPassword: string) {
    const now = new Date();
    const tokenHash = passwordResetHash(token);
    const resetToken = await prisma.passwordResetToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!resetToken || resetToken.usedAt || resetToken.expiresAt <= now) {
      throw new AppError(400, "Este link de recuperação é inválido ou expirou.");
    }

    if (await bcrypt.compare(newPassword, resetToken.user.passwordHash)) {
      throw new AppError(400, "A nova senha deve ser diferente da senha atual.");
    }

    const newPasswordHash = await bcrypt.hash(newPassword, 12);

    await prisma.$transaction(async (tx) => {
      const claim = await tx.passwordResetToken.updateMany({
        where: { id: resetToken.id, usedAt: null, expiresAt: { gt: now } },
        data: { usedAt: now },
      });

      if (claim.count !== 1) {
        throw new AppError(400, "Este link de recuperação é inválido ou já foi utilizado.");
      }

      await tx.user.update({
        where: { id: resetToken.userId },
        data: { passwordHash: newPasswordHash },
      });
      await tx.passwordResetToken.updateMany({
        where: { userId: resetToken.userId, usedAt: null },
        data: { usedAt: now },
      });
      await tx.auditLog.create({
        data: {
          userId: resetToken.userId,
          action: "Redefiniu a senha por e-mail",
          method: "POST",
          path: "/api/auth/reset-password",
        },
      });
    });

    return { message: "Senha redefinida com sucesso. Você já pode entrar com a nova senha." };
  },

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || !(await bcrypt.compare(currentPassword, user.passwordHash))) {
      throw new AppError(400, "A senha atual está incorreta.");
    }
    if (currentPassword === newPassword) throw new AppError(400, "A nova senha deve ser diferente da atual.");
    const changedAt = new Date();
    await prisma.$transaction([
      prisma.user.update({ where: { id: userId }, data: { passwordHash: await bcrypt.hash(newPassword, 12) } }),
      prisma.passwordResetToken.updateMany({ where: { userId, usedAt: null }, data: { usedAt: changedAt } }),
      prisma.auditLog.create({ data: { userId, action: "Alterou a própria senha", method: "PUT", path: "/api/auth/change-password" } }),
    ]);
    return { message: "Senha alterada com sucesso." };
  },

  async updateProfile(userId: string, input: {
    name: string;
    email: string;
    telefone: string;
    cpf: string;
    fotoPerfil?: string | null;
  }) {
    const email = input.email.trim().toLowerCase();
    const cpf = input.cpf.replace(/\D/g, "") || null;

    const duplicate = await prisma.user.findFirst({
      where: {
        id: { not: userId },
        OR: [
          { email },
          ...(cpf ? [{ cpf }] : []),
        ],
      },
      select: { email: true, cpf: true },
    });

    if (duplicate?.email === email) {
      throw new AppError(409, "Este e-mail já está cadastrado.");
    }
    if (cpf && duplicate?.cpf === cpf) {
      throw new AppError(409, "Este CPF já está cadastrado.");
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        name: input.name.trim(),
        email,
        telefone: input.telefone.replace(/\D/g, ""),
        cpf,
        ...(input.fotoPerfil !== undefined ? { fotoPerfil: input.fotoPerfil } : {}),
      },
    });

    await prisma.auditLog.create({
      data: {
        userId,
        action: "Atualizou o próprio perfil",
        method: "PUT",
        path: "/api/auth/profile",
      },
    });

    return publicUser(user);
  },

  async me(userId: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.active) throw new AppError(401, "Usuário não encontrado ou inativo.");
    return publicUser(user);
  },
};
