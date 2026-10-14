import type { Section } from '../../shared/types';

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

export function renderSectionEditor(section: Section | undefined): string {
  if (!section) {
    return '<div class="empty-state">Select or create a section to begin.</div>';
  }
  return `
    <div class="panel-section">
      <label>Section title</label>
      <input data-bind="section-title" value="${escapeHtml(section.title)}" />
    </div>
    <div class="panel-section">
      <label>Description</label>
      <textarea data-bind="section-description" rows="3">${escapeHtml(section.description ?? '')}</textarea>
    </div>
  `;
}
