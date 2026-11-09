interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** Texto ao lado do controle. Sem ele, `ariaLabel` é obrigatório. */
  label?: string;
  ariaLabel?: string;
  disabled?: boolean;
  testId: string;
}

/**
 * Liga/desliga acessível: um `<button role="switch">`, que leitores de tela
 * anunciam como "ativado"/"desativado" e que responde a espaço e Enter.
 */
export function Switch({ checked, onChange, label, ariaLabel, disabled, testId }: SwitchProps) {
  const control = (
    <button
      type="button"
      role="switch"
      class="switch"
      aria-checked={checked}
      aria-label={label ? undefined : ariaLabel}
      title={label ? undefined : ariaLabel}
      disabled={disabled}
      onClick={() => {
        onChange(!checked);
      }}
      data-testid={testId}
    >
      <span class="switch__thumb" />
    </button>
  );
  if (!label) return control;
  // O `<label>` faz o texto inteiro clicável e dá nome ao botão.
  return (
    <label class="switch-row">
      <span class="switch-row__label">{label}</span>
      {control}
    </label>
  );
}
