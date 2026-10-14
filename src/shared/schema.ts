import type {
  Condition,
  DefinitionFile,
  DocumentData,
  Field,
  TableColumn,
  ValidationError,
  ValidationResult,
  ValidationRule,
} from './types';

function readValue(source: Record<string, unknown>, path: string): unknown {
  if (path in source) {
    return source[path];
  }
  return path.split('.').reduce<unknown>((current, segment) => {
    if (current && typeof current === 'object' && segment in (current as Record<string, unknown>)) {
      return (current as Record<string, unknown>)[segment];
    }
    return undefined;
  }, source);
}

export function evaluateCondition(condition: Condition | undefined, rootData: Record<string, unknown>): boolean {
  if (!condition) {
    return true;
  }
  const actual = readValue(rootData, condition.field);
  switch (condition.operator) {
    case 'eq':
      return actual === condition.value;
    case 'ne':
      return actual !== condition.value;
    case 'gt':
      return Number(actual) > Number(condition.value);
    case 'lt':
      return Number(actual) < Number(condition.value);
    case 'contains':
      if (Array.isArray(actual)) {
        return actual.includes(condition.value);
      }
      return String(actual ?? '').includes(String(condition.value ?? ''));
    case 'notEmpty':
      return actual !== undefined && actual !== null && String(actual).trim() !== '';
    case 'empty':
      return actual === undefined || actual === null || String(actual).trim() === '';
    default:
      return true;
  }
}

function isEmpty(value: unknown): boolean {
  return value === undefined || value === null || value === '' || (Array.isArray(value) && value.length === 0);
}

function validateRule(value: unknown, rule: ValidationRule): boolean {
  switch (rule.type) {
    case 'required':
      return !isEmpty(value);
    case 'min':
      return Number(value) >= Number(rule.value);
    case 'max':
      return Number(value) <= Number(rule.value);
    case 'minLength':
      return String(value ?? '').length >= Number(rule.value);
    case 'maxLength':
      return String(value ?? '').length <= Number(rule.value);
    case 'pattern':
      try {
        return new RegExp(String(rule.value ?? '')).test(String(value ?? ''));
      } catch {
        return false;
      }
    case 'custom':
      return true;
    default:
      return true;
  }
}

function validateFieldType(field: Field, value: unknown): string | undefined {
  if (isEmpty(value)) {
    return undefined;
  }
  switch (field.type) {
    case 'text':
    case 'textarea':
    case 'select':
    case 'radio':
    case 'date':
      return typeof value === 'string' ? undefined : 'Expected text value.';
    case 'number':
      return typeof value === 'number' && Number.isFinite(value) ? undefined : 'Expected numeric value.';
    case 'boolean':
    case 'checkbox':
      return typeof value === 'boolean' ? undefined : 'Expected true/false value.';
    case 'multiselect':
      return Array.isArray(value) ? undefined : 'Expected multiple selections.';
    case 'file':
      return typeof value === 'string' || (Array.isArray(value) && value.every((item) => typeof item === 'string'))
        ? undefined
        : 'Expected file reference.';
    case 'array':
      return Array.isArray(value) ? undefined : 'Expected array value.';
    case 'object':
      return value && typeof value === 'object' && !Array.isArray(value) ? undefined : 'Expected object value.';
    case 'table':
      return Array.isArray(value) ? undefined : 'Expected table rows.';
    default:
      return undefined;
  }
}

function pushError(errors: ValidationError[], sectionId: string, fieldId: string, message: string): void {
  errors.push({ sectionId, fieldId, message });
}

function validateTableColumns(sectionId: string, field: Field, rows: unknown, errors: ValidationError[]): void {
  if (!Array.isArray(rows) || !field.columns) {
    return;
  }
  rows.forEach((row, rowIndex) => {
    const rowData = typeof row === 'object' && row !== null ? (row as Record<string, unknown>) : {};
    field.columns?.forEach((column: TableColumn) => {
      const value = rowData[column.id];
      if (column.required && isEmpty(value)) {
        pushError(errors, sectionId, `${field.id}.${column.id}.${rowIndex}`, `${column.label} is required.`);
      }
      column.validation?.forEach((rule) => {
        if (!isEmpty(value) && !validateRule(value, rule)) {
          pushError(errors, sectionId, `${field.id}.${column.id}.${rowIndex}`, rule.message);
        }
      });
    });
  });
}

function validateNestedFields(
  sectionId: string,
  fields: Field[] | undefined,
  value: unknown,
  rootData: Record<string, unknown>,
  errors: ValidationError[],
): void {
  if (!fields) {
    return;
  }
  const nestedData = value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
  fields.forEach((field) => validateField(sectionId, field, nestedData[field.name], { ...rootData, ...nestedData }, errors));
}

export function validateField(
  sectionId: string,
  field: Field,
  value: unknown,
  rootData: Record<string, unknown>,
  errors: ValidationError[],
): void {
  if (!evaluateCondition(field.condition, rootData)) {
    return;
  }

  if (field.required && isEmpty(value)) {
    pushError(errors, sectionId, field.id, `${field.label} is required.`);
    return;
  }

  const typeMessage = validateFieldType(field, value);
  if (typeMessage) {
    pushError(errors, sectionId, field.id, typeMessage);
    return;
  }

  field.validation?.forEach((rule) => {
    if (!isEmpty(value) && !validateRule(value, rule)) {
      pushError(errors, sectionId, field.id, rule.message);
    }
  });

  if (field.type === 'array' && Array.isArray(value) && field.fields) {
    value.forEach((entry, index) => {
      if (field.fields && field.fields.length === 1) {
        validateField(sectionId, field.fields[0], entry, rootData, errors);
      } else {
        validateNestedFields(sectionId, field.fields, entry, rootData, errors);
      }
      if (entry === undefined) {
        pushError(errors, sectionId, `${field.id}.${index}`, `${field.label} entry is empty.`);
      }
    });
  }

  if (field.type === 'object') {
    validateNestedFields(sectionId, field.fields, value, rootData, errors);
  }

  if (field.type === 'table') {
    validateTableColumns(sectionId, field, value, errors);
  }
}

export function validateDocumentData(definition: DefinitionFile, documentData: DocumentData): ValidationResult {
  const errors: ValidationError[] = [];
  const data = documentData.data ?? {};

  definition.sections.forEach((section) => {
    if (!evaluateCondition(section.condition, data)) {
      return;
    }
    section.fields.forEach((field) => {
      validateField(section.id, field, data[field.name], data, errors);
    });
  });

  return {
    valid: errors.length === 0,
    errors,
  };
}
