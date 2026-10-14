import type { Field } from '../../shared/types';

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

export function renderArrayEditor(field: Field | undefined): string {
  if (!field || field.type !== 'array') {
    return '';
  }
  const childFields = field.fields ?? [];
  return `
    <section class="panel-section nested-section">
      <div class="section-header-inline">
        <h4>Array item schema</h4>
        <button data-action="add-array-child">Add item field</button>
      </div>
      ${childFields.length
        ? childFields
            .map(
              (child) => `
                <div class="mini-card">
                  <strong>${escapeHtml(child.label || child.name)}</strong>
                  <small>${escapeHtml(child.type)}</small>
                </div>
              `,
            )
            .join('')
        : '<div class="empty-state compact">Define one or more fields for each repeated item.</div>'}
    </section>
  `;
}
