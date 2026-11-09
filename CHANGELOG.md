# Changelog

Formato baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/). Versões seguem [SemVer](https://semver.org/lang/pt-BR/).

## [Não lançado]

### Adicionado

- Botão de ligar e desligar no topo do popup. Desligada, a extensão sai da página na hora, sem recarregar: o HUD some, os controles da Netflix voltam e os atalhos param de responder.
- **Pular abertura automaticamente** (desligado por padrão): pula recapitulação e abertura marcadas pela Netflix, uma vez por episódio, e avisa "Abertura pulada". Fica no popup e no painel de opções do HUD.
- **Próximo episódio automático** (ligado por padrão): nos créditos aparece "A seguir", com contagem de 5 segundos e o botão "Assistir créditos" para cancelar. A contagem para com o vídeo pausado.
- Aviso discreto de versão nova no pé do popup, que baixa direto o `.zip` do navegador em uso. Consulta o GitHub no máximo a cada 12 horas.

### Alterado

- Com a extensão ligada, os controles da própria Netflix (barra, voltar, pular abertura, próximo episódio, tela de pausa) ficam escondidos, para não aparecer um player sobre o outro. "Você ainda está assistindo?" e avisos de erro continuam aparecendo.
- Nova permissão `storage`, para guardar as preferências. Não gera aviso na instalação.

### Corrigido

- Depois de trocar de episódio, o HUD perdia o nome da série, o episódio e os botões de anterior e próximo. Ele guardava a primeira resposta do player, que chega antes dos metadados do episódio, e não pedia de novo.
- Depois de trocar de episódio sem recarregar, a extensão às vezes lia o player do episódio anterior.

## [1.1.0] - 2026-10-24

### Adicionado

- Controles sobre o vídeo: aparecem ao mexer o mouse e somem depois de 3 segundos parado, com linha do tempo, ±10 s, volume, próximo episódio, episódio, áudio, legendas, velocidade, tela cheia e sair do título.
- Clique no vídeo pausa e continua; duplo clique entra ou sai da tela cheia.
- Atalhos de teclado no player: `Espaço`/`K`, `←`/`→`, `↑`/`↓`, `M`, `F` e `S`.
- Linha do tempo navegável no popup e no vídeo: mostra o tempo sob o mouse e vai até onde você clicar ou arrastar.
- Botão Nomad Mode, sempre ativo e disponível em qualquer página da Netflix.
- Seleção de episódio e de faixas de áudio e legenda, e botão de episódio anterior.
- Logo e ícones próprios.
- Erros do popup com a saída certa: "Abrir a Netflix" (vai para uma aba já aberta, se houver) e "Recarregar a página", que reconecta sozinho.

### Alterado

- Popup redesenhado, com a logo, o título que está tocando e os controles agrupados por assunto. Volume agora é um controle deslizante, e velocidade, uma lista junto de episódio, áudio e legendas.
- Vermelho da marca (`#bb0416`) em toda a interface.
- Os controles só aparecem assistindo um filme ou episódio, não no catálogo nem com trailer tocando.
- "Pular" só aparece quando há o que pular, diz "Pular recapitulação" durante a recapitulação e pula também a abertura quando ela vem logo depois.
- A legenda sobe enquanto os controles estão na tela.

### Corrigido

- Voltar e avançar 10 segundos, pular abertura, próximo episódio, áudio e legendas e sair do título davam "Esse controle não está disponível" quando a Netflix não desenhava a barra de controles. Agora a extensão usa a API interna do player.
- Áudio e vídeo ficavam fora de sincronia depois de trocar o idioma do áudio.
- O mudo era desfeito pela Netflix logo depois de ativado.
- O popup mostrava "A extensão ainda não está ativa" quando aberto logo depois de a página carregar.
- A tela cheia não saía com `Esc`, e o primeiro clique em "Tela cheia" às vezes não fazia nada.

## [1.0.0] - 2026-10-23

### Adicionado

- Popup com reproduzir/pausar, voltar e avançar 10 segundos, pular abertura/recapitulação, próximo episódio, som, volume, velocidade (0,5× a 2×), lista de episódios, áudio e legendas, tela cheia e sair do título.
- Tempo atual, duração e barra de progresso, atualizados a cada segundo.
- Atalhos de teclado: `Alt+Shift+P`, `Alt+Shift+M`, `Alt+Shift+S`, `Alt+Shift+N`, além de voltar e avançar 10 segundos (sem tecla padrão).
- Mensagens de erro no popup com botão "Tentar de novo".
- Builds para Chrome e Firefox.
- Testes unitários (Vitest), testes de ponta a ponta (Playwright) e CI no GitHub Actions.
