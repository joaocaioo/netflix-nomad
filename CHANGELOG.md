# Changelog

Formato baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/). Versões seguem [SemVer](https://semver.org/lang/pt-BR/).

## [Não lançado]

### Adicionado

- Botão Nomad Mode, sempre ativo e disponível em qualquer página da Netflix.
- Seleção de episódio e de faixas de áudio e legenda direto no popup.

### Corrigido

- Voltar e avançar 10 segundos, pular abertura, próximo episódio, áudio e legendas e sair do título davam "Esse controle não está disponível" quando a Netflix não desenhava a barra de controles. Agora a extensão usa a API interna do player.
- O mudo era desfeito pela Netflix logo depois de ativado.

## [1.0.0] - 2026-10-23

### Adicionado

- Popup com reproduzir/pausar, voltar e avançar 10 segundos, pular abertura/recapitulação, próximo episódio, som, volume, velocidade (0,5× a 2×), lista de episódios, áudio e legendas, tela cheia e sair do título.
- Tempo atual, duração e barra de progresso, atualizados a cada segundo.
- Atalhos de teclado: `Alt+Shift+P`, `Alt+Shift+M`, `Alt+Shift+S`, `Alt+Shift+N`, além de voltar e avançar 10 segundos (sem tecla padrão).
- Mensagens de erro no popup com botão "Tentar de novo".
- Builds para Chrome e Firefox.
- Testes unitários (Vitest), testes de ponta a ponta (Playwright) e CI no GitHub Actions.
