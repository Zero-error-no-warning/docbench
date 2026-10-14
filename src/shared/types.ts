export interface DefinitionFile {
  version: string;
  id: string;
  name: string;
  description?: string;
  sections: Section[];
  metadata: Metadata;
}

export interface Section {
  id: string;
  title: string;
  description?: string;
  fields: Field[];
  layout?: Layout;
  condition?: Condition;
}

export interface Field {
  id: string;
  name: string;
  label: string;
  type: FieldType;
  required?: boolean;
  validation?: ValidationRule[];
  options?: FieldOption[];
  fields?: Field[];
  columns?: TableColumn[];
  defaultValue?: unknown;
  placeholder?: string;
  help?: string;
  condition?: Condition;
}

export type FieldType =
  | 'text'
  | 'number'
  | 'date'
  | 'boolean'
  | 'select'
  | 'multiselect'
  | 'radio'
  | 'checkbox'
  | 'textarea'
  | 'file'
  | 'array'
  | 'object'
  | 'table';

export interface ValidationRule {
  type: 'required' | 'min' | 'max' | 'minLength' | 'maxLength' | 'pattern' | 'custom';
  value?: unknown;
  message: string;
}

export interface FieldOption {
  value: string;
  label: string;
}

export interface TableColumn {
  id: string;
  label: string;
  type: FieldType;
  required?: boolean;
  validation?: ValidationRule[];
}

export interface Layout {
  columns?: 1 | 2 | 3 | 4;
  style?: 'default' | 'card' | 'compact';
}

export interface Condition {
  field: string;
  operator: 'eq' | 'ne' | 'gt' | 'lt' | 'contains' | 'notEmpty' | 'empty';
  value?: unknown;
}

export interface Metadata {
  created: string;
  modified: string;
  author?: string;
  tags?: string[];
}

export interface RenderDefinition {
  version: string;
  id: string;
  name: string;
  definitionId: string;
  outputs: OutputConfig[];
  metadata: Metadata;
}

export interface OutputConfig {
  id: string;
  name: string;
  format: OutputFormat;
  template: Template;
}

export type OutputFormat = 'html' | 'word' | 'excel' | 'powerpoint' | 'pdf';

export interface Template {
  type: 'html' | 'handlebars' | 'markdown';
  content: string;
  styles?: string;
  sections?: TemplateSectionConfig[];
}

export interface TemplateSectionConfig {
  sectionId: string;
  template: string;
}

export interface DocumentData {
  version: string;
  id: string;
  definitionId: string;
  renderDefinitionId?: string;
  name: string;
  data: Record<string, unknown>;
  attachments: AttachmentRef[];
  metadata: Metadata;
}

export interface AttachmentRef {
  id: string;
  fieldId: string;
  name: string;
  type: string;
  size: number;
  storageKey: string;
}

export interface Snapshot<T> {
  id: string;
  timestamp: string;
  label?: string;
  data: T;
}

export interface Branch<T> {
  id: string;
  name: string;
  parentBranchId?: string;
  parentSnapshotId?: string;
  snapshots: Snapshot<T>[];
  current: number;
}

export interface DiffOp {
  op: 'add' | 'remove' | 'replace';
  path: string;
  value?: unknown;
  oldValue?: unknown;
}

export interface ValidationError {
  fieldId: string;
  sectionId: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

export interface HistoryState<T> {
  activeBranchId: string;
  branches: Branch<T>[];
}
