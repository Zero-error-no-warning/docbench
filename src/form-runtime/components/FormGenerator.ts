import { evaluateCondition } from '../../shared/schema';
import type { AttachmentRef, DefinitionFile, DocumentData, ValidationError } from '../../shared/types';
import { renderField } from './FieldRenderer';

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

export function renderForm(
  definition: DefinitionFile | undefined,
  documentData: DocumentData,
  errors: ValidationError[],
  attachments: AttachmentRef[],
): string {
  if (!definition) {
    return '<div class="empty-state">Load a definition file to generate a form.</div>';
  }
  return definition.sections
    .filter((section) => evaluateCondition(section.condition, documentData.data))
    .map(
      (section) => `
        <section class="section-card layout-${section.layout?.columns ?? 1} style-${section.layout?.style ?? 'default'}">
          <header>
            <h3>${escapeHtml(section.title)}</h3>
            <p>${escapeHtml(section.description ?? '')}</p>
          </header>
          <div class="section-fields">
            ${section.fields
              .filter((field) => evaluateCondition(field.condition, documentData.data))
              .map((field) => renderField(field, documentData.data[field.name], errors, attachments))
              .join('')}
          </div>
        </section>
      `,
    )
    .join('');
}
