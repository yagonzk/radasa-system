-- Fase 1 do TMS: Viagem como núcleo operacional.
CREATE TYPE "StatusViagem" AS ENUM ('PLANEJADA', 'CARREGANDO', 'EM_TRANSITO', 'ENTREGUE', 'CONCLUIDA', 'CANCELADA');
CREATE TYPE "TipoDespesaViagem" AS ENUM ('PEDAGIO', 'DIARIA', 'CHAPA', 'MANUTENCAO', 'ESTACIONAMENTO', 'ALIMENTACAO', 'OUTROS');

CREATE SEQUENCE IF NOT EXISTS "viagens_numero_seq";
ALTER TABLE "viagens" ADD COLUMN "numero" INTEGER;
UPDATE "viagens" SET "numero" = nextval('"viagens_numero_seq"') WHERE "numero" IS NULL;
ALTER TABLE "viagens" ALTER COLUMN "numero" SET NOT NULL;
ALTER TABLE "viagens" ALTER COLUMN "numero" SET DEFAULT nextval('"viagens_numero_seq"');
ALTER SEQUENCE "viagens_numero_seq" OWNED BY "viagens"."numero";
CREATE UNIQUE INDEX "viagens_numero_key" ON "viagens"("numero");

ALTER TABLE "viagens"
  ADD COLUMN "status" "StatusViagem" NOT NULL DEFAULT 'CONCLUIDA',
  ADD COLUMN "veiculoId" TEXT,
  ADD COLUMN "clienteId" TEXT,
  ADD COLUMN "dataSaida" TIMESTAMP(3),
  ADD COLUMN "previsaoChegada" TIMESTAMP(3),
  ADD COLUMN "dataChegada" TIMESTAMP(3),
  ADD COLUMN "cidadeOrigem" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "ufOrigem" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "ufDestino" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "observacoes" TEXT NOT NULL DEFAULT '';
ALTER TABLE "viagens" ALTER COLUMN "status" SET DEFAULT 'PLANEJADA';

-- Vincula automaticamente os registros históricos à placa cadastrada quando houver correspondência única.
UPDATE "viagens" v SET "veiculoId" = x.id
FROM (SELECT MIN(id) AS id, UPPER(TRIM(placa)) AS placa FROM "veiculos" GROUP BY UPPER(TRIM(placa)) HAVING COUNT(*) = 1) x
WHERE UPPER(TRIM(v.placa)) = x.placa;

ALTER TABLE "manifestos" ADD COLUMN "viagemId" TEXT;
ALTER TABLE "abastecimentos" ADD COLUMN "viagemId" TEXT;
ALTER TABLE "ciots" ADD COLUMN "viagemId" TEXT;

CREATE TABLE "viagem_despesas" (
  "id" TEXT NOT NULL,
  "viagemId" TEXT NOT NULL,
  "tipo" "TipoDespesaViagem" NOT NULL,
  "descricao" TEXT NOT NULL DEFAULT '',
  "valor" DECIMAL(14,2) NOT NULL,
  "data" DATE NOT NULL,
  "observacoes" TEXT NOT NULL DEFAULT '',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "viagem_despesas_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "viagens_veiculoId_idx" ON "viagens"("veiculoId");
CREATE INDEX "viagens_clienteId_idx" ON "viagens"("clienteId");
CREATE INDEX "viagens_status_idx" ON "viagens"("status");
CREATE INDEX "manifestos_viagemId_idx" ON "manifestos"("viagemId");
CREATE INDEX "abastecimentos_viagemId_idx" ON "abastecimentos"("viagemId");
CREATE INDEX "ciots_viagemId_idx" ON "ciots"("viagemId");
CREATE INDEX "viagem_despesas_viagemId_idx" ON "viagem_despesas"("viagemId");
CREATE INDEX "viagem_despesas_tipo_idx" ON "viagem_despesas"("tipo");
CREATE INDEX "viagem_despesas_data_idx" ON "viagem_despesas"("data");

ALTER TABLE "viagens" ADD CONSTRAINT "viagens_veiculoId_fkey" FOREIGN KEY ("veiculoId") REFERENCES "veiculos"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "viagens" ADD CONSTRAINT "viagens_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "clientes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "manifestos" ADD CONSTRAINT "manifestos_viagemId_fkey" FOREIGN KEY ("viagemId") REFERENCES "viagens"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "abastecimentos" ADD CONSTRAINT "abastecimentos_viagemId_fkey" FOREIGN KEY ("viagemId") REFERENCES "viagens"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ciots" ADD CONSTRAINT "ciots_viagemId_fkey" FOREIGN KEY ("viagemId") REFERENCES "viagens"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "viagem_despesas" ADD CONSTRAINT "viagem_despesas_viagemId_fkey" FOREIGN KEY ("viagemId") REFERENCES "viagens"("id") ON DELETE CASCADE ON UPDATE CASCADE;
