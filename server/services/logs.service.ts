import { prisma } from "../lib/prisma";
export const logsService = {
  list: () => prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" }, take: 500,
    select: { id: true, action: true, createdAt: true, user: { select: { username: true, email: true } } },
  }),
};
