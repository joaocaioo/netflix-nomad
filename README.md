<div align="center">

# Netflix Nomad

**Controle remoto para o player da Netflix, direto da barra do navegador.**

[![Baixar para Chrome](https://img.shields.io/badge/Baixar-Chrome-E50914?style=for-the-badge&logo=googlechrome&logoColor=white)](https://github.com/joaocaioo/netflix-nomad/releases/latest/download/netflix-nomad-chrome.zip)
[![Baixar para Firefox](https://img.shields.io/badge/Baixar-Firefox-E50914?style=for-the-badge&logo=firefoxbrowser&logoColor=white)](https://github.com/joaocaioo/netflix-nomad/releases/latest/download/netflix-nomad-firefox.zip)

[![Versão](https://img.shields.io/github/v/release/joaocaioo/netflix-nomad?label=vers%C3%A3o&color=222)](https://github.com/joaocaioo/netflix-nomad/releases/latest)
[![CI](https://github.com/joaocaioo/netflix-nomad/actions/workflows/ci.yml/badge.svg)](https://github.com/joaocaioo/netflix-nomad/actions/workflows/ci.yml)

</div>

---

## Funcionalidades

- ⏯️ Reproduzir e pausar
- ⏪ ⏩ Voltar e avançar 10 segundos
- ⏭️ Pular abertura e recapitulação
- 📺 Próximo episódio
- 🔊 Volume e mudo
- 🐢 🐇 Velocidade de 0,5× a 2×
- ⏱️ Tempo atual, duração e progresso
- 📋 Lista de episódios
- 💬 Áudio e legendas
- 🖥️ Tela cheia
- ↩️ Sair do título
- ⌨️ Atalhos de teclado

## Instalação

### Chrome, Edge, Brave e Opera

1. Baixe o **[netflix-nomad-chrome.zip](https://github.com/joaocaioo/netflix-nomad/releases/latest/download/netflix-nomad-chrome.zip)** e extraia.
2. Abra `chrome://extensions`.
3. Ative o **Modo do desenvolvedor** (canto superior direito).
4. Clique em **Carregar sem compactação** e selecione a pasta extraída.
5. Fixe o ícone pelo 🧩 da barra.

### Firefox

1. Baixe o **[netflix-nomad-firefox.zip](https://github.com/joaocaioo/netflix-nomad/releases/latest/download/netflix-nomad-firefox.zip)**. Não precisa extrair.
2. Abra `about:debugging#/runtime/this-firefox`.
3. Clique em **Carregar extensão temporária** e selecione o `.zip`.

> No Firefox, a extensão temporária sai ao fechar o navegador.

## Como usar

1. Abra a [Netflix](https://www.netflix.com) e dê play em um título.
2. Clique no ícone do **Netflix Nomad**.
3. Use os botões. O popup acompanha o vídeo em tempo real.

## Atalhos

| Atalho        | Ação                |
| ------------- | ------------------- |
| `Alt+Shift+P` | Reproduzir / pausar |
| `Alt+Shift+M` | Mudo                |
| `Alt+Shift+S` | Pular abertura      |
| `Alt+Shift+N` | Próximo episódio    |

Voltar e avançar 10 segundos ficam sem tecla padrão. Para definir ou trocar as teclas, abra `chrome://extensions/shortcuts`.

## Problemas comuns

| Mensagem                        | Solução                                                 |
| ------------------------------- | ------------------------------------------------------- |
| "Extensão ainda não está ativa" | Recarregue a página da Netflix (`F5`).                  |
| "Nenhum vídeo encontrado"       | Abra um filme ou episódio.                              |
| "Controle não está disponível"  | O botão não existe agora (ex.: pular fora da abertura). |
| Tela cheia não sai              | Aperte `F11` ou `Esc`.                                  |

## Privacidade

O Netflix Nomad só acessa `netflix.com`. Ele não coleta, não guarda e não envia nenhum dado.

## Desenvolvimento

```bash
npm install
npm run dev      # abre o Chrome com recarga automática
npm run build    # gera .output/chrome-mv3
npm run check    # typecheck, lint, formatação e testes
```

Feito com TypeScript, [WXT](https://wxt.dev), Preact, Vitest e Playwright.

### Publicar uma versão

```bash
npm version patch
git push --follow-tags
```

O GitHub Actions gera os `.zip` e cria a Release, e os botões de download passam a baixar a versão nova.
