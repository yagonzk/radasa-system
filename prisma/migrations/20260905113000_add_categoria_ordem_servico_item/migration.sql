ALTER TABLE "ordem_servico_itens" ADD COLUMN "categoria" TEXT;
CREATE INDEX "ordem_servico_itens_categoria_idx" ON "ordem_servico_itens"("categoria");
