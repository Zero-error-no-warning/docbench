import type { AttachmentRef, Field, ValidationError } from '../../shared/types';
import { renderAttachmentList } from './FileAttachment';

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function errorsForField(field: Field, errors: ValidationError[]): string {
  const list = errors.filter((error) => error.fieldId === field.id || error.fieldId.startsWith(`${field.id}.`));
  if (!list.length) {
    return '';
  }
  return `<div class="field-errors">${list.map((error) => `<div>${escapeHtml(error.message)}</div>`).join('')}</div>`;
}

function renderPrimitiveField(field: Field, value: unknown): string {
  const stringValue = typeof value === 'string' ? value : '';
  switch (field.type) {
    case 'textarea':
      return `<textarea data-field-name="${field.name}" rows="4" placeholder="${escapeHtml(field.placeholder ?? '')}">${escapeHtml(stringValue)}</textarea>`;
    case 'number':
      return `<input data-field-name="${field.name}" type="number" value="${typeof value === 'number' ? value : ''}" placeholder="${escapeHtml(field.placeholder ?? '')}" />`;
    case 'date':
      return `<input data-field-name="${field.name}" type="date" value="${escapeHtml(stringValue)}" />`;
    case 'boolean':
    case 'checkbox':
      return `<label class="checkbox-row"><input data-field-name="${field.name}" type="checkbox" ${value ? 'checked' : ''} /> ${escapeHtml(field.label)}</label>`;
    case 'select':
      return `
        <select data-field-name="${field.name}">
          <option value="">Select...</option>
          ${(field.options ?? []).map((option) => `<option value="${escapeHtml(option.value)}" ${option.value === value ? 'selected' : ''}>${escapeHtml(option.label)}</option>`).join('')}
        </select>
      `;
    case 'multiselect':
      return `
        <select data-field-name="${field.name}" multiple>
          ${(field.options ?? []).map((option) => `<option value="${escapeHtml(option.value)}" ${Array.isArray(value) && value.includes(option.value) ? 'selected' : ''}>${escapeHtml(option.label)}</option>`).join('')}
        </select>
      `;
    case 'radio':
      return `
        <div class="radio-group">
          ${(field.options ?? []).map((option) => `<label><input data-field-name="${field.name}" type="radio" name="${field.id}" value="${escapeHtml(option.value)}" ${value === option.value ? 'checked' : ''} /> ${escapeHtml(option.label)}</label>`).join('')}
        </div>
      `;
    case 'file':
      return `<input data-field-name="${field.name}" type="file" />`;
    default:
      return `<input data-field-name="${field.name}" value="${escapeHtml(stringValue)}" placeholder="${escapeHtml(field.placeholder ?? '')}" />`;
  }
}

export function renderField(field: Field, value: unknown, errors: ValidationError[], attachments: AttachmentRef[]): string {
  if (field.type === 'array') {
    const items = Array.isArray(value) ? value : [];
    return `
      <div class="field-card">
        <div class="field-header">
          <div><strong>${escapeHtml(field.label)}</strong><small>${escapeHtml(field.help ?? '')}</small></div>
          <button data-action="add-array-item" data-field-name="${field.name}">Add item</button>
        </div>
        <div class="array-items">
          ${items.length
            ? items
                .map(
                  (entry, index) => `
                    <div class="array-item">
                      <textarea data-array-name="${field.name}" data-array-index="${index}" rows="3">${escapeHtml(typeof entry === 'string' ? entry : JSON.stringify(entry, null, 2))}</textarea>
                      <button data-action="remove-array-item" data-field-name="${field.name}" data-array-index="${index}">Remove</button>
                    </div>
                  `,
                )
                .join('')
            : '<div class="hint-card">No entries yet.</div>'}
        </div>
        ${errorsForField(field, errors)}
      </div>
    `;
  }

  if (field.type === 'table') {
    const rows = Array.isArray(value) ? value : [];
    return `
      <div class="field-card">
        <div class="field-header">
          <div><strong>${escapeHtml(field.label)}</strong><small>${escapeHtml(field.help ?? '')}</small></div>
          <button data-action="add-table-row" data-field-name="${field.name}">Add row</button>
        </div>
        <div class="table-scroll">
          <table>
            <thead>
              <tr>
                ${(field.columns ?? []).map((column) => `<th>${escapeHtml(column.label)}</th>`).join('')}
                <th></th>
              </tr>
            </thead>
            <tbody>
              ${rows.length
                ? rows
                    .map(
                      (row, rowIndex) => `
                        <tr>
                          ${(field.columns ?? [])
                            .map((column) => {
                              const cellValue = row && typeof row === 'object' ? (row as Record<string, unknown>)[column.id] : '';
                              return `<td><input data-table-name="${field.name}" data-row-index="${rowIndex}" data-column-id="${column.id}" value="${escapeHtml(String(cellValue ?? ''))}" /></td>`;
                            })
                            .join('')}
                          <td><button data-action="remove-table-row" data-field-name="${field.name}" data-row-index="${rowIndex}">✕</button></td>
                        </tr>
                      `,
                    )
                    .join('')
                : `<tr><td colspan="${(field.columns ?? []).length + 1}"><div class="hint-card">No rows yet.</div></td></tr>`}
            </tbody>
          </table>
        </div>
        ${errorsForField(field, errors)}
      </div>
    `;
  }

  if (field.type === 'object') {
    const objectValue = value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
    return `
      <div class="field-card">
        <div class="field-header"><div><strong>${escapeHtml(field.label)}</strong><small>${escapeHtml(field.help ?? '')}</small></div></div>
        <div class="nested-grid">
          ${(field.fields ?? [])
            .map(
              (child) => `
                <label>
                  <span>${escapeHtml(child.label)}</span>
                  <input data-object-name="${field.name}" data-child-name="${child.name}" value="${escapeHtml(String(objectValue[child.name] ?? ''))}" />
                </label>
              `,
            )
            .join('')}
        </div>
        ${errorsForField(field, errors)}
      </div>
    `;
  }

  return `
    <label class="field-card">
      <span class="field-label">${escapeHtml(field.label)} ${field.required ? '<em>*</em>' : ''}</span>
      ${field.type === 'boolean' || field.type === 'checkbox' ? '' : `<small>${escapeHtml(field.help ?? '')}</small>`}
      ${renderPrimitiveField(field, value)}
      ${field.type === 'file' ? renderAttachmentList(attachments, field.id) : ''}
      ${errorsForField(field, errors)}
    </label>
  `;
}
