import preact from '@preact/preset-vite';
import { defineConfig } from 'wxt';
import { NETFLIX_MATCHES } from './src/lib/netflix';

export default defineConfig({
  srcDir: 'src',
  // Imports explícitos deixam claro de onde vem cada API.
  imports: false,
  vite: () => ({
    plugins: [preact()],
  }),
  manifest: ({ browser }) => ({
    name: 'Netflix Nomad',
    description: 'Controle remoto para o player da Netflix.',
    // Sem `tabs`, `scripting` ou `notifications`: o acesso a netflix.com basta
    // para ler a URL da aba e conversar com o content script.
    permissions: [],
    host_permissions: NETFLIX_MATCHES,
    // Script que o content script injeta na página para falar com o player.
    web_accessible_resources: [{ resources: ['netflix-api.js'], matches: NETFLIX_MATCHES }],
    // O Chrome aceita no máximo 4 atalhos com tecla sugerida; os demais
    // ficam sem tecla e podem ser definidos em chrome://extensions/shortcuts.
    commands: {
      'toggle-play': {
        suggested_key: { default: 'Alt+Shift+P' },
        description: 'Reproduzir ou pausar',
      },
      'toggle-mute': {
        suggested_key: { default: 'Alt+Shift+M' },
        description: 'Ativar ou desativar o som',
      },
      skip: {
        suggested_key: { default: 'Alt+Shift+S' },
        description: 'Pular abertura ou recapitulação',
      },
      'next-episode': {
        suggested_key: { default: 'Alt+Shift+N' },
        description: 'Próximo episódio',
      },
      'seek-back': { description: 'Voltar 10 segundos' },
      'seek-forward': { description: 'Avançar 10 segundos' },
    },
    ...(browser === 'firefox' && {
      browser_specific_settings: {
        gecko: {
          id: 'netflix-nomad@extension',
          // A extensão não coleta nem envia dados.
          data_collection_permissions: { required: ['none'] },
        },
      },
    }),
  }),
});
