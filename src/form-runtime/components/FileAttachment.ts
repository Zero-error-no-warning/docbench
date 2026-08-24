import type { AttachmentRef } from '../../shared/types';

export function renderAttachmentList(attachments: AttachmentRef[], fieldId: string): string {
  const items = attachments.filter((attachment) => attachment.fieldId === fieldId);
  if (!items.length) {
    return '<div class="attachment-empty">No files attached.</div>';
  }
  return `
    <div class="attachment-list">
      ${items
        .map(
          (attachment) => `
            <div class="attachment-item">
              <span>${attachment.name}</span>
              <small>${Math.max(1, Math.round(attachment.size / 1024))} KB</small>
            </div>
          `,
        )
        .join('')}
    </div>
  `;
}
