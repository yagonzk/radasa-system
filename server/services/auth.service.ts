import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { prisma } from "../lib/prisma";
import { env } from "../config/env";
import { AppError } from "../utils/app-error";

function publicUser(user: {
  id: string;
  name: string;
  username: string;
  email: string;
  role: "ADMIN" | "GERENTE" | "BORRACHARIA" | "MANUTENCAO" | "VISUALIZACAO" | "USER";
}) {
  return {
    id: user.id,
    name: user.name,
    username: user.username,
    email: user.email,
    role: user.role,
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

    if (!user || !user.active || !(await bcrypt.compare(password, user.passwordHash))) {
      throw new AppError(401, "Usuário, e-mail ou senha inválidos.");
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

    const user = await prisma.user.create({
      data: {
        name: input.name.trim(),
        username,
        email,
        passwordHash: await bcrypt.hash(input.password, 12),
      },
    });

    return { token: signToken(user), user: publicUser(user) };
  },

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || !(await bcrypt.compare(currentPassword, user.passwordHash))) {
      throw new AppError(400, "A senha atual está incorreta.");
    }
    if (currentPassword === newPassword) throw new AppError(400, "A nova senha deve ser diferente da atual.");
    await prisma.$transaction([
      prisma.user.update({ where: { id: userId }, data: { passwordHash: await bcrypt.hash(newPassword, 12) } }),
      prisma.auditLog.create({ data: { userId, action: "Alterou a própria senha", method: "PUT", path: "/api/auth/change-password" } }),
    ]);
    return { message: "Senha alterada com sucesso." };
  },

  async me(userId: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.active) throw new AppError(401, "Usuário não encontrado ou inativo.");
    return publicUser(user);
  },
};
