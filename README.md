# Pico de Vendas via WhatsApp

MVP semiautomatico baseado na arquitetura aprovada: painel Next.js, autenticacao e fila no Supabase, gateway Evolution em uma estacao Linux e publicacao privada pelo Cloudflare Tunnel.

## O que esta pronto

- Login com Supabase Auth e sessao SSR.
- Criacao de campanha em rascunho com ate 500 mensagens.
- Teste obrigatorio para um grupo fixo autorizado antes da liberacao.
- Autorizacao, pausa, retomada e estados auditaveis.
- Reserva atomica da fila com `FOR UPDATE SKIP LOCKED`.
- Chave unica de idempotencia e bloqueio de duplicidade.
- Provider Evolution isolado para futura troca pela API oficial da Meta.
- Health check separado entre gateway e sessao do WhatsApp.
- Compose local sem publicar banco ou Redis e com a API ligada apenas em `127.0.0.1`.
- Scripts de backup, restore e diagnostico.
- Importacao da planilha de pico em `.xlsx`, com leitura do dia da semana na linha superior.
- Cruzamento opcional server-side com a API corporativa de escalas, sem expor a chave no navegador.
- Previa por loja com faixa de pico, cobertura planejada e mensagem final.
- Criacao somente em rascunho: o cruzamento nunca autoriza nem dispara mensagens.
- Gestao online de ate duas contas do WhatsApp, com QR Code e escolha da conta por campanha.
- Segmentacao dinamica por planilha complementar, com filtros por regional, estado e demais colunas.
- Resumo para diretores quando a segmentacao inclui `TELEFONE_DIRETOR`.
- Anonimizacao automatica de telefone e mensagem depois de um envio bem-sucedido.
- Troca obrigatoria da senha temporaria no primeiro acesso de novos usuarios.
- Autenticacao TOTP obrigatoria no primeiro acesso e em todos os acessos seguintes.
- Area administrativa com perfis master, administrador, operador e consulta.
- Organizacao por grupos, com usuarios vinculados a um ou mais grupos.
- Senha temporaria, redefinicao de senha e redefinicao de 2FA controladas por perfil.
- Auditoria de login, configuracoes e operacoes de campanha.
- Delay aleatorio configuravel, fracionamento em lotes e alerta acima de 250 destinatarios.
- Envio imediato ou agendado no fuso `America/Sao_Paulo`.
- Anexos privados: ate um PDF e tres imagens de 10 MB por campanha.
- Link individual de confirmacao, com token aleatorio, validade de sete dias e uso unico.
- Painel diario com enviados, confirmados, respostas, reacoes, pendencias e agendamentos.

## Custo zero e limitacoes

O painel pode ser usado nos planos gratuitos do Supabase e Vercel para desenvolvimento pessoal. O plano Hobby da Vercel nao e destinado a uso comercial e seu cron gratuito so executa uma vez por dia. Por isso, o MVP processa a fila por acao do operador. Para uso corporativo, valide termos, limites e aprovacao de TI.

A Evolution API 2.4 passou a exigir ativacao de licenca. O compose usa temporariamente a linha 2.3.x para manter custo zero. Essa escolha deve passar por validacao de seguranca antes de producao e nao substitui a WhatsApp Business Platform oficial.

## Configuracao

1. Crie um projeto Supabase e execute `supabase/migrations/001_initial.sql` no SQL Editor.
2. Crie pelo menos um usuario em Authentication.
3. Copie `.env.example` para `.env.local` e preencha as chaves.
4. Instale dependencias com `pnpm install` e rode `pnpm dev`.
5. Na estacao Ubuntu, copie a pasta `gateway` para `/opt/whatsapp-gateway`.
6. Copie `gateway/.env.example` para `gateway/.env`, troque todos os segredos e suba com `docker compose up -d`.
7. Sem dominio proprio, inicie o `cloudflared` do compose como Quick Tunnel e use a URL `trycloudflare.com` gerada nas variaveis do painel. Esse endereco muda quando o conteiner do tunnel e recriado. Para um endereco permanente, adicione futuramente um dominio ao Cloudflare Zero Trust e proteja-o com Access.
8. Crie a instancia indicada por `EVOLUTION_INSTANCE`, leia o QR Code e confirme o estado conectado.
9. Configure `ESCALA_API_URL` e `ESCALA_API_KEY` apenas no ambiente do servidor.

## Grupo fixo de teste

O painel permite cadastrar os integrantes que recebem os testes de todas as campanhas. Os celulares ficam salvos no Supabase, protegidos para acesso exclusivo das rotas do servidor, e aparecem mascarados no portal. Uma campanha so avanca para autorizacao quando o teste chega a todos os integrantes ativos.

Mantenha pelo menos um integrante ativo. O numero antigo configurado em `AUTHORIZED_TEST_NUMBER` e importado automaticamente quando o grupo ainda esta vazio.

## Administracao e seguranca

O administrador master e definido pelo e-mail corporativo configurado na migration e nao aparece na lista administrativa. Sua exclusao somente pode ocorrer diretamente no banco. Administradores gerenciam usuarios dos grupos atribuidos; operadores preparam e executam campanhas; o perfil de consulta e somente leitura.

Novos usuarios recebem uma senha temporaria aleatoria, exibida uma unica vez ao administrador. No primeiro acesso, o usuario troca a senha e ativa um autenticador TOTP. O master pode remover o fator cadastrado para obrigar uma nova configuracao.

## Envios, anexos e confirmacoes

Cada campanha guarda uma copia das regras de delay, lote e pausa vigentes no momento da criacao. O intervalo entre mensagens e sorteado entre o minimo e o maximo configurados. Acima de 250 destinatarios, o portal exige ciencia do risco de bloqueio e limita a recomendacao a lotes de ate 100.

Anexos ficam em bucket privado do Supabase e sao entregues ao gateway por URL assinada de curta duracao. O log guarda texto, nome dos materiais, destinatario mascarado e resultado pelo prazo definido pelo administrador. Prazo zero significa retencao ilimitada.

O link de confirmacao usa token aleatorio, armazena somente seu hash, expira em sete dias e registra apenas a primeira confirmacao. Respostas e reacoes possuem estrutura de dados e indicadores no painel, mas a coleta por webhook da Evolution ficou para a segunda etapa.

Agendamentos sao registrados no horario de Brasilia. No plano gratuito, a execucao precisa do portal aberto ou de um worker local continuamente ativo; a Vercel gratuita nao garante disparo no minuto exato.

## Planejamento por pico e escala

1. No painel, abra `Preparar envio` e envie a planilha `.xlsx`.
2. Selecione o dia da semana. O sistema usa os campos `Ggl`, `Regional`, `cod_loja`, `nome_loja`, `TELEFONE` e a coluna `Faixa_Horario` abaixo do dia escolhido.
3. Ative o cruzamento com escala quando a mensagem depender da quantidade de colaboradores. Desative para comunicados gerais.
4. Edite o texto, limpe-o ou restaure o modelo original. Textos personalizados sao respeitados inclusive quando uma loja nao possui escala.
5. Revise a previa, a quantidade de colaboradores com cobertura no pico quando aplicavel e todos os alertas.
6. Clique em `Criar campanha em rascunho` somente depois da conferencia.
7. O fluxo de teste e autorizacao continua separado e obrigatorio.

A planilha opcional `segmentacao.xlsx` deve ter `COD` ou `COD_LOJA` na primeira coluna. As demais colunas viram filtros automaticamente. Para gerar resumos de diretores, inclua `REGIONAL` e `TELEFONE_DIRETOR`. Cada linha do resumo apresenta loja, pico, colaboradores no pico e a media diaria estimada. A media usa as horas totais escaladas divididas pela amplitude do horario da loja.

Quando uma loja nao possui escala localizada, ela continua na campanha e recebe uma mensagem que informa explicitamente a ausencia da escala.

## Privacidade

Os arquivos originais das planilhas sao processados em memoria e nao sao armazenados. A preparacao normalizada fica salva temporariamente no Supabase, conforme a retencao definida pelo administrador, para permitir continuidade em outro dispositivo autorizado. Enquanto uma mensagem aguarda envio, telefone e texto ficam na fila protegida. Depois do sucesso, esses campos sao apagados e o historico conserva apenas status, data, identificador do provedor, hash e os quatro ultimos digitos do telefone. Os numeros do grupo fixo de teste ficam acessiveis somente pelas rotas protegidas do servidor.

A API de escalas atualmente devolve no maximo 1000 registros historicos por consulta. Lojas sem escala encontrada permanecem no rascunho, aparecem como alerta e recebem a informacao de ausencia de escala quando o modelo original estiver em uso. Para cobrir toda a rede com garantia, a API deve oferecer paginacao, consulta em lote ou um endpoint de estado atual por loja.

## Operacao segura

1. Importe ou cole as mensagens e crie o rascunho.
2. Revise amostras e totais.
3. Execute o teste, que sempre envia para todos os integrantes ativos do grupo fixo.
4. Autorize a campanha somente depois do teste.
5. Acione `POST /api/queue/process` repetidamente pelo painel ou por um worker autorizado, uma mensagem por chamada.
6. Pause a campanha se o gateway ou WhatsApp ficar indisponivel.

## Antes da producao

Fixe e valide a imagem exata da Evolution disponível no registro, teste backup e restore, configure UPS e auto power-on, homologue primeiro com 5, depois 20 e 50 destinatarios, e obtenha aprovacao corporativa para canal e dados.
