import type { ValidationRule } from '../../shared/types';

export function renderValidationEditor(rules: ValidationRule[] | undefined): string {
  const list = rules ?? [];
  return `
    <section class="panel-section">
      <div class="section-header-inline">
        <h4>Validation</h4>
        <button data-action="add-validation-rule">Add rule</button>
      </div>
      ${list.length
        ? list
            .map(
              (rule, index) => `
                <div class="rule-card">
                  <div class="rule-row">
                    <select data-rule-index="${index}" data-rule-prop="type">
                      ${['required', 'min', 'max', 'minLength', 'maxLength', 'pattern', 'custom']
                        .map((type) => `<option value="${type}" ${type === rule.type ? 'selected' : ''}>${type}</option>`)
                        .join('')}
                    </select>
                    <input data-rule-index="${index}" data-rule-prop="value" placeholder="value" value="${rule.value ?? ''}" />
                    <button data-action="remove-validation-rule" data-rule-index="${index}">✕</button>
                  </div>
                  <input data-rule-index="${index}" data-rule-prop="message" placeholder="Message" value="${rule.message}" />
                </div>
              `,
            )
            .join('')
        : '<div class="empty-state compact">No validation rules yet.</div>'}
    </section>
  `;
}
