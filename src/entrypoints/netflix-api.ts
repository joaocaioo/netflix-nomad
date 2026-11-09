import { defineUnlistedScript } from 'wxt/utils/define-unlisted-script';
import { serveBridge } from '@/lib/bridge';
import { watchId } from '@/lib/netflix';
import {
  handleRequest,
  pickPlayer,
  type NetflixPage,
  type NetflixPlayer,
  type NetflixVideo,
} from '@/lib/netflix-api';

/** Caminho até o player em `window.netflix`, como a Netflix o expõe. */
interface NetflixGlobal {
  netflix?: {
    appContext: {
      state: {
        playerApp: {
          getAPI(): {
            videoPlayer: {
              getAllPlayerSessionIds(): string[];
              getVideoPlayerBySessionId(id: string): NetflixPlayer;
            };
          };
          getState(): {
            videoPlayer: {
              videoMetadata: Record<
                number,
                { _metadataObject?: { video?: NetflixVideo } } | undefined
              >;
            };
          };
        };
      };
    };
  };
}

/**
 * Roda no mundo da própria página, injetado pelo content script, porque só
 * ali existe `window.netflix`. Atende os pedidos que chegam pela ponte.
 */
export default defineUnlistedScript(() => {
  const script = document.currentScript;
  if (!script) return;
  serveBridge(script, (request) => {
    const page = findPage();
    return page ? handleRequest(page, request) : Promise.resolve({ ok: false });
  });
});

/** `null` fora do player ou enquanto ele carrega. */
function findPage(): NetflixPage | null {
  try {
    const { netflix } = window as typeof window & NetflixGlobal;
    if (!netflix) return null;
    const { playerApp } = netflix.appContext.state;
    const { videoPlayer } = playerApp.getAPI();
    const players = videoPlayer
      .getAllPlayerSessionIds()
      .map((id) => videoPlayer.getVideoPlayerBySessionId(id));
    const player = pickPlayer(players, watchId(location.pathname));
    if (!player) return null;
    const metadata = playerApp.getState().videoPlayer.videoMetadata[player.getMovieId()];
    return { player, video: metadata?._metadataObject?.video };
  } catch {
    return null;
  }
}
