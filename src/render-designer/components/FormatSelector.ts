import type { OutputConfig } from '../../shared/types';

export function renderFormatSelector(outputs: OutputConfig[], selectedOutputId?: string): string {
  return outputs
    .map(
      (output) => `
        <button class="format-item ${output.id === selectedOutputId ? 'active' : ''}" data-select-output="${output.id}">
          <strong>${output.name}</strong>
          <small>${output.format}</small>
        </button>
      `,
    )
    .join('');
}
