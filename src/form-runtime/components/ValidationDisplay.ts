import type { ValidationResult } from '../../shared/types';

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

export function renderValidationDisplay(result: ValidationResult): string {
  if (result.valid) {
    return '<div class="validation-ok">All visible fields are valid.</div>';
  }
  return `
    <div class="validation-errors">
      <strong>${result.errors.length} validation issue(s)</strong>
      <ul>
        ${result.errors.map((error) => `<li><strong>${escapeHtml(error.fieldId)}</strong>: ${escapeHtml(error.message)}</li>`).join('')}
      </ul>
    </div>
  `;
}
