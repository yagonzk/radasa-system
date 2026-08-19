# Radasa System v1.55 — Logs administrativos e responsividade global

## Logs do sistema

- A opção **Ver logs** agora é exibida somente para usuários com perfil `ADMIN`.
- A página de logs também valida o perfil do usuário no frontend.
- A API `/api/logs` foi protegida no backend com `requireRole(UserRole.ADMIN)`.
- Usuários não administradores recebem `403 Permissão insuficiente` mesmo tentando chamar a API diretamente.

## Responsividade global

A adaptação de layout deixou de ficar concentrada na tela de Abastecimentos e passou a ser aplicada à estrutura inteira do sistema.

- Sidebar vira menu lateral deslizante em telas menores, liberando a largura da área de trabalho.
- Cabeçalho móvel com botão de menu.
- Conteúdo principal usa largura máxima disponível, `min-width: 0` e proteção contra overflow horizontal indevido.
- Padding do conteúdo passa a acompanhar a resolução.
- Títulos e textos longos podem quebrar sem empurrar cards para fora da tela.
- Tabela de Logs ganhou rolagem horizontal em telas menores.
- Dashboard principal, Cadastros, Pedágios, Romaneios, Comissões, Abastecimentos, Almoxarifado, Pneus, CIOT, Aprovação de contas e páginas de perfil/senha receberam ajustes responsivos.
- Cards de resumo de Romaneios passam de 1/2/3/6 colunas conforme a largura disponível, evitando compressão em notebooks.
- Etapas do formulário de CIOT deixam de forçar 5 colunas em resoluções pequenas.
- Modais grandes do CIOT usam padding adaptativo.

## Banco de dados

Nenhuma migration nova foi adicionada nesta versão.
