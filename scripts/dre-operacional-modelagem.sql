-- DRE Operacional - apoio de performance e classificação gerencial.
-- Não altera dados de negócio. Pode ser aplicado em PostgreSQL em janela de manutenção.

CREATE INDEX IF NOT EXISTS idx_manifestos_dre_data_placa ON manifestos ("dataManifesto", "placaVeiculo");
CREATE INDEX IF NOT EXISTS idx_manifestos_dre_cliente_data ON manifestos ("clienteId", "dataManifesto");
CREATE INDEX IF NOT EXISTS idx_viagens_dre_data_placa ON viagens ("dataManifesto", placa);
CREATE INDEX IF NOT EXISTS idx_viagens_dre_motorista_data ON viagens ("motoristaId", "dataManifesto");
CREATE INDEX IF NOT EXISTS idx_financeiro_dre_data_tipo_categoria ON lancamentos_financeiros ("dataCompetencia", tipo, categoria);
CREATE INDEX IF NOT EXISTS idx_financeiro_dre_cliente_data ON lancamentos_financeiros ("clienteId", "dataCompetencia");
CREATE INDEX IF NOT EXISTS idx_financeiro_dre_veiculo_data ON lancamentos_financeiros ("veiculoId", "dataCompetencia");
CREATE INDEX IF NOT EXISTS idx_financeiro_dre_centro_data ON lancamentos_financeiros ("centroCustoId", "dataCompetencia");
CREATE INDEX IF NOT EXISTS idx_abastecimentos_dre_data_veiculo ON abastecimentos ("dataEmissao", "veiculoId");
CREATE INDEX IF NOT EXISTS idx_os_dre_status_data_veiculo ON ordens_servico (status, "dataConclusao", "veiculoId");
CREATE INDEX IF NOT EXISTS idx_ciot_dre_empresa_data ON ciots ("empresaId", "dataInicio");
CREATE INDEX IF NOT EXISTS idx_ciot_dre_cliente_data ON ciots ("clienteId", "dataInicio");
CREATE INDEX IF NOT EXISTS idx_ciot_ctes_dre_data ON ciot_ctes ("dataEmissao");

CREATE OR REPLACE FUNCTION dre_categoria_gerencial(categoria_texto text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE c text := upper(translate(coalesce(categoria_texto,''),'ÁÀÃÂÉÊÍÓÔÕÚÇ','AAAAEEIOOOUC'));
BEGIN
  IF c LIKE '%ICMS%' OR c LIKE '%ISS%' OR c LIKE '%PIS%' OR c LIKE '%COFINS%' OR c LIKE '%CANCEL%' OR c LIKE '%DEVOL%' OR c LIKE '%ABAT%' OR c LIKE '%DESCONTO%' THEN RETURN 'DEDUCAO'; END IF;
  IF c LIKE '%DEPRECI%' OR c LIKE '%AMORTIZA%' THEN RETURN 'DEPRECIACAO_AMORTIZACAO'; END IF;
  IF c LIKE '%ADMINISTR%' OR c LIKE '%ALUGUEL%' OR c LIKE '%ENERGIA%' OR c LIKE '%INTERNET%' OR c LIKE '%TELEFON%' OR c LIKE '%CONTABIL%' OR c LIKE '%JURID%' OR c LIKE '%SOFTWARE%' OR c LIKE '%BANCAR%' THEN RETURN 'CUSTO_INDIRETO'; END IF;
  RETURN 'CUSTO_DIRETO';
END;
$$;
