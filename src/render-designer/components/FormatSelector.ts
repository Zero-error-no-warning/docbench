import type { OutputConfig } from '../../shared/types';

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

export function renderFormatSelector(outputs: OutputConfig[], selectedOutputId?: string): string {
  return outputs
    .map(
      (output) => `
        <button class="format-item ${output.id === selectedOutputId ? 'active' : ''}" data-select-output="${output.id}">
          <strong>${escapeHtml(output.name)}</strong>
          <small>${escapeHtml(output.format)}</small>
        </button>
      `,
    )
    .join('');
}
