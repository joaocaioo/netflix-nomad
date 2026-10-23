import type { ControllerError } from './controller';

export const ERROR_MESSAGES: Record<ControllerError, string> = {
  NOT_NETFLIX: 'Abra uma aba da Netflix para usar o controle.',
  NOT_CONNECTED: 'A extensão ainda não está ativa nesta aba. Recarregue a página da Netflix.',
  NO_VIDEO: 'Nenhum vídeo encontrado. Abra um título para assistir.',
  PLAY_REJECTED: 'O navegador bloqueou a reprodução. Clique no vídeo e tente de novo.',
  CONTROL_NOT_FOUND: 'Esse controle não está disponível agora neste título.',
  NOMAD_NOT_FOUND: 'Nada para o Nomad Mode remover nesta página.',
};

/** Erros que não derrubam o popup: o vídeo continua lá, só a ação falhou. */
export const NOTICE_ERRORS = new Set<ControllerError>([
  'PLAY_REJECTED',
  'CONTROL_NOT_FOUND',
  'NOMAD_NOT_FOUND',
]);
