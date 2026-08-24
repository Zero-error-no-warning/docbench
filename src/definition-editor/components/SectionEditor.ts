import type { Section } from '../../shared/types';

export function renderSectionEditor(section: Section | undefined): string {
  if (!section) {
    return '<div class="empty-state">Select or create a section to begin.</div>';
  }
  return `
    <div class="panel-section">
      <label>Section title</label>
      <input data-bind="section-title" value="${section.title}" />
    </div>
    <div class="panel-section">
      <label>Description</label>
      <textarea data-bind="section-description" rows="3">${section.description ?? ''}</textarea>
    </div>
  `;
}
