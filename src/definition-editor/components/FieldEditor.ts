import type { Field } from '../../shared/types';

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

export function renderFieldList(fields: Field[], selectedFieldId?: string): string {
  if (!fields.length) {
    return '<div class="empty-state">No fields yet. Add one from the toolbar.</div>';
  }
  return fields
    .map(
      (field, index) => `
        <article class="field-card ${field.id === selectedFieldId ? 'selected' : ''}" data-select-field="${field.id}">
          <div>
            <strong>${escapeHtml(field.label || field.name)}</strong>
            <div class="field-meta">${escapeHtml(field.type)}${field.required ? ' • required' : ''}</div>
          </div>
          <div class="field-toolbar">
            <button data-action="move-field-up" data-field-id="${field.id}" ${index === 0 ? 'disabled' : ''}>↑</button>
            <button data-action="move-field-down" data-field-id="${field.id}" ${index === fields.length - 1 ? 'disabled' : ''}>↓</button>
            <button data-action="remove-field" data-field-id="${field.id}">✕</button>
          </div>
        </article>
      `,
    )
    .join('');
}
