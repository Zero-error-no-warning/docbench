import type { Field } from '../../shared/types';

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

export function renderTableEditor(field: Field | undefined): string {
  if (!field || field.type !== 'table') {
    return '';
  }
  return `
    <section class="panel-section nested-section">
      <div class="section-header-inline">
        <h4>Table columns</h4>
        <button data-action="add-table-column">Add column</button>
      </div>
      ${(field.columns ?? []).length
        ? `
            <div class="table-preview">
              ${(field.columns ?? [])
                .map(
                  (column, index) => `
                    <div class="table-column-row">
                      <span>${index + 1}. ${escapeHtml(column.label)}</span>
                      <small>${escapeHtml(column.type)}</small>
                    </div>
                  `,
                )
                .join('')}
            </div>
          `
        : '<div class="empty-state compact">Add columns for inline table editing.</div>'}
    </section>
  `;
}
