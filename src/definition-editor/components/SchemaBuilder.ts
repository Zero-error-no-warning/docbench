import type { Section } from '../../shared/types';

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

export function renderSectionList(sections: Section[], selectedSectionId?: string): string {
  return sections
    .map(
      (section, index) => `
        <button class="list-item ${section.id === selectedSectionId ? 'active' : ''}" data-select-section="${section.id}">
          <span>
            <strong>${escapeHtml(section.title)}</strong>
            <small>${section.fields.length} fields</small>
          </span>
          <span class="pill">${index + 1}</span>
        </button>
      `,
    )
    .join('');
}
