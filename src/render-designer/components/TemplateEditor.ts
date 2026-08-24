import type { OutputConfig } from '../../shared/types';

export function renderTemplateEditor(output: OutputConfig | undefined): string {
  if (!output) {
    return '<div class="empty-state">Select an output to edit its template.</div>';
  }
  return `
    <section class="panel-section">
      <h3>${output.name}</h3>
      <p class="hint">Use Handlebars-like tokens such as {{title}}, {{address.city}}, and {{owner}}.</p>
      <label>Template type</label>
      <select data-bind="template-type">
        ${['html', 'handlebars', 'markdown']
          .map((type) => `<option value="${type}" ${output.template.type === type ? 'selected' : ''}>${type}</option>`)
          .join('')}
      </select>
      <label>Template content</label>
      <textarea data-bind="template-content" rows="18">${output.template.content}</textarea>
      <label>Styles</label>
      <textarea data-bind="template-styles" rows="6">${output.template.styles ?? ''}</textarea>
    </section>
  `;
}
