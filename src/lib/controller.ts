import { browser, type Browser } from 'wxt/browser';
import type {
  CommandResult,
  NomadCommand,
  NomadResult,
  PlayerCommand,
  PlayerErrorCode,
  PlayerState,
  TitleCommand,
  TitleInfo,
  TitleResult,
} from './messages';
import { isNetflixUrl } from './netflix';

/** Erros vistos por quem comanda: os do content script mais os de conexão. */
export type ControllerError = 'NOT_NETFLIX' | 'NOT_CONNECTED' | PlayerErrorCode;

export type ControllerResult =
  { ok: true; state: PlayerState } | { ok: false; error: ControllerError };

export type NomadControllerResult = { ok: true } | { ok: false; error: ControllerError };

export interface TargetTab {
  id: number;
  windowId: number;
}

export type TargetTabResult = { ok: true; tab: TargetTab } | { ok: false; error: 'NOT_NETFLIX' };

/**
 * Lê `?tabId=` da URL do popup. Só é usado quando o popup é aberto como
 * página comum (testes e2e, depuração), em que a aba ativa é o próprio popup.
 */
export function parseTabIdOverride(search: string): number | undefined {
  const raw = new URLSearchParams(search).get('tabId');
  if (raw === null || !/^\d+$/.test(raw)) return undefined;
  return Number(raw);
}

/** Sem a permissão `tabs`, `tab.url` só vem preenchida em abas da Netflix. */
export function toTargetTab(tab: Browser.tabs.Tab | undefined): TargetTabResult {
  if (tab?.id === undefined || !isNetflixUrl(tab.url)) return { ok: false, error: 'NOT_NETFLIX' };
  return { ok: true, tab: { id: tab.id, windowId: tab.windowId } };
}

export async function getTargetTab(search = location.search): Promise<TargetTabResult> {
  const override = parseTabIdOverride(search);
  try {
    const tab =
      override === undefined
        ? (await browser.tabs.query({ active: true, currentWindow: true }))[0]
        : await browser.tabs.get(override);
    return toTargetTab(tab);
  } catch {
    return { ok: false, error: 'NOT_NETFLIX' };
  }
}

/**
 * Envia um comando ao content script. Se a aba foi aberta antes da extensão
 * ser instalada ou recarregada, não há ninguém escutando e o envio falha.
 */
export function sendCommand(tabId: number, command: PlayerCommand): Promise<ControllerResult> {
  return send<CommandResult>(tabId, command);
}

/** Título, episódios e faixas; `null` se o player não responder. */
export async function sendTitle(tabId: number): Promise<TitleInfo | null> {
  const result = await send<TitleResult>(tabId, { type: 'getTitle' });
  return result.ok ? result.title : null;
}

/** Ativa o Nomad Mode na aba. Não exige vídeo na página. */
export function sendNomad(tabId: number): Promise<NomadControllerResult> {
  return send<NomadResult>(tabId, { type: 'nomadMode' });
}

async function send<Result>(
  tabId: number,
  message: PlayerCommand | NomadCommand | TitleCommand,
): Promise<Result | { ok: false; error: 'NOT_CONNECTED' }> {
  try {
    const result = await browser.tabs.sendMessage<
      PlayerCommand | NomadCommand | TitleCommand,
      Result | undefined
    >(tabId, message);
    return result ?? { ok: false, error: 'NOT_CONNECTED' };
  } catch {
    return { ok: false, error: 'NOT_CONNECTED' };
  }
}

/**
 * Coloca a janela do navegador em tela cheia. `video.requestFullscreen()`
 * não funciona aqui: exige um gesto do usuário na página, e o clique no
 * popup não conta. Na página /watch o player já ocupa a janela inteira.
 */
export async function enterFullscreen(windowId: number): Promise<void> {
  await browser.windows.update(windowId, { state: 'fullscreen' });
}
