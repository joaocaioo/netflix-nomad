import type { PlayerApiCommand, TitleInfo } from './messages';

/**
 * Ponte entre o content script e o script injetado na página. O content
 * script roda num mundo isolado e não enxerga `window.netflix`; o script da
 * página enxerga, mas não acessa a API da extensão. Os dois conversam por
 * eventos no elemento `<script>` injetado, com o conteúdo em JSON: objetos
 * não atravessam a fronteira entre os mundos.
 */

/**
 * O que o content script pede ao player. Mudo e volume chegam do popup como
 * comandos relativos (`toggleMute`, `changeVolume`) e viram valores absolutos
 * em `runCommand`. A Netflix reaplica o próprio estado sobre o `<video>`,
 * então mexer direto nele não dura: o mudo, por exemplo, volta sozinho.
 */
export type ApiAction =
  PlayerApiCommand | { type: 'setMuted'; muted: boolean } | { type: 'setVolume'; volume: number };

export type BridgeRequest = ApiAction | { type: 'getTitle' };

export type BridgeResponse = { ok: true; title?: TitleInfo } | { ok: false };

const REQUEST_EVENT = 'netflix-nomad:request';
const RESPONSE_EVENT = 'netflix-nomad:response';

interface Envelope<T> {
  id: number;
  payload: T;
}

/** Lado do content script: envia pedidos e espera a resposta até `timeoutMs`. */
export function createBridge(
  target: EventTarget,
  timeoutMs = 2000,
): (request: BridgeRequest) => Promise<BridgeResponse> {
  let nextId = 0;
  const pending = new Map<number, (response: BridgeResponse) => void>();

  target.addEventListener(RESPONSE_EVENT, (event) => {
    const envelope = parse<BridgeResponse>(event);
    if (!envelope) return;
    pending.get(envelope.id)?.(envelope.payload);
    pending.delete(envelope.id);
  });

  return (request) =>
    new Promise((resolve) => {
      const id = nextId++;
      const timer = setTimeout(() => {
        pending.delete(id);
        resolve({ ok: false });
      }, timeoutMs);
      pending.set(id, (response) => {
        clearTimeout(timer);
        resolve(response);
      });
      dispatch(target, REQUEST_EVENT, { id, payload: request });
    });
}

/** Lado da página: atende cada pedido com `handle`. */
export function serveBridge(
  target: EventTarget,
  handle: (request: BridgeRequest) => Promise<BridgeResponse>,
): void {
  target.addEventListener(REQUEST_EVENT, (event) => {
    const envelope = parse<BridgeRequest>(event);
    if (!envelope) return;
    void handle(envelope.payload)
      .catch((): BridgeResponse => ({ ok: false }))
      .then((payload) => {
        dispatch(target, RESPONSE_EVENT, { id: envelope.id, payload });
      });
  });
}

function dispatch<T>(target: EventTarget, type: string, envelope: Envelope<T>): void {
  target.dispatchEvent(new CustomEvent(type, { detail: JSON.stringify(envelope) }));
}

function parse<T>(event: Event): Envelope<T> | null {
  const { detail } = event as CustomEvent<unknown>;
  if (typeof detail !== 'string') return null;
  try {
    return JSON.parse(detail) as Envelope<T>;
  } catch {
    return null;
  }
}
