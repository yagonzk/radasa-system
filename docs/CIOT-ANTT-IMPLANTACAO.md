# CIOT direto no Radasa — configuração e validação

Esta atualização aproveita o módulo existente e usa os serviços da ANTT. Não utiliza login, API ou infraestrutura da Tech4Log/FFCred. As telas foram reorganizadas com base no fluxo observado: dados, operação, financeiro, frota e revisão.

## O que foi implementado

- Importação de até 20 XMLs por lote (máximo 10 MB), sem somar chaves repetidas; erros por arquivo.
- Empresa emitente obtida automaticamente de Cadastros > Empresa: na primeira utilização, a única ativa ou a única ativa marcada como padrão.
- Vínculo persistente de um único CNPJ em configuracoes_sistema, chave ciot.empresa_emitente. Alterar a empresa padrão ou enviar outro ID pela API não troca o emitente; empresa inativa bloqueia o CIOT sem selecionar outra. Não altera os demais módulos nem impede cadastrar outras empresas.
- O CNPJ vinculado não pode ser alterado, nem o cadastro excluído. Nome, endereço, RNTRC e certificado continuam atualizáveis no cadastro existente. Inativar a empresa suspende as operações CIOT.
- Empresa da frota como transportador contratado, separada do destinatário da carga.
- Dados oficiais de localização, carga, meios de pagamento, parcelas e implementos nas etapas correspondentes.
- Certificado e senha obtidos do cadastro da empresa em Node.js. No Cloudflare, usa ANTT_CIOT_MTLS ou reaproveita automaticamente SEFAZ_MTLS quando o primeiro não existe; ambos devem conter o certificado da empresa vinculada. A ANTT valida a identidade do certificado durante a conexão.
- Nenhum CNPJ ou senha precisa ser digitado no comando de configuração. A tela de diagnóstico carrega automaticamente a empresa vinculada; o seletor de empresa foi removido.
- Consulta de situação do transportador e vínculo da frota antes da declaração; emissão direta limitada a ETC ativa não equiparada a TAC.
- Solicitação automática de identificador pelo gerador oficial, persistência antes do envio, declaração e armazenamento da resposta.
- Autorização somente com código de sucesso 110, identificador correspondente e código verificador válido. HTTP 200 sozinho não significa autorização.
- Trava atômica para impedir dois envios do mesmo registro. Após timeout da declaração, permanece PROCESSANDO: consultar antes de qualquer novo envio.
- Consulta para recuperar autorização pendente, cancelamento e encerramento a partir da listagem.
- Homologação identificada como sem validade operacional. Comprovantes são extratos internos dos dados da ANTT.

## Limite da verificação realizada

A interface foi compilada e os cenários críticos foram verificados com transporte e banco controlados em testes. Não foi efetuada declaração real, nem teste mTLS com o certificado da empresa: o ZIP não contém as credenciais e o certificado necessários. A disponibilidade/habilitação do gerador oficial também precisa ser confirmada em homologação. Não considere esta entrega uma homologação concluída.

## 1. Instalação local

Use Node.js 20 a 24 e pnpm 10.4.1 (conforme package.json). Extraia o ZIP SOBRE UMA CÓPIA do projeto existente. Este ZIP é uma atualização para o projeto existente: não inclui nem substitui seu .env, agente-config.json, wrangler.jsonc ou certificados locais. Os bindings já configurados são preservados. O ZIP de atualização não inclui segredos, dependências ou arquivos compilados.

```powershell
cd "C:\Users\yago\Downloads\Radasa-System-Cloudflare-v1.4"
pnpm install --frozen-lockfile
pnpm run test:ciot
pnpm run check
pnpm run build:cloudflare
```

Não houve alteração de schema nem migração de banco nesta atualização. Os dados novos ficam em payloadAntt dos registros existentes.

## 2. Certificado no Cloudflare

Cadastrar o PFX em Empresa permite uso pelo servidor Node.js, mas NÃO cria automaticamente um binding mTLS no Cloudflare. O Worker precisa do certificado e da chave PEM cadastrados na conta Cloudflare.

Se o MESMO certificado já está vinculado ao Worker como SEFAZ_MTLS, o CIOT o reaproveita automaticamente. O configurador também encontra o certificate_id desse vínculo, sem redigitar CNPJ ou ID. Preserve seu wrangler.jsonc local.

Se o certificado existe na conta, mas não está vinculado ao Worker, consulte seu ID:

```powershell
pnpm exec wrangler mtls-certificate list
```

Caso ainda não esteja cadastrado, use OpenSSL para extrair certificado/cadeia e chave em uma pasta privada. Os comandos pedem a senha do PFX no terminal; não inclua a senha nos comandos nem no código:

```powershell
openssl pkcs12 -in "C:\certificados\empresa.pfx" -nokeys -out "C:\certificados\ciot-cert.pem"
openssl pkcs12 -in "C:\certificados\empresa.pfx" -nocerts -nodes -out "C:\certificados\ciot-key.pem"
pnpm exec wrangler mtls-certificate upload --cert "C:\certificados\ciot-cert.pem" --key "C:\certificados\ciot-key.pem" --name radasa-ciot
```

Guarde a chave privada fora do projeto. Depois de concluir o cadastro, remova a cópia PEM sem senha que não for mais necessária. Use o ID retornado pelo Wrangler na configuração a seguir.

## 3. Configurar homologação

```powershell
pnpm run ciot:configurar --environment homologacao
pnpm run deploy:cloudflare
```

O comando acima reutiliza o vínculo ANTT_CIOT_MTLS ou SEFAZ_MTLS existente no wrangler.jsonc. Se ainda não houver nenhum, depois de cadastrar o certificado execute uma vez:

```powershell
pnpm run ciot:configurar --certificate-id ID_REAL_RETORNADO_PELO_WRANGLER --environment homologacao
```

O configurador preserva os outros bindings/variáveis, cria um backup de wrangler.jsonc e adiciona:

- ANTT_CIOT_MTLS: binding do certificado.
- A configuração duplicada ANTT_CIOT_MTLS_CNPJ é removida; a identidade vem do cadastro vinculado.
- ANTT_CIOT_ENVIRONMENT=homologacao.
- ANTT_CIOT_ENABLE_NETWORK=true.
- ANTT_CIOT_BASE_URL=https://appservices-hml.antt.gov.br/pefServices.

Somente o CNPJ vinculado pode emitir nesta implantação. O usuário confirmou como emitente D. BARBIERO & CIA LTDA, CNPJ 15.209.274/0001-62. O diagnóstico e o teste local já usam esse cadastro; a seleção continua vindo do banco, sem CNPJ fixo no código. Não altere o vínculo para o outro CNPJ do grupo. A mesma trava vale para homologação e produção. Se houver mais de uma ativa na primeira utilização, marque apenas a emitente como padrão em Cadastros > Empresa.

O primeiro acesso à configuração ou à criação de CIOT persiste o vínculo. Ele não pode ser sobrescrito pela API genérica de configurações. Se o CNPJ do cadastro divergir do vínculo, a mensagem informa o CNPJ esperado: restaure esse mesmo número em Cadastros > Empresa. Isso também corrige uma edição simultânea ao primeiro vínculo; não libera um novo CNPJ. Se o cadastro original tiver sido excluído antes da proteção ou se o vínculo inicial estiver incorreto, solicite revisão administrativa do banco; não existe troca automática para outro CNPJ.

Salvar um PFX no banco não provisiona um certificado no Cloudflare: a infraestrutura mTLS precisa estar vinculada uma vez. Esta atualização reaproveita o vínculo SEFAZ existente, mas não envia o certificado para a Cloudflare nem gerencia sua renovação automaticamente. Ao renovar o A1 no cadastro, atualize também o vínculo mTLS antes de emitir.

### Gerador oficial do identificador

Os serviços de negócio usam `/pefServices/api/`. O gerador é separado, em `/pefServices/gerar`, com corpo `{ "cpfCnpj": "CNPJ_DA_EMPRESA" }`. A aplicação aceita somente identificadores retornados pelo gerador, nunca um número inventado ou enviado pelo navegador.

Quando o acesso ao gerador exigir uma chave oficialmente fornecida pela ANTT, configure-a como secret:

```powershell
pnpm exec wrangler secret put ANTT_CIOT_GENERATOR_KEY
```

Nesse modo o servidor solicita token em `/pefServices/token`, enviando a chave no header `chave`, e usa o token apenas para a solicitação ao gerador. Nenhuma chave, token ou credencial de terceiros foi embutida nesta atualização. Sem chave configurada, tenta o gerador com o próprio mTLS; se a ANTT não aceitar essa modalidade, a aplicação informa a falha e NÃO declara a operação. Confirme a habilitação junto à ANTT e obtenha a credencial apropriada; o contrato DCS dos serviços de negócio, sozinho, não documenta o acesso do gerador.

## 4. Validar pelo sistema

1. Em Cadastros > Empresa, confira a empresa ativa, seu CNPJ, RNTRC, certificado e senha. Se houver várias ativas antes do primeiro vínculo, marque apenas a emitente como padrão.
2. Em Fiscal > CIOT > Configuração ANTT, confira ambiente e execute diagnóstico e consulta de frota.
3. Gere um registro de teste, importando XMLs ou preenchendo manualmente. Informe localização IBGE/CEP, distância inteira, datas, destinatário, carga e recebimento. A chave Pix não é presumida a partir do CNPJ.
4. Informe os eixos de cada veículo: automotor de 2 a 4; cada implemento separado. Não envie o total da composição como eixos do cavalo-trator.
5. Revise as pendências e clique em Emitir em homologação. Confira autorização, número e verificador. Em caso de rejeição, corrija os dados conforme mensagem oficial. Em caso de comunicação inconclusiva, use Consultar resultado.
6. Teste consulta, encerramento/cancelamento em homologação. Os números desse ambiente não têm validade para uma viagem real.

A tabela de piso mínimo que já existia no projeto é apresentada apenas como estimativa, identificando seu fundamento. Ela não bloqueia baseada em coeficientes possivelmente desatualizados: a ANTT aplica a validação oficial vigente e pode rejeitar o valor informado.

## 5. Publicar em produção depois de homologar

```powershell
pnpm run ciot:configurar --environment producao
pnpm run deploy:cloudflare
```

Use credencial de gerador compatível com o ambiente escolhido. A tela exige confirmação antes de registrar uma operação em produção. Homologação e produção nunca devem compartilhar IDs de operação.

A integração direta elimina a dependência da mensalidade da Tech4Log para esta função. Certificado, hospedagem e demais custos próprios da operação continuam existindo. A emissão está sujeita ao enquadramento e às validações oficiais da empresa.

## Referências

- ANTT CIOT Para Todos: https://www.gov.br/antt/pt-br/assuntos/cargas/ciot-para-todos-1
- Documentação técnica: https://www.gov.br/antt/pt-br/assuntos/cargas/ciot-para-todos-1/documentos-tecnicos
- DCS PEF: https://www.gov.br/antt/pt-br/assuntos/cargas/pagamento-eletronico-de-fretes-pef-ciot/documento-de-contrato-de-servico.pdf
- Cloudflare mTLS: https://developers.cloudflare.com/workers/runtime-apis/bindings/mtls/

Dois arquivos ausentes no ZIP leve original foram recuperados sem editar do repositório yagonzk/radasa-system, branch principal: server/data/pedagios-brasil.ts e server/data/pedagios-nacional.generated.ts. Isso evita falha de importação ao compilar o Worker.

## Resultado das verificações desta entrega

- 34 testes do módulo CIOT: passaram (protocolo, ciclo de emissão, importação XML, vínculo único de empresa e isolamento/reaproveitamento de mTLS e compatibilidade de redirecionamento no Cloudflare).
- TypeScript: sem erros após restaurar os arquivos de código ausentes do ZIP original.
- Build da interface: passou. Há avisos de seletores CSS preexistentes.
- Empacotamento do Worker com Wrangler em dry-run: passou; nenhuma publicação foi executada.
- Configurador Cloudflare: verificado em diretório temporário, preservando variáveis e outros bindings.
- Dois testes gerais preexistentes falham sem relação com esta mudança: `test-api-stability-regression.ts` exige concorrência 3, enquanto o bootstrap já usa 2; `test-romaneio-v8-regression.ts` exige parser 2026.08.11.03, enquanto o parser já informa 2026.08.11.07. Os dois testes e os arquivos relacionados permanecem idênticos aos do ZIP recebido.

## Correção do erro 500 no diagnóstico e na frota (15/10/2026)

O log real do Worker identificou `Invalid redirect value`: o runtime Cloudflare aceita `manual` e `follow`, mas não `error`. O transporte ANTT passou a usar `manual` e a rejeitar explicitamente respostas HTTP 3xx antes de interpretar o corpo ou seguir qualquer destino. Não foi alterado o certificado ou o vínculo de CNPJ. Dois testes reproduzem a restrição do runtime e verificam o bloqueio de redirecionamentos.

Após aplicar este pacote, basta publicar novamente com `pnpm run deploy:cloudflare`; não é necessário repetir a configuração do certificado já vinculado. Execute novamente os testes de conexão/RNTRC e frota. Esta correção resolve a incompatibilidade identificada no log; a comunicação real com a ANTT ainda precisa ser validada após a publicação.

## Diagnóstico de resposta externa sem JSON (15/10/2026)

O relatório local fornecido confirmou código 111 nas consultas de transportador e frota, CNPJ 15.209.274/0001-62, RNTRC ativo 051312577, tipo ETC, EquiparadoTAC=false e placa RAX6E36 com vínculo 1. Isso valida essas consultas em homologação pelo computador com o A1 utilizado; não comprova emissão nem identidade do certificado guardado no Cloudflare.

Para comparar com o Worker, respostas sem JSON agora incluem, no retorno técnico, serviço, endpoint, método, HTTP, Content-Type, Server, ambiente, CNPJ consultado e até 1.600 caracteres de texto sanitizado da resposta externa. HTML/scripts, cookies, chaves privadas e valores rotulados como credenciais não são repassados. Nenhum cabeçalho ou segredo da requisição é incluído. HTTP 5xx externo sem JSON é classificado como falha de gateway (502). A captura acrescenta evidência para investigação; não corrige por si só a origem do HTTP 500 externo.

Publique com `pnpm run deploy:cloudflare`, execute apenas o teste de conexão/RNTRC e abra Ver retorno técnico para obter `details`. Certificado, ambiente, CNPJ vinculado e regras de envio permanecem iguais. A emissão continua dependente de homologação efetiva.
