import type { Layout } from '../../shared/types';

export function renderLayoutEditor(layout: Layout | undefined): string {
  return `
    <section class="panel-section">
      <h4>Layout</h4>
      <label>Columns</label>
      <select data-bind="layout-columns">
        ${[1, 2, 3, 4]
          .map((columns) => `<option value="${columns}" ${layout?.columns === columns ? 'selected' : ''}>${columns}</option>`)
          .join('')}
      </select>
      <label>Style</label>
      <select data-bind="layout-style">
        ${['default', 'card', 'compact']
          .map((style) => `<option value="${style}" ${layout?.style === style ? 'selected' : ''}>${style}</option>`)
          .join('')}
      </select>
    </section>
  `;
}
