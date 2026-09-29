# Pico de Vendas via WhatsApp

MVP semiautomatico baseado na arquitetura aprovada: painel Next.js, autenticacao e fila no Supabase, gateway Evolution em uma estacao Linux e publicacao privada pelo Cloudflare Tunnel.

## O que esta pronto

- Login com Supabase Auth e sessao SSR.
- Criacao de campanha em rascunho com ate 500 mensagens.
- Teste obrigatorio para um numero autorizado antes da liberacao.
- Autorizacao, pausa, retomada e estados auditaveis.
- Reserva atomica da fila com `FOR UPDATE SKIP LOCKED`.
- Chave unica de idempotencia e bloqueio de duplicidade.
- Provider Evolution isolado para futura troca pela API oficial da Meta.
- Health check separado entre gateway e sessao do WhatsApp.
- Compose local sem publicar banco ou Redis e com a API ligada apenas em `127.0.0.1`.
- Scripts de backup, restore e diagnostico.

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
7. No Cloudflare Zero Trust, crie um Tunnel apontando o hostname para `http://evolution-api:8080`, proteja-o com Access e configure um Service Token nas variaveis do painel.
8. Crie a instancia indicada por `EVOLUTION_INSTANCE`, leia o QR Code e confirme o estado conectado.

## Operacao segura

1. Importe ou cole as mensagens e crie o rascunho.
2. Revise amostras e totais.
3. Execute o teste, que sempre usa `AUTHORIZED_TEST_NUMBER`.
4. Autorize a campanha somente depois do teste.
5. Acione `POST /api/queue/process` repetidamente pelo painel ou por um worker autorizado, uma mensagem por chamada.
6. Pause a campanha se o gateway ou WhatsApp ficar indisponivel.

## Antes da producao

Fixe e valide a imagem exata da Evolution disponível no registro, teste backup e restore, configure UPS e auto power-on, homologue primeiro com 5, depois 20 e 50 destinatarios, e obtenha aprovacao corporativa para canal e dados.
