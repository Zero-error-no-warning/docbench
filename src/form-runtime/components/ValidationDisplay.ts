import type { ValidationResult } from '../../shared/types';

export function renderValidationDisplay(result: ValidationResult): string {
  if (result.valid) {
    return '<div class="validation-ok">All visible fields are valid.</div>';
  }
  return `
    <div class="validation-errors">
      <strong>${result.errors.length} validation issue(s)</strong>
      <ul>
        ${result.errors.map((error) => `<li><strong>${error.fieldId}</strong>: ${error.message}</li>`).join('')}
      </ul>
    </div>
  `;
}
