import { HistoryManager } from '../shared/history';
import { storage } from '../shared/storage';
import type { DefinitionFile, Field, FieldOption, ValidationRule } from '../shared/types';
import { renderArrayEditor } from './components/ArrayEditor';
import { renderFieldList } from './components/FieldEditor';
import { renderLayoutEditor } from './components/LayoutEditor';
import { renderSectionList } from './components/SchemaBuilder';
import { renderSectionEditor } from './components/SectionEditor';
import { renderTableEditor } from './components/TableEditor';
import { renderValidationEditor } from './components/ValidationEditor';

function makeId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function createMetadata() {
  const now = new Date().toISOString();
  return { created: now, modified: now, author: 'DocBench', tags: ['definition'] };
}

function createField(type: Field['type'] = 'text'): Field {
  return {
    id: makeId('field'),
    name: `field_${Math.random().toString(36).slice(2, 6)}`,
    label: 'New field',
    type,
    required: false,
    validation: [],
    options: type === 'select' || type === 'multiselect' || type === 'radio'
      ? [
          { value: 'option-a', label: 'Option A' },
          { value: 'option-b', label: 'Option B' },
        ]
      : [],
    fields: type === 'array' || type === 'object' ? [] : undefined,
    columns: type === 'table' ? [] : undefined,
    placeholder: '',
    help: '',
  };
}

function createDefinition(): DefinitionFile {
  return {
    version: '1.0.0',
    id: makeId('definition'),
    name: 'Untitled Definition',
    description: 'Describe the information that a form should collect.',
    sections: [
      {
        id: makeId('section'),
        title: 'General Information',
        description: 'Core fields for the document.',
        layout: { columns: 2, style: 'card' },
        fields: [createField('text')],
      },
    ],
    metadata: createMetadata(),
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

export class DefinitionEditorApp {
  private readonly root: HTMLElement;
  private readonly fileInput: HTMLInputElement;
  private state: DefinitionFile;
  private selectedSectionId: string;
  private selectedFieldId?: string;
  private status = 'Ready';
  private history: HistoryManager<DefinitionFile>;

  constructor(root: HTMLElement) {
    this.root = root;
    this.state = createDefinition();
    this.selectedSectionId = this.state.sections[0]?.id ?? '';
    this.selectedFieldId = this.state.sections[0]?.fields[0]?.id;
    this.fileInput = document.createElement('input');
    this.fileInput.type = 'file';
    this.fileInput.accept = 'application/json';
    this.fileInput.addEventListener('change', () => void this.handleFileOpen());
    this.history = this.createHistory(this.state);
  }

  mount(): void {
    this.attachEvents();
    void storage.set('definitions', this.state.id, this.state);
    this.render();
  }

  private createHistory(initialState: DefinitionFile): HistoryManager<DefinitionFile> {
    return new HistoryManager<DefinitionFile>(initialState, {
      key: `definition-editor:${initialState.id}`,
      onChange: (nextState) => {
        this.state = nextState;
        this.status = `Updated ${new Date().toLocaleTimeString()}`;
        void storage.set('definitions', this.state.id, this.state);
        this.render();
      },
    });
  }

  private get selectedSection() {
    return this.state.sections.find((section) => section.id === this.selectedSectionId);
  }

  private get selectedField() {
    return this.selectedSection?.fields.find((field) => field.id === this.selectedFieldId);
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

  private setState(mutator: (draft: DefinitionFile) => void, label: string): void {
    const draft = clone(this.state);
    mutator(draft);
    draft.metadata.modified = new Date().toISOString();
    this.history.applyChange(draft, label);
  }

  private handleClick(event: Event): void {
    const target = event.target as HTMLElement;
    const action = target.closest<HTMLElement>('[data-action]')?.dataset.action;
    const sectionChoice = target.closest<HTMLElement>('[data-select-section]')?.dataset.selectSection;
    const fieldChoice = target.closest<HTMLElement>('[data-select-field]')?.dataset.selectField;

    if (sectionChoice) {
      this.selectedSectionId = sectionChoice;
      this.selectedFieldId = this.selectedSection?.fields[0]?.id;
      this.render();
      return;
    }

    if (fieldChoice) {
      this.selectedFieldId = fieldChoice;
      this.render();
      return;
    }

    switch (action) {
      case 'new':
        this.state = createDefinition();
        this.selectedSectionId = this.state.sections[0].id;
        this.selectedFieldId = this.state.sections[0].fields[0]?.id;
        this.history = this.createHistory(this.state);
        this.status = 'Created new definition';
        this.render();
        break;
      case 'open-file':
        this.fileInput.click();
        break;
      case 'save-json':
        this.saveJson();
        break;
      case 'save-local':
        void storage.set('definitions', this.state.id, this.state).then(() => {
          this.status = 'Saved to IndexedDB';
          this.render();
        });
        break;
      case 'load-local':
        void this.loadLocal();
        break;
      case 'add-section':
        this.setState((draft) => {
          const section = {
            id: makeId('section'),
            title: `Section ${draft.sections.length + 1}`,
            description: '',
            layout: { columns: 2 as const, style: 'default' as const },
            fields: [],
          };
          draft.sections.push(section);
          this.selectedSectionId = section.id;
          this.selectedFieldId = undefined;
        }, 'Added section');
        break;
      case 'remove-section':
        if (!this.selectedSection) return;
        this.setState((draft) => {
          draft.sections = draft.sections.filter((section) => section.id !== this.selectedSectionId);
          const next = draft.sections[0];
          this.selectedSectionId = next?.id ?? '';
          this.selectedFieldId = next?.fields[0]?.id;
        }, 'Removed section');
        break;
      case 'move-section-up':
        this.reorderSection(-1);
        break;
      case 'move-section-down':
        this.reorderSection(1);
        break;
      case 'add-field-text':
      case 'add-field-number':
      case 'add-field-select':
      case 'add-field-array':
      case 'add-field-table':
      case 'add-field-object': {
        const type = action.replace('add-field-', '') as Field['type'];
        this.setState((draft) => {
          const section = draft.sections.find((entry) => entry.id === this.selectedSectionId);
          if (!section) return;
          const field = createField(type);
          field.label = `${type[0].toUpperCase()}${type.slice(1)} field`;
          section.fields.push(field);
          this.selectedFieldId = field.id;
        }, `Added ${type} field`);
        break;
      }
      case 'remove-field':
        this.removeField(target.closest<HTMLElement>('[data-field-id]')?.dataset.fieldId ?? '');
        break;
      case 'move-field-up':
        this.reorderField(target.closest<HTMLElement>('[data-field-id]')?.dataset.fieldId ?? '', -1);
        break;
      case 'move-field-down':
        this.reorderField(target.closest<HTMLElement>('[data-field-id]')?.dataset.fieldId ?? '', 1);
        break;
      case 'add-validation-rule':
        this.setState((draft) => {
          const field = this.findField(draft, this.selectedFieldId);
          if (!field) return;
          field.validation = field.validation ?? [];
          field.validation.push({ type: 'required', value: '', message: 'Validation failed.' });
        }, 'Added validation rule');
        break;
      case 'remove-validation-rule':
        this.removeValidationRule(Number(target.closest<HTMLElement>('[data-rule-index]')?.dataset.ruleIndex ?? -1));
        break;
      case 'add-array-child':
        this.setState((draft) => {
          const field = this.findField(draft, this.selectedFieldId);
          if (!field) return;
          field.fields = field.fields ?? [];
          field.fields.push(createField('text'));
        }, 'Added array child');
        break;
      case 'add-table-column':
        this.setState((draft) => {
          const field = this.findField(draft, this.selectedFieldId);
          if (!field) return;
          field.columns = field.columns ?? [];
          field.columns.push({ id: makeId('col'), label: 'Column', type: 'text', required: false, validation: [] });
        }, 'Added table column');
        break;
      case 'snapshot':
        this.history.createSnapshot(`Manual snapshot ${new Date().toLocaleTimeString()}`);
        this.status = 'Snapshot captured';
        this.render();
        break;
      case 'branch': {
        const name = window.prompt('Branch name', `branch-${Date.now()}`);
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
          this.status = 'No other branches available to merge';
          this.render();
          break;
        }
        const choice = window.prompt(`Merge branch by name:\n${branches.map((branch) => `- ${branch.name}`).join('\n')}`, branches[0].name);
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
      default:
        break;
    }
  }

  private reorderSection(offset: number): void {
    this.setState((draft) => {
      const index = draft.sections.findIndex((section) => section.id === this.selectedSectionId);
      const nextIndex = index + offset;
      if (index < 0 || nextIndex < 0 || nextIndex >= draft.sections.length) {
        return;
      }
      const [section] = draft.sections.splice(index, 1);
      draft.sections.splice(nextIndex, 0, section);
    }, 'Reordered section');
  }

  private removeField(fieldId: string): void {
    this.setState((draft) => {
      const section = draft.sections.find((entry) => entry.id === this.selectedSectionId);
      if (!section) return;
      section.fields = section.fields.filter((field) => field.id !== fieldId);
      this.selectedFieldId = section.fields[0]?.id;
    }, 'Removed field');
  }

  private reorderField(fieldId: string, offset: number): void {
    this.setState((draft) => {
      const section = draft.sections.find((entry) => entry.id === this.selectedSectionId);
      if (!section) return;
      const index = section.fields.findIndex((field) => field.id === fieldId);
      const nextIndex = index + offset;
      if (index < 0 || nextIndex < 0 || nextIndex >= section.fields.length) {
        return;
      }
      const [field] = section.fields.splice(index, 1);
      section.fields.splice(nextIndex, 0, field);
    }, 'Reordered field');
  }

  private removeValidationRule(index: number): void {
    if (index < 0) return;
    this.setState((draft) => {
      const field = this.findField(draft, this.selectedFieldId);
      if (!field?.validation) return;
      field.validation.splice(index, 1);
    }, 'Removed validation rule');
  }

  private handleInput(event: Event): void {
    const target = event.target as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
    const bind = target.dataset.bind;
    if (bind) {
      const checkboxState = target instanceof HTMLInputElement && target.type === 'checkbox' ? target.checked : undefined;
      this.handleBinding(bind, target.value, checkboxState);
      return;
    }
    if (target.dataset.ruleIndex !== undefined && target.dataset.ruleProp) {
      this.updateRule(Number(target.dataset.ruleIndex), target.dataset.ruleProp as keyof ValidationRule, target.value);
    }
  }

  private handleBinding(bind: string, value: string, checked?: boolean): void {
    this.setState((draft) => {
      const section = draft.sections.find((entry) => entry.id === this.selectedSectionId);
      const field = this.findField(draft, this.selectedFieldId);
      switch (bind) {
        case 'definition-name':
          draft.name = value;
          break;
        case 'definition-description':
          draft.description = value;
          break;
        case 'section-title':
          if (section) section.title = value;
          break;
        case 'section-description':
          if (section) section.description = value;
          break;
        case 'layout-columns':
          if (section) section.layout = { ...(section.layout ?? {}), columns: Number(value) as 1 | 2 | 3 | 4 };
          break;
        case 'layout-style':
          if (section) section.layout = { ...(section.layout ?? {}), style: value as 'default' | 'card' | 'compact' };
          break;
        case 'field-name':
          if (field) field.name = value;
          break;
        case 'field-label':
          if (field) field.label = value;
          break;
        case 'field-type':
          if (field) {
            field.type = value as Field['type'];
            field.options = ['select', 'multiselect', 'radio'].includes(field.type) ? field.options ?? [] : [];
            field.fields = ['array', 'object'].includes(field.type) ? field.fields ?? [] : undefined;
            field.columns = field.type === 'table' ? field.columns ?? [] : undefined;
          }
          break;
        case 'field-required':
          if (field) field.required = checked ?? false;
          break;
        case 'field-placeholder':
          if (field) field.placeholder = value;
          break;
        case 'field-help':
          if (field) field.help = value;
          break;
        case 'field-default':
          if (field) field.defaultValue = value;
          break;
        case 'field-options':
          if (field) {
            field.options = value
              .split('\n')
              .map((line) => line.trim())
              .filter(Boolean)
              .map((line) => {
                const [optionValue, optionLabel] = line.split(':');
                return { value: optionValue.trim(), label: (optionLabel ?? optionValue).trim() } as FieldOption;
              });
          }
          break;
        case 'field-condition-field':
          if (field) field.condition = { ...(field.condition ?? { operator: 'eq' }), field: value } as Field['condition'];
          break;
        case 'field-condition-operator':
          if (field) field.condition = { ...(field.condition ?? { field: '' }), operator: value as NonNullable<Field['condition']>['operator'] } as Field['condition'];
          break;
        case 'field-condition-value':
          if (field) field.condition = { ...(field.condition ?? { field: '', operator: 'eq' }), value } as Field['condition'];
          break;
        default:
          break;
      }
    }, `Updated ${bind}`);
  }

  private updateRule(index: number, property: keyof ValidationRule, rawValue: string): void {
    this.setState((draft) => {
      const field = this.findField(draft, this.selectedFieldId);
      if (!field?.validation?.[index]) return;
      const rule = field.validation[index];
      if (property === 'type') {
        rule.type = rawValue as ValidationRule['type'];
      } else if (property === 'message') {
        rule.message = rawValue;
      } else if (property === 'value') {
        rule.value = rawValue;
      }
    }, 'Updated validation rule');
  }

  private findField(state: DefinitionFile, fieldId?: string): Field | undefined {
    for (const section of state.sections) {
      const field = section.fields.find((entry) => entry.id === fieldId);
      if (field) return field;
    }
    return undefined;
  }

  private async handleFileOpen(): Promise<void> {
    const file = this.fileInput.files?.[0];
    if (!file) return;
    this.state = JSON.parse(await file.text()) as DefinitionFile;
    this.selectedSectionId = this.state.sections[0]?.id ?? '';
    this.selectedFieldId = this.state.sections[0]?.fields[0]?.id;
    this.history = this.createHistory(this.state);
    this.status = `Opened ${file.name}`;
    void storage.set('definitions', this.state.id, this.state);
    this.render();
  }

  private async loadLocal(): Promise<void> {
    const definitions = await storage.list<DefinitionFile>('definitions');
    if (!definitions.length) {
      this.status = 'No saved definitions found';
      this.render();
      return;
    }
    const names = definitions.map((definition) => definition.name).join('\n');
    const selectedName = window.prompt(`Load definition by name:\n${names}`, definitions[0].name);
    const selected = definitions.find((definition) => definition.name === selectedName) ?? definitions[0];
    this.state = selected;
    this.selectedSectionId = this.state.sections[0]?.id ?? '';
    this.selectedFieldId = this.state.sections[0]?.fields[0]?.id;
    this.history = this.createHistory(this.state);
    this.status = `Loaded ${selected.name} from IndexedDB`;
    this.render();
  }

  private saveJson(): void {
    downloadJson(`${this.state.name || 'definition'}.definition.json`, this.state);
    this.status = 'Downloaded definition JSON';
    this.render();
  }

  private renderFieldProperties(field: Field | undefined): string {
    if (!field) {
      return '<div class="empty-state">Select a field to edit its properties.</div>';
    }
    return `
      <div class="panel-section">
        <h4>Field properties</h4>
        <label>Name</label>
        <input data-bind="field-name" value="${escapeHtml(field.name)}" />
        <label>Label</label>
        <input data-bind="field-label" value="${escapeHtml(field.label)}" />
        <label>Type</label>
        <select data-bind="field-type">
          ${['text', 'number', 'date', 'boolean', 'select', 'multiselect', 'radio', 'checkbox', 'textarea', 'file', 'array', 'object', 'table']
            .map((type) => `<option value="${type}" ${field.type === type ? 'selected' : ''}>${type}</option>`)
            .join('')}
        </select>
        <label class="checkbox-row"><input type="checkbox" data-bind="field-required" ${field.required ? 'checked' : ''} /> Required</label>
        <label>Placeholder</label>
        <input data-bind="field-placeholder" value="${escapeHtml(field.placeholder ?? '')}" />
        <label>Help text</label>
        <textarea data-bind="field-help" rows="2">${escapeHtml(field.help ?? '')}</textarea>
        <label>Default value</label>
        <input data-bind="field-default" value="${escapeHtml(String(field.defaultValue ?? ''))}" />
      </div>
      ${['select', 'multiselect', 'radio'].includes(field.type)
        ? `
          <div class="panel-section">
            <h4>Options</h4>
            <textarea data-bind="field-options" rows="5">${escapeHtml((field.options ?? []).map((option) => `${option.value}:${option.label}`).join('\n'))}</textarea>
            <small>One option per line: value:label</small>
          </div>
        `
        : ''}
      <div class="panel-section">
        <h4>Condition</h4>
        <label>Field reference</label>
        <input data-bind="field-condition-field" value="${escapeHtml(field.condition?.field ?? '')}" />
        <label>Operator</label>
        <select data-bind="field-condition-operator">
          ${['eq', 'ne', 'gt', 'lt', 'contains', 'notEmpty', 'empty']
            .map((operator) => `<option value="${operator}" ${field.condition?.operator === operator ? 'selected' : ''}>${operator}</option>`)
            .join('')}
        </select>
        <label>Value</label>
        <input data-bind="field-condition-value" value="${escapeHtml(String(field.condition?.value ?? ''))}" />
      </div>
      ${renderValidationEditor(field.validation)}
      ${renderArrayEditor(field)}
      ${renderTableEditor(field)}
    `;
  }

  render(): void {
    const section = this.selectedSection;
    this.root.innerHTML = `
      <div class="shell">
        <header class="topbar">
          <div>
            <h1>Definition Editor</h1>
            <p>Schema authoring for sections, fields, layouts, validation, arrays, and tables.</p>
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
        <section class="workspace-meta">
          <div>
            <label>Definition name</label>
            <input data-bind="definition-name" value="${escapeHtml(this.state.name)}" />
          </div>
          <div class="wide">
            <label>Description</label>
            <input data-bind="definition-description" value="${escapeHtml(this.state.description ?? '')}" />
          </div>
          <div class="pill-group">
            <span class="pill">${this.state.sections.length} sections</span>
            <span class="pill">${escapeHtml(this.history.currentBranch.name)}</span>
            <span class="pill">${this.history.currentBranch.snapshots.length} snapshots</span>
          </div>
        </section>
        <main class="layout-grid">
          <aside class="panel sidebar">
            <div class="section-header-inline">
              <h3>Sections</h3>
              <div>
                <button data-action="add-section">Add</button>
                <button data-action="remove-section" ${section ? '' : 'disabled'}>Remove</button>
              </div>
            </div>
            <div class="stack">${renderSectionList(this.state.sections, this.selectedSectionId)}</div>
            <div class="sidebar-actions">
              <button data-action="move-section-up">Move up</button>
              <button data-action="move-section-down">Move down</button>
            </div>
          </aside>
          <section class="panel main-panel">
            <div class="section-header-inline">
              <h3>${escapeHtml(section?.title ?? 'Fields')}</h3>
              <div class="toolbar compact-toolbar">
                <button data-action="add-field-text">Text</button>
                <button data-action="add-field-number">Number</button>
                <button data-action="add-field-select">Select</button>
                <button data-action="add-field-array">Array</button>
                <button data-action="add-field-table">Table</button>
                <button data-action="add-field-object">Object</button>
              </div>
            </div>
            ${renderSectionEditor(section)}
            ${renderLayoutEditor(section?.layout)}
            <div class="section-header-inline"><h4>Fields</h4></div>
            <div class="stack">${renderFieldList(section?.fields ?? [], this.selectedFieldId)}</div>
          </section>
          <aside class="panel inspector">${this.renderFieldProperties(this.selectedField)}</aside>
        </main>
        <footer class="statusbar">
          <span>${escapeHtml(this.status)}</span>
          <span>${this.state.metadata.modified}</span>
        </footer>
      </div>
      <style>
        .shell { min-height: 100vh; display: flex; flex-direction: column; }
        .topbar { display: flex; justify-content: space-between; gap: 1rem; padding: 1rem 1.5rem; border-bottom: 1px solid var(--border); background: linear-gradient(135deg, #eff6ff, #ffffff); }
        .topbar h1 { margin: 0; font-size: 1.4rem; }
        .topbar p { margin: 0.35rem 0 0; color: var(--muted); }
        .toolbar { display: flex; flex-wrap: wrap; gap: 0.5rem; align-content: flex-start; }
        button { border: 1px solid var(--border); background: white; padding: 0.55rem 0.85rem; border-radius: 0.7rem; color: var(--text); cursor: pointer; }
        button:hover:not(:disabled) { border-color: var(--primary); color: var(--primary); }
        button:disabled { opacity: 0.45; cursor: not-allowed; }
        .workspace-meta { display: grid; grid-template-columns: 1fr 2fr auto; gap: 1rem; padding: 1rem 1.5rem; }
        .workspace-meta label, .panel label { display: block; font-size: 0.82rem; color: var(--muted); margin-bottom: 0.35rem; }
        input, select, textarea { width: 100%; border: 1px solid var(--border); border-radius: 0.75rem; padding: 0.7rem 0.8rem; background: white; color: var(--text); }
        textarea { resize: vertical; }
        .layout-grid { display: grid; grid-template-columns: 280px minmax(0, 1.3fr) minmax(300px, 0.9fr); gap: 1rem; padding: 0 1.5rem 1rem; flex: 1; }
        .panel { background: var(--panel); border: 1px solid var(--border); border-radius: 1rem; padding: 1rem; box-shadow: 0 12px 30px rgba(37, 99, 235, 0.06); overflow: auto; }
        .stack { display: grid; gap: 0.75rem; }
        .list-item, .field-card { width: 100%; text-align: left; display: flex; justify-content: space-between; align-items: center; gap: 0.75rem; padding: 0.85rem; border-radius: 0.9rem; background: #fff; }
        .list-item.active, .field-card.selected { border-color: var(--primary); background: var(--accent); }
        .field-toolbar, .pill-group, .sidebar-actions { display: flex; gap: 0.35rem; flex-wrap: wrap; }
        .pill { display: inline-flex; align-items: center; padding: 0.28rem 0.6rem; border-radius: 999px; background: var(--accent); color: var(--primary); font-size: 0.8rem; }
        .field-meta, small { color: var(--muted); }
        .panel-section { margin-bottom: 1rem; }
        .panel-section h4, .section-header-inline h3, .section-header-inline h4 { margin: 0; }
        .section-header-inline { display: flex; justify-content: space-between; align-items: center; gap: 0.5rem; margin-bottom: 0.75rem; }
        .checkbox-row { display: flex; align-items: center; gap: 0.5rem; }
        .checkbox-row input { width: auto; }
        .rule-card, .mini-card, .table-column-row { border: 1px solid var(--border); border-radius: 0.8rem; padding: 0.75rem; background: #fbfdff; }
        .rule-row { display: grid; grid-template-columns: 1fr 1fr auto; gap: 0.5rem; margin-bottom: 0.5rem; }
        .empty-state { border: 1px dashed var(--border); border-radius: 0.9rem; padding: 1rem; text-align: center; color: var(--muted); }
        .empty-state.compact { padding: 0.75rem; font-size: 0.9rem; }
        .statusbar { display: flex; justify-content: space-between; gap: 1rem; padding: 0.85rem 1.5rem; border-top: 1px solid var(--border); color: var(--muted); font-size: 0.9rem; }
        @media (max-width: 1180px) { .layout-grid, .workspace-meta { grid-template-columns: 1fr; } }
      </style>
    `;
  }
}
