# Corpo em Progresso

Aplicativo para controle e registro de peso e medidas corporais, feito para
funcionar **sincronizado entre iPhone e iPad** (e qualquer outro navegador).

## O que ele faz

- **Registros**: peso, gordura corporal, cintura, quadril, braço, coxa, peito,
  pescoço e observações, por data e por perfil (várias pessoas no mesmo app).
- **Painel inicial**: peso atual, progresso até a meta, IMC com medidor visual,
  média de 7 dias, variação de 30 dias, sequência de dias registrados,
  tendência semanal e **previsão de quando a meta será atingida** no ritmo atual.
- **Gráficos**: peso com média móvel de 7 dias e linha da meta (períodos de
  30 dias, 90 dias, 1 ano ou tudo), evolução de cada medida, relação
  cintura/quadril, variação mensal em barras e calendário de consistência.
- **Tabelas**: histórico completo com a diferença de peso entre registros
  (▲/▼) e botões de editar/excluir, além de resumo mensal com média, mínimo,
  máximo e variação em relação ao mês anterior.
- **Backup**: exportar/importar em JSON e exportar planilha CSV.
- **Funciona offline**: depois do primeiro acesso, abre mesmo sem internet.

## Como instalar no iPhone e no iPad

1. Abra o endereço do app no **Safari**
   (se o GitHub Pages estiver ativado: `https://SEU-USUARIO.github.io/corpo-em-progresso/`).
2. Toque no botão de **compartilhar** (quadrado com seta para cima).
3. Escolha **"Adicionar à Tela de Início"**.
4. Pronto: o app abre em tela cheia, com ícone próprio, como um aplicativo normal.

> Para ativar o GitHub Pages: no repositório, vá em **Settings → Pages →
> Branch: main → Save**. Em alguns minutos o endereço acima fica disponível.

## Como sincronizar iPhone + iPad

A sincronização usa o **seu próprio GitHub** para guardar os dados — sem
serviços de terceiros. Configuração única:

1. Crie um token em
   [github.com/settings/personal-access-tokens/new](https://github.com/settings/personal-access-tokens/new):
   - **Token name**: `corpo-em-progresso`
   - **Expiration**: a maior validade disponível
   - **Repository access**: *Only select repositories* → `corpo-em-progresso`
   - **Permissions → Repository permissions → Contents**: *Read and write*
2. Toque em *Generate token* e copie o código `github_pat_…`.
3. No app, abra **Ajustes → Sincronização**, cole o token e toque em **Ativar**.
4. Repita o passo 3 no outro aparelho com o mesmo token (com o mesmo ID Apple,
   o texto copiado aparece no outro aparelho pela Área de Transferência Universal).

A partir daí os dois aparelhos mostram os mesmos registros. A sincronização
acontece sozinha ao abrir o app, ao voltar para ele e logo depois de cada
alteração. Se estiver sem internet, as alterações ficam guardadas e sobem
quando a conexão voltar.

> Os dados ficam no arquivo `sync/dados.json` do branch `dados` do repositório.
> Se o repositório for público, os dados também ficam públicos — para mantê-los
> privados, crie um repositório **privado** (ex.: `corpo-dados`), selecione-o ao
> gerar o token e informe-o no campo "Repositório" do app.

## Estrutura do projeto

| Arquivo | Função |
| --- | --- |
| `index.html` | Estrutura das telas (Início, Registros, Gráficos, Ajustes) |
| `app.js` | Lógica: registros, perfis, cálculos, gráficos e sincronização |
| `style.css` | Visual, com layout adaptado para iPhone e iPad |
| `sw.js` | Service worker — faz o app funcionar offline |
| `manifest.webmanifest` | Configuração do app instalável (PWA) |
| `chart.umd.js` | Biblioteca Chart.js 4.4.3 (gráficos), incluída localmente |
