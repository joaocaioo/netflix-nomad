import { findNomadTarget } from './selectors';

/** Remove da página o elemento do Nomad Mode; devolve `false` se ele não existir. */
export function enterNomadMode(root: ParentNode = document): boolean {
  const target = findNomadTarget(root);
  if (!target) return false;
  target.remove();
  return true;
}
