-- Viagens deixam de exigir cliente.
ALTER TABLE "viagens" ALTER COLUMN "clienteId" DROP NOT NULL;
