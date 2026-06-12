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

1. No primeiro aparelho, abra **Ajustes → Sincronização** e toque em
   **"Criar código de sincronização"**.
2. Toque em **"Copiar"** (com o mesmo ID Apple, o texto copiado aparece no
   outro aparelho automaticamente pela Área de Transferência Universal).
3. No segundo aparelho, cole o código no campo e toque em **"Conectar"**.

A partir daí os dois aparelhos mostram os mesmos registros. A sincronização
acontece sozinha ao abrir o app, ao voltar para ele e logo depois de cada
alteração. Se estiver sem internet, as alterações ficam guardadas e sobem
quando a conexão voltar.

> Os dados ficam guardados em um cofre anônimo na nuvem (jsonblob.com ou,
> se ele estiver indisponível, jsonstorage.net — o app escolhe sozinho),
> identificado apenas pelo código — guarde o código e faça backups JSON de vez
> em quando pelo botão **Exportar backup**.

## Estrutura do projeto

| Arquivo | Função |
| --- | --- |
| `index.html` | Estrutura das telas (Início, Registros, Gráficos, Ajustes) |
| `app.js` | Lógica: registros, perfis, cálculos, gráficos e sincronização |
| `style.css` | Visual, com layout adaptado para iPhone e iPad |
| `sw.js` | Service worker — faz o app funcionar offline |
| `manifest.webmanifest` | Configuração do app instalável (PWA) |
| `chart.umd.js` | Biblioteca Chart.js 4.4.3 (gráficos), incluída localmente |
