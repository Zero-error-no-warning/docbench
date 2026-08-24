import { HistoryManager } from '../shared/history';
import { storage } from '../shared/storage';
import type { OutputConfig, RenderDefinition } from '../shared/types';
import { renderFormatSelector } from './components/FormatSelector';
import { interpolateTemplate, renderOutputPreview } from './components/OutputPreview';
import { renderTemplateEditor } from './components/TemplateEditor';

function makeId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function metadata() {
  const now = new Date().toISOString();
  return { created: now, modified: now, author: 'DocBench', tags: ['render'] };
}

function createOutput(format: OutputConfig['format'], name: string): OutputConfig {
  return {
    id: makeId('output'),
    name,
    format,
    template: {
      type: format === 'html' ? 'html' : 'handlebars',
      content:
        format === 'html'
          ? '<article><h1>{{title}}</h1><p>{{summary}}</p><ul><li>{{owner}}</li><li>{{status}}</li></ul></article>'
          : '{{title}}\n{{summary}}\nOwner: {{owner}}\nStatus: {{status}}',
      styles: 'article{font-family:Arial,sans-serif;padding:16px}h1{color:#2563eb}',
    },
  };
}

function createRenderDefinition(): RenderDefinition {
  return {
    version: '1.0.0',
    id: makeId('render'),
    name: 'Untitled Render Definition',
    definitionId: '',
    outputs: [
      createOutput('html', 'HTML Preview'),
      createOutput('word', 'Word Export'),
      createOutput('excel', 'Excel Export'),
      createOutput('powerpoint', 'PowerPoint Export'),
      createOutput('pdf', 'PDF Export'),
    ],
    metadata: metadata(),
  };
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
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

export class RenderDesignerApp {
  private readonly root: HTMLElement;
  private readonly fileInput: HTMLInputElement;
  private state: RenderDefinition;
  private selectedOutputId: string;
  private status = 'Ready';
  private sampleData: Record<string, unknown> = {
    title: 'Quarterly Report',
    summary: 'A concise update generated from structured document data.',
    owner: 'Operations Team',
    status: 'Draft',
  };
  private history: HistoryManager<RenderDefinition>;

  constructor(root: HTMLElement) {
    this.root = root;
    this.state = createRenderDefinition();
    this.selectedOutputId = this.state.outputs[0].id;
    this.fileInput = document.createElement('input');
    this.fileInput.type = 'file';
    this.fileInput.accept = 'application/json';
    this.fileInput.addEventListener('change', () => void this.handleFileOpen());
    this.history = this.createHistory(this.state);
  }

  mount(): void {
    this.attachEvents();
    void storage.set('renderDefinitions', this.state.id, this.state);
    this.render();
  }

  private createHistory(initialState: RenderDefinition): HistoryManager<RenderDefinition> {
    return new HistoryManager<RenderDefinition>(initialState, {
      key: `render-designer:${initialState.id}`,
      onChange: (nextState) => {
        this.state = nextState;
        this.status = `Updated ${new Date().toLocaleTimeString()}`;
        void storage.set('renderDefinitions', this.state.id, this.state);
        this.render();
      },
    });
  }

  private get selectedOutput(): OutputConfig | undefined {
    return this.state.outputs.find((output) => output.id === this.selectedOutputId);
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

  private setState(mutator: (draft: RenderDefinition) => void, label: string): void {
    const draft = clone(this.state);
    mutator(draft);
    draft.metadata.modified = new Date().toISOString();
    this.history.applyChange(draft, label);
  }

  private handleClick(event: Event): void {
    const target = event.target as HTMLElement;
    const action = target.closest<HTMLElement>('[data-action]')?.dataset.action;
    const outputChoice = target.closest<HTMLElement>('[data-select-output]')?.dataset.selectOutput;

    if (outputChoice) {
      this.selectedOutputId = outputChoice;
      this.render();
      return;
    }

    switch (action) {
      case 'new':
        this.state = createRenderDefinition();
        this.selectedOutputId = this.state.outputs[0].id;
        this.history = this.createHistory(this.state);
        this.status = 'Created new render definition';
        this.render();
        break;
      case 'open-file':
        this.fileInput.click();
        break;
      case 'save-json':
        this.saveJson();
        break;
      case 'save-local':
        void storage.set('renderDefinitions', this.state.id, this.state).then(() => {
          this.status = 'Saved to IndexedDB';
          this.render();
        });
        break;
      case 'load-local':
        void this.loadLocal();
        break;
      case 'add-output': {
        const format = window.prompt('Output format', 'html') as OutputConfig['format'] | null;
        if (!format) return;
        this.setState((draft) => {
          const output = createOutput(format, `${format.toUpperCase()} Output`);
          draft.outputs.push(output);
          this.selectedOutputId = output.id;
        }, `Added ${format} output`);
        break;
      }
      case 'remove-output':
        if (!this.selectedOutput) return;
        this.setState((draft) => {
          draft.outputs = draft.outputs.filter((output) => output.id !== this.selectedOutputId);
          this.selectedOutputId = draft.outputs[0]?.id ?? '';
        }, 'Removed output');
        break;
      case 'snapshot':
        this.history.createSnapshot(`Template snapshot ${new Date().toLocaleTimeString()}`);
        this.status = 'Snapshot captured';
        this.render();
        break;
      case 'branch': {
        const name = window.prompt('Branch name', `render-${Date.now()}`);
        if (name) {
          this.history.createBranch(name);
          this.status = `Switched to branch ${name}`;
          this.render();
        }
        break;
      }
      case 'merge': {
        const branches = this.history.listBranches().filter((branch) => branch.id !== this.history.currentBranch.id);
        if (!branches.length) {
          this.status = 'No branches available to merge';
          this.render();
          break;
        }
        const choice = window.prompt(`Merge branch by name:\n${branches.map((branch) => branch.name).join('\n')}`, branches[0].name);
        const selected = branches.find((branch) => branch.name === choice);
        if (selected) {
          const result = this.history.mergeBranch(selected.id);
          this.status = result ? `Merged ${selected.name} (${result.conflicts.length} conflicts)` : 'Merge failed';
          this.render();
        }
        break;
      }
      case 'undo':
        this.history.undo();
        break;
      case 'redo':
        this.history.redo();
        break;
      case 'copy-preview':
        void navigator.clipboard.writeText(interpolateTemplate(this.selectedOutput?.template.content ?? '', this.sampleData)).then(() => {
          this.status = 'Preview copied to clipboard';
          this.render();
        });
        break;
      default:
        break;
    }
  }

  private handleInput(event: Event): void {
    const target = event.target as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
    const bind = target.dataset.bind;
    if (!bind) return;
    switch (bind) {
      case 'render-name':
      case 'render-definition-id':
      case 'output-name':
      case 'output-format':
      case 'template-type':
      case 'template-content':
      case 'template-styles':
        this.setState((draft) => {
          const output = draft.outputs.find((entry) => entry.id === this.selectedOutputId);
          if (bind === 'render-name') draft.name = target.value;
          if (bind === 'render-definition-id') draft.definitionId = target.value;
          if (output && bind === 'output-name') output.name = target.value;
          if (output && bind === 'output-format') output.format = target.value as OutputConfig['format'];
          if (output && bind === 'template-type') output.template.type = target.value as OutputConfig['template']['type'];
          if (output && bind === 'template-content') output.template.content = target.value;
          if (output && bind === 'template-styles') output.template.styles = target.value;
        }, `Updated ${bind}`);
        break;
      case 'sample-data':
        try {
          this.sampleData = JSON.parse(target.value) as Record<string, unknown>;
          this.status = 'Updated sample data';
        } catch {
          this.status = 'Sample data must be valid JSON';
        }
        this.render();
        break;
      default:
        break;
    }
  }

  private async handleFileOpen(): Promise<void> {
    const file = this.fileInput.files?.[0];
    if (!file) return;
    this.state = JSON.parse(await file.text()) as RenderDefinition;
    this.selectedOutputId = this.state.outputs[0]?.id ?? '';
    this.history = this.createHistory(this.state);
    this.status = `Opened ${file.name}`;
    void storage.set('renderDefinitions', this.state.id, this.state);
    this.render();
  }

  private async loadLocal(): Promise<void> {
    const items = await storage.list<RenderDefinition>('renderDefinitions');
    if (!items.length) {
      this.status = 'No saved render definitions found';
      this.render();
      return;
    }
    const choice = window.prompt(`Load render definition by name:\n${items.map((item) => item.name).join('\n')}`, items[0].name);
    const selected = items.find((item) => item.name === choice) ?? items[0];
    this.state = selected;
    this.selectedOutputId = selected.outputs[0]?.id ?? '';
    this.history = this.createHistory(this.state);
    this.status = `Loaded ${selected.name} from IndexedDB`;
    this.render();
  }

  private saveJson(): void {
    downloadJson(`${this.state.name || 'render'}.render.json`, this.state);
    this.status = 'Downloaded render definition';
    this.render();
  }

  render(): void {
    const output = this.selectedOutput;
    this.root.innerHTML = `
      <div class="shell">
        <header class="topbar">
          <div>
            <h1>Render Designer</h1>
            <p>Compose HTML, Word, Excel, PowerPoint, and PDF render definitions with live preview.</p>
          </div>
          <div class="toolbar">
            <button data-action="new">New</button>
            <button data-action="open-file">Open</button>
            <button data-action="save-json">Save JSON</button>
            <button data-action="save-local">Save Local</button>
            <button data-action="load-local">Load Local</button>
            <button data-action="snapshot">Snapshot</button>
            <button data-action="branch">Branch</button>
            <button data-action="merge">Merge</button>
            <button data-action="undo">Undo</button>
            <button data-action="redo">Redo</button>
          </div>
        </header>
        <section class="meta-grid">
          <div>
            <label>Render definition name</label>
            <input data-bind="render-name" value="${escapeHtml(this.state.name)}" />
          </div>
          <div>
            <label>Definition file id</label>
            <input data-bind="render-definition-id" value="${escapeHtml(this.state.definitionId)}" placeholder="definition-..." />
          </div>
          <div class="pill-row">
            <span class="pill">${this.state.outputs.length} outputs</span>
            <span class="pill">${this.history.currentBranch.name}</span>
          </div>
        </section>
        <main class="layout-grid">
          <aside class="panel left-panel">
            <div class="section-header-inline">
              <h3>Outputs</h3>
              <div>
                <button data-action="add-output">Add</button>
                <button data-action="remove-output" ${output ? '' : 'disabled'}>Remove</button>
              </div>
            </div>
            <div class="stack">${renderFormatSelector(this.state.outputs, this.selectedOutputId)}</div>
            ${output ? `
              <section class="panel-section">
                <label>Output name</label>
                <input data-bind="output-name" value="${escapeHtml(output.name)}" />
                <label>Format</label>
                <select data-bind="output-format">
                  ${['html', 'word', 'excel', 'powerpoint', 'pdf']
                    .map((format) => `<option value="${format}" ${format === output.format ? 'selected' : ''}>${format}</option>`)
                    .join('')}
                </select>
              </section>
            ` : ''}
          </aside>
          <section class="panel editor-panel">${renderTemplateEditor(output)}</section>
          <aside class="panel preview-panel">
            <div class="section-header-inline">
              <h3>Preview</h3>
              <button data-action="copy-preview">Copy</button>
            </div>
            <section class="panel-section">
              <label>Sample data (JSON)</label>
              <textarea data-bind="sample-data" rows="8">${escapeHtml(JSON.stringify(this.sampleData, null, 2))}</textarea>
            </section>
            <section class="preview-shell">${renderOutputPreview(output, this.sampleData)}</section>
          </aside>
        </main>
        <footer class="statusbar">
          <span>${this.status}</span>
          <span>${this.state.metadata.modified}</span>
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
        .meta-grid { display: grid; grid-template-columns: 1.2fr 1fr auto; gap: 1rem; padding: 1rem 1.5rem; }
        .meta-grid label, .panel label { display: block; font-size: 0.82rem; color: var(--muted); margin-bottom: 0.35rem; }
        .layout-grid { display: grid; grid-template-columns: 270px minmax(0, 1.2fr) minmax(320px, 1fr); gap: 1rem; padding: 0 1.5rem 1rem; flex: 1; }
        .panel { background: white; border: 1px solid var(--border); border-radius: 1rem; padding: 1rem; box-shadow: 0 12px 30px rgba(37, 99, 235, 0.06); overflow: auto; }
        .stack { display: grid; gap: 0.75rem; }
        .format-item { width: 100%; text-align: left; display: flex; justify-content: space-between; gap: 0.75rem; padding: 0.85rem; border-radius: 0.9rem; }
        .format-item.active { border-color: var(--primary); background: var(--accent); }
        .section-header-inline { display: flex; justify-content: space-between; align-items: center; gap: 0.5rem; margin-bottom: 0.75rem; }
        .section-header-inline h3, .panel-section h3 { margin: 0; }
        .panel-section { margin-bottom: 1rem; }
        .pill { display: inline-flex; align-items: center; padding: 0.28rem 0.6rem; border-radius: 999px; background: var(--accent); color: var(--primary); font-size: 0.8rem; }
        .hint { color: var(--muted); font-size: 0.9rem; }
        .preview-shell { border: 1px dashed var(--border); border-radius: 0.9rem; padding: 1rem; background: #fbfdff; }
        .preview-document { min-height: 200px; }
        pre.preview-document { white-space: pre-wrap; font-family: ui-monospace, SFMono-Regular, monospace; }
        .empty-state { border: 1px dashed var(--border); border-radius: 0.9rem; padding: 1rem; text-align: center; color: var(--muted); }
        .statusbar { display: flex; justify-content: space-between; padding: 0.85rem 1.5rem; border-top: 1px solid var(--border); color: var(--muted); font-size: 0.9rem; }
        @media (max-width: 1180px) { .layout-grid, .meta-grid { grid-template-columns: 1fr; } }
      </style>
    `;
  }
}
