import type { OutputConfig } from '../../shared/types';

function resolveValue(data: Record<string, unknown>, expression: string): unknown {
  return expression.trim().split('.').reduce<unknown>((current, key) => {
    if (current && typeof current === 'object') {
      return (current as Record<string, unknown>)[key];
    }
    return undefined;
  }, data);
}

export function interpolateTemplate(template: string, data: Record<string, unknown>): string {
  return template.replace(/\{\{\s*([^}]+)\s*\}\}/g, (_match, expression: string) => {
    const value = resolveValue(data, expression);
    if (Array.isArray(value)) {
      return value.join(', ');
    }
    if (value && typeof value === 'object') {
      return JSON.stringify(value, null, 2);
    }
    return String(value ?? '');
  });
}

export function renderOutputPreview(output: OutputConfig | undefined, sampleData: Record<string, unknown>): string {
  if (!output) {
    return '<div class="empty-state">Preview will appear here.</div>';
  }
  const rendered = interpolateTemplate(output.template.content, sampleData);
  if (output.format === 'html' || output.template.type === 'html') {
    return `<div class="preview-document"><style>${output.template.styles ?? ''}</style>${rendered}</div>`;
  }
  return `<pre class="preview-document">${rendered}</pre>`;
}
