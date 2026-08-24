import { HistoryManager } from '../shared/history';
import { validateDocumentData } from '../shared/schema';
import { storage } from '../shared/storage';
import type { AttachmentRef, DefinitionFile, DocumentData, OutputConfig, RenderDefinition, ValidationResult } from '../shared/types';
import { renderForm } from './components/FormGenerator';
import { renderValidationDisplay } from './components/ValidationDisplay';

function makeId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function metadata() {
  const now = new Date().toISOString();
  return { created: now, modified: now, author: 'DocBench', tags: ['document'] };
}

function createDocumentData(): DocumentData {
  return {
    version: '1.0.0',
    id: makeId('document'),
    definitionId: '',
    name: 'Untitled Document Data',
    data: {},
    attachments: [],
    metadata: metadata(),
  };
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function interpolate(template: string, data: Record<string, unknown>): string {
  return template.replace(/\{\{\s*([^}]+)\s*\}\}/g, (_match, expression: string) => {
    const value = expression.trim().split('.').reduce<unknown>((current, key) => {
      if (current && typeof current === 'object') {
        return (current as Record<string, unknown>)[key];
      }
      return undefined;
    }, data);
    if (Array.isArray(value)) return value.join(', ');
    if (value && typeof value === 'object') return JSON.stringify(value, null, 2);
    return String(value ?? '');
  });
}

function downloadJson(filename: string, data: unknown): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export class FormRuntimeApp {
  private readonly root: HTMLElement;
  private readonly definitionInput: HTMLInputElement;
  private readonly renderInput: HTMLInputElement;
  private readonly documentInput: HTMLInputElement;
  private definition?: DefinitionFile;
  private renderDefinition?: RenderDefinition;
  private documentData: DocumentData = createDocumentData();
  private validation: ValidationResult = { valid: true, errors: [] };
  private status = 'Ready';
  private selectedOutputId = '';
  private history: HistoryManager<DocumentData>;

  constructor(root: HTMLElement) {
    this.root = root;
    this.definitionInput = this.createFileInput(() => void this.openDefinitionFile());
    this.renderInput = this.createFileInput(() => void this.openRenderFile());
    this.documentInput = this.createFileInput(() => void this.openDocumentFile());
    this.history = this.createHistory(this.documentData);
  }

  mount(): void {
    this.attachEvents();
    void storage.set('documentData', this.documentData.id, this.documentData);
    this.render();
  }

  private createHistory(initialState: DocumentData): HistoryManager<DocumentData> {
    return new HistoryManager<DocumentData>(initialState, {
      key: `form-runtime:${initialState.id}`,
      onChange: (nextState) => {
        this.documentData = nextState;
        this.documentData.metadata.modified = new Date().toISOString();
        this.validate();
        void storage.set('documentData', this.documentData.id, this.documentData);
        this.render();
      },
    });
  }

  private createFileInput(handler: () => void): HTMLInputElement {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';
    input.addEventListener('change', handler);
    return input;
  }

  private attachEvents(): void {
    this.root.addEventListener('click', (event) => this.handleClick(event));
    this.root.addEventListener('input', (event) => this.handleInput(event));
    this.root.addEventListener('change', (event) => this.handleInput(event));
    window.addEventListener('keydown', (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        this.history.undo();
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'y') {
        event.preventDefault();
        this.history.redo();
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
        event.preventDefault();
        this.saveJson();
      }
    });
  }

  private get activeOutput(): OutputConfig | undefined {
    return this.renderDefinition?.outputs.find((output) => output.id === this.selectedOutputId) ?? this.renderDefinition?.outputs[0];
  }

  private setDocument(mutator: (draft: DocumentData) => void, label: string): void {
    const draft = clone(this.documentData);
    mutator(draft);
    draft.metadata.modified = new Date().toISOString();
    this.history.applyChange(draft, label);
  }

  private handleClick(event: Event): void {
    const target = event.target as HTMLElement;
    const button = target.closest<HTMLElement>('[data-action]');
    const action = button?.dataset.action;

    switch (action) {
      case 'load-definition-file':
        this.definitionInput.click();
        break;
      case 'load-definition-local':
        void this.loadDefinitionLocal();
        break;
      case 'load-render-file':
        this.renderInput.click();
        break;
      case 'load-render-local':
        void this.loadRenderLocal();
        break;
      case 'new-document':
        this.documentData = createDocumentData();
        this.history = this.createHistory(this.documentData);
        this.validation = { valid: true, errors: [] };
        this.status = 'Started a new document';
        this.render();
        break;
      case 'open-document':
        this.documentInput.click();
        break;
      case 'save-document':
        this.saveJson();
        break;
      case 'save-document-local':
        void storage.set('documentData', this.documentData.id, this.documentData).then(() => {
          this.status = 'Saved document data to IndexedDB';
          this.render();
        });
        break;
      case 'load-document-local':
        void this.loadDocumentLocal();
        break;
      case 'generate-output':
        this.generateOutput();
        break;
      case 'snapshot':
        this.history.createSnapshot(`Form snapshot ${new Date().toLocaleTimeString()}`);
        this.status = 'Snapshot captured';
        this.render();
        break;
      case 'undo':
        this.history.undo();
        break;
      case 'redo':
        this.history.redo();
        break;
      case 'add-array-item': {
        const fieldName = button?.dataset.fieldName ?? '';
        this.setDocument((draft) => {
          const current = Array.isArray(draft.data[fieldName]) ? (draft.data[fieldName] as unknown[]) : [];
          draft.data[fieldName] = [...current, ''];
        }, `Added array item to ${fieldName}`);
        break;
      }
      case 'remove-array-item': {
        const fieldName = button?.dataset.fieldName ?? '';
        const index = Number(button?.dataset.arrayIndex ?? 0);
        this.setDocument((draft) => {
          const current = Array.isArray(draft.data[fieldName]) ? [...(draft.data[fieldName] as unknown[])] : [];
          current.splice(index, 1);
          draft.data[fieldName] = current;
        }, `Removed array item from ${fieldName}`);
        break;
      }
      case 'add-table-row': {
        const fieldName = button?.dataset.fieldName ?? '';
        this.setDocument((draft) => {
          const current = Array.isArray(draft.data[fieldName]) ? [...(draft.data[fieldName] as Record<string, unknown>[])] : [];
          current.push({});
          draft.data[fieldName] = current;
        }, `Added table row to ${fieldName}`);
        break;
      }
      case 'remove-table-row': {
        const fieldName = button?.dataset.fieldName ?? '';
        const rowIndex = Number(button?.dataset.rowIndex ?? 0);
        this.setDocument((draft) => {
          const current = Array.isArray(draft.data[fieldName]) ? [...(draft.data[fieldName] as Record<string, unknown>[])] : [];
          current.splice(rowIndex, 1);
          draft.data[fieldName] = current;
        }, `Removed table row from ${fieldName}`);
        break;
      }
      default:
        break;
    }
  }

  private handleInput(event: Event): void {
    const target = event.target as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
    if (target.dataset.documentName) {
      this.setDocument((draft) => {
        draft.name = target.value;
      }, 'Updated document name');
      return;
    }
    if (target.dataset.selectedOutput) {
      this.selectedOutputId = target.value;
      this.render();
      return;
    }
    if (target instanceof HTMLInputElement && target.type === 'file' && target.dataset.fieldName) {
      void this.handleAttachment(target.dataset.fieldName, target.files?.[0]);
      return;
    }
    if (target.dataset.fieldName) {
      const fieldName = target.dataset.fieldName;
      let value: unknown = target.value;
      if (target instanceof HTMLInputElement && target.type === 'checkbox') {
        value = target.checked;
      }
      if (target instanceof HTMLInputElement && target.type === 'number') {
        value = target.value === '' ? '' : Number(target.value);
      }
      if (target instanceof HTMLSelectElement && target.multiple) {
        value = Array.from(target.selectedOptions).map((option) => option.value);
      }
      this.setDocument((draft) => {
        draft.data[fieldName] = value;
      }, `Updated ${fieldName}`);
      return;
    }
    if (target.dataset.arrayName && target.dataset.arrayIndex !== undefined) {
      const fieldName = target.dataset.arrayName;
      const index = Number(target.dataset.arrayIndex);
      this.setDocument((draft) => {
        const current = Array.isArray(draft.data[fieldName]) ? [...(draft.data[fieldName] as unknown[])] : [];
        current[index] = target.value;
        draft.data[fieldName] = current;
      }, `Updated ${fieldName}[${index}]`);
      return;
    }
    if (target.dataset.objectName && target.dataset.childName) {
      const objectName = target.dataset.objectName;
      const childName = target.dataset.childName;
      this.setDocument((draft) => {
        const current = draft.data[objectName] && typeof draft.data[objectName] === 'object' && !Array.isArray(draft.data[objectName])
          ? { ...(draft.data[objectName] as Record<string, unknown>) }
          : {};
        current[childName] = target.value;
        draft.data[objectName] = current;
      }, `Updated ${objectName}.${childName}`);
      return;
    }
    if (target.dataset.tableName && target.dataset.rowIndex && target.dataset.columnId) {
      const tableName = target.dataset.tableName;
      const rowIndex = Number(target.dataset.rowIndex);
      const columnId = target.dataset.columnId;
      this.setDocument((draft) => {
        const current = Array.isArray(draft.data[tableName]) ? [...(draft.data[tableName] as Record<string, unknown>[])] : [];
        const row = { ...(current[rowIndex] ?? {}) };
        row[columnId] = target.value;
        current[rowIndex] = row;
        draft.data[tableName] = current;
      }, `Updated ${tableName}.${rowIndex}.${columnId}`);
    }
  }

  private validate(): void {
    this.validation = this.definition ? validateDocumentData(this.definition, this.documentData) : { valid: true, errors: [] };
  }

  private async handleAttachment(fieldName: string, file: File | undefined): Promise<void> {
    if (!file || !this.definition) return;
    const field = this.definition.sections.flatMap((section) => section.fields).find((entry) => entry.name === fieldName);
    if (!field) return;
    const buffer = await file.arrayBuffer();
    const storageKey = `${this.documentData.id}:${file.name}:${Date.now()}`;
    await storage.set('attachments', storageKey, {
      name: file.name,
      type: file.type,
      size: file.size,
      bytes: Array.from(new Uint8Array(buffer)),
    });
    const attachment: AttachmentRef = {
      id: makeId('attachment'),
      fieldId: field.id,
      name: file.name,
      type: file.type,
      size: file.size,
      storageKey,
    };
    this.setDocument((draft) => {
      draft.attachments = [...draft.attachments.filter((item) => item.fieldId !== field.id), attachment];
      draft.data[fieldName] = file.name;
    }, `Attached ${file.name}`);
  }

  private async openDefinitionFile(): Promise<void> {
    const file = this.definitionInput.files?.[0];
    if (!file) return;
    this.definition = JSON.parse(await file.text()) as DefinitionFile;
    this.documentData.definitionId = this.definition.id;
    this.validate();
    this.status = `Loaded definition ${file.name}`;
    this.render();
  }

  private async openRenderFile(): Promise<void> {
    const file = this.renderInput.files?.[0];
    if (!file) return;
    this.renderDefinition = JSON.parse(await file.text()) as RenderDefinition;
    this.selectedOutputId = this.renderDefinition.outputs[0]?.id ?? '';
    this.documentData.renderDefinitionId = this.renderDefinition.id;
    this.status = `Loaded render definition ${file.name}`;
    this.render();
  }

  private async openDocumentFile(): Promise<void> {
    const file = this.documentInput.files?.[0];
    if (!file) return;
    this.documentData = JSON.parse(await file.text()) as DocumentData;
    this.history = this.createHistory(this.documentData);
    this.validate();
    this.status = `Loaded document data ${file.name}`;
    this.render();
  }

  private async loadDefinitionLocal(): Promise<void> {
    const definitions = await storage.list<DefinitionFile>('definitions');
    if (!definitions.length) {
      this.status = 'No local definitions found';
      this.render();
      return;
    }
    const choice = window.prompt(`Load definition by name:\n${definitions.map((item) => item.name).join('\n')}`, definitions[0].name);
    this.definition = definitions.find((item) => item.name === choice) ?? definitions[0];
    this.documentData.definitionId = this.definition.id;
    this.validate();
    this.status = `Loaded definition ${this.definition.name}`;
    this.render();
  }

  private async loadRenderLocal(): Promise<void> {
    const renders = await storage.list<RenderDefinition>('renderDefinitions');
    if (!renders.length) {
      this.status = 'No local render definitions found';
      this.render();
      return;
    }
    const choice = window.prompt(`Load render definition by name:\n${renders.map((item) => item.name).join('\n')}`, renders[0].name);
    this.renderDefinition = renders.find((item) => item.name === choice) ?? renders[0];
    this.selectedOutputId = this.renderDefinition.outputs[0]?.id ?? '';
    this.documentData.renderDefinitionId = this.renderDefinition.id;
    this.status = `Loaded render definition ${this.renderDefinition.name}`;
    this.render();
  }

  private async loadDocumentLocal(): Promise<void> {
    const docs = await storage.list<DocumentData>('documentData');
    if (!docs.length) {
      this.status = 'No local document data found';
      this.render();
      return;
    }
    const choice = window.prompt(`Load document data by name:\n${docs.map((item) => item.name).join('\n')}`, docs[0].name);
    this.documentData = docs.find((item) => item.name === choice) ?? docs[0];
    this.history = this.createHistory(this.documentData);
    this.validate();
    this.status = `Loaded document data ${this.documentData.name}`;
    this.render();
  }

  private saveJson(): void {
    downloadJson(`${this.documentData.name || 'document-data'}.document.json`, this.documentData);
    this.status = 'Downloaded document data JSON';
    this.render();
  }

  private generateOutput(): void {
    if (!this.renderDefinition || !this.activeOutput) {
      this.status = 'Load a render definition before generating output';
      this.render();
      return;
    }
    const rendered = interpolate(this.activeOutput.template.content, this.documentData.data);
    const previewWindow = window.open('', '_blank', 'noopener,noreferrer,width=960,height=720');
    if (!previewWindow) {
      this.status = 'Popup blocked. Allow popups to preview output.';
      this.render();
      return;
    }
    previewWindow.document.write(`
      <html>
        <head>
          <title>${this.activeOutput.name}</title>
          <style>body{font-family:Arial,sans-serif;padding:24px;background:#f8fafc;color:#1e293b}${this.activeOutput.template.styles ?? ''}</style>
        </head>
        <body>
          ${this.activeOutput.format === 'html' || this.activeOutput.template.type === 'html' ? rendered : `<pre>${escapeHtml(rendered)}</pre>`}
        </body>
      </html>
    `);
    previewWindow.document.close();
    this.status = `Generated ${this.activeOutput.name}`;
    this.render();
  }

  private getProgress(): { complete: number; total: number } {
    if (!this.definition) {
      return { complete: 0, total: 0 };
    }
    const sections = this.definition.sections;
    const complete = sections.filter((section) => section.fields.every((field) => !field.required || this.documentData.data[field.name])).length;
    return { complete, total: sections.length };
  }

  render(): void {
    const progress = this.getProgress();
    this.root.innerHTML = `
      <div class="shell">
        <header class="topbar">
          <div>
            <h1>Form Runtime</h1>
            <p>Load definition files, capture document data with validation, attachments, history, and generated output.</p>
          </div>
          <div class="toolbar">
            <button data-action="load-definition-file">Definition File</button>
            <button data-action="load-definition-local">Definition Local</button>
            <button data-action="load-render-file">Render File</button>
            <button data-action="load-render-local">Render Local</button>
            <button data-action="new-document">New</button>
            <button data-action="open-document">Open</button>
            <button data-action="save-document">Save JSON</button>
            <button data-action="save-document-local">Save Local</button>
            <button data-action="load-document-local">Load Local</button>
            <button data-action="snapshot">Snapshot</button>
            <button data-action="undo">Undo</button>
            <button data-action="redo">Redo</button>
          </div>
        </header>
        <section class="meta-grid">
          <div>
            <label>Document name</label>
            <input data-document-name="true" value="${escapeHtml(this.documentData.name)}" />
          </div>
          <div class="pill-row">
            <span class="pill">Definition: ${escapeHtml(this.definition?.name ?? 'Not loaded')}</span>
            <span class="pill">Render: ${escapeHtml(this.renderDefinition?.name ?? 'Not loaded')}</span>
            <span class="pill">Progress: ${progress.complete}/${progress.total}</span>
          </div>
          <div>
            <label>Output</label>
            <select data-selected-output="true">
              <option value="">Select output...</option>
              ${(this.renderDefinition?.outputs ?? []).map((output) => `<option value="${output.id}" ${output.id === this.activeOutput?.id ? 'selected' : ''}>${output.name}</option>`).join('')}
            </select>
          </div>
        </section>
        <main class="layout-grid">
          <section class="panel form-panel">${renderForm(this.definition, this.documentData, this.validation.errors, this.documentData.attachments)}</section>
          <aside class="panel side-panel">
            <section class="panel-section">
              <div class="section-header-inline">
                <h3>Validation</h3>
                <button data-action="generate-output">Generate output</button>
              </div>
              ${renderValidationDisplay(this.validation)}
            </section>
            <section class="panel-section">
              <h3>Document data</h3>
              <pre class="json-preview">${escapeHtml(JSON.stringify(this.documentData.data, null, 2))}</pre>
            </section>
            <section class="panel-section">
              <h3>History</h3>
              <div class="hint-card">Branch: ${escapeHtml(this.history.currentBranch.name)}<br />Snapshots: ${this.history.currentBranch.snapshots.length}<br />Attachments: ${this.documentData.attachments.length}</div>
            </section>
          </aside>
        </main>
        <footer class="statusbar">
          <span>${this.status}</span>
          <span>${this.documentData.metadata.modified}</span>
        </footer>
      </div>
      <style>
        .shell { min-height: 100vh; display: flex; flex-direction: column; }
        .topbar { display: flex; justify-content: space-between; gap: 1rem; padding: 1rem 1.5rem; border-bottom: 1px solid var(--border); background: linear-gradient(135deg, #eff6ff, #ffffff); }
        .topbar h1 { margin: 0; font-size: 1.4rem; }
        .topbar p { margin: 0.35rem 0 0; color: var(--muted); }
        .toolbar, .pill-row { display: flex; flex-wrap: wrap; gap: 0.5rem; }
        button { border: 1px solid var(--border); background: white; padding: 0.55rem 0.85rem; border-radius: 0.7rem; color: var(--text); cursor: pointer; }
        button:hover:not(:disabled) { border-color: var(--primary); color: var(--primary); }
        input, select, textarea { width: 100%; border: 1px solid var(--border); border-radius: 0.75rem; padding: 0.7rem 0.8rem; background: white; color: var(--text); }
        textarea { resize: vertical; }
        .meta-grid { display: grid; grid-template-columns: 1fr 1.2fr 320px; gap: 1rem; padding: 1rem 1.5rem; }
        .meta-grid label, .panel label { display: block; font-size: 0.82rem; color: var(--muted); margin-bottom: 0.35rem; }
        .layout-grid { display: grid; grid-template-columns: minmax(0, 1.4fr) 360px; gap: 1rem; padding: 0 1.5rem 1rem; flex: 1; }
        .panel { background: white; border: 1px solid var(--border); border-radius: 1rem; padding: 1rem; box-shadow: 0 12px 30px rgba(37, 99, 235, 0.06); overflow: auto; }
        .panel-section { margin-bottom: 1rem; }
        .section-card { border: 1px solid var(--border); border-radius: 1rem; padding: 1rem; margin-bottom: 1rem; background: #fbfdff; }
        .section-card header h3 { margin: 0 0 0.25rem; }
        .section-card header p { margin: 0 0 1rem; color: var(--muted); }
        .section-fields { display: grid; gap: 0.9rem; }
        .layout-2 .section-fields { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        .layout-3 .section-fields { grid-template-columns: repeat(3, minmax(0, 1fr)); }
        .layout-4 .section-fields { grid-template-columns: repeat(4, minmax(0, 1fr)); }
        .field-card { border: 1px solid var(--border); border-radius: 0.9rem; padding: 0.85rem; display: grid; gap: 0.45rem; background: white; }
        .field-header { display: flex; justify-content: space-between; gap: 0.75rem; align-items: center; }
        .field-label { font-weight: 600; }
        .field-errors { color: #dc2626; font-size: 0.88rem; display: grid; gap: 0.25rem; }
        .checkbox-row { display: flex; gap: 0.5rem; align-items: center; }
        .checkbox-row input { width: auto; }
        .radio-group, .array-items, .nested-grid, .attachment-list { display: grid; gap: 0.65rem; }
        .array-item { display: grid; gap: 0.5rem; }
        .table-scroll { overflow: auto; }
        table { width: 100%; border-collapse: collapse; }
        th, td { border: 1px solid var(--border); padding: 0.55rem; }
        .hint-card, .attachment-empty { border: 1px dashed var(--border); border-radius: 0.85rem; padding: 0.85rem; color: var(--muted); background: #fbfdff; }
        .attachment-item { display: flex; justify-content: space-between; gap: 0.75rem; border: 1px solid var(--border); border-radius: 0.75rem; padding: 0.65rem 0.75rem; }
        .validation-ok { color: #16a34a; font-weight: 600; }
        .validation-errors { color: #dc2626; }
        .validation-errors ul { padding-left: 1.1rem; margin-bottom: 0; }
        .json-preview { white-space: pre-wrap; background: #0f172a; color: #e2e8f0; padding: 1rem; border-radius: 0.9rem; max-height: 320px; overflow: auto; }
        .pill { display: inline-flex; align-items: center; padding: 0.28rem 0.6rem; border-radius: 999px; background: var(--accent); color: var(--primary); font-size: 0.8rem; }
        .empty-state { border: 1px dashed var(--border); border-radius: 0.9rem; padding: 1rem; text-align: center; color: var(--muted); }
        .section-header-inline { display: flex; justify-content: space-between; align-items: center; gap: 0.5rem; }
        .section-header-inline h3 { margin: 0; }
        .statusbar { display: flex; justify-content: space-between; padding: 0.85rem 1.5rem; border-top: 1px solid var(--border); color: var(--muted); font-size: 0.9rem; }
        @media (max-width: 1180px) { .layout-grid, .meta-grid, .layout-2 .section-fields, .layout-3 .section-fields, .layout-4 .section-fields { grid-template-columns: 1fr; } }
      </style>
    `;
  }
}
