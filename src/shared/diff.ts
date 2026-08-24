import type { DiffOp } from './types';

const ROOT_PATH = '/';

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function encodePathSegment(segment: string): string {
  return segment.replace(/~/g, '~0').replace(/\//g, '~1');
}

function decodePathSegment(segment: string): string {
  return segment.replace(/~1/g, '/').replace(/~0/g, '~');
}

export function deepClone<T>(value: T): T {
  return value === undefined ? value : (JSON.parse(JSON.stringify(value)) as T);
}

export function deepEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function joinPath(base: string, segment: string | number): string {
  const token = encodePathSegment(String(segment));
  if (base === ROOT_PATH) {
    return `${ROOT_PATH}${token}`;
  }
  return `${base}/${token}`;
}

export function diffObjects(before: unknown, after: unknown, basePath = ROOT_PATH): DiffOp[] {
  if (deepEqual(before, after)) {
    return [];
  }

  if (Array.isArray(before) && Array.isArray(after)) {
    const max = Math.max(before.length, after.length);
    const ops: DiffOp[] = [];
    for (let index = 0; index < max; index += 1) {
      const path = joinPath(basePath, index);
      if (index >= before.length) {
        ops.push({ op: 'add', path, value: deepClone(after[index]) });
        continue;
      }
      if (index >= after.length) {
        ops.push({ op: 'remove', path, oldValue: deepClone(before[index]) });
        continue;
      }
      ops.push(...diffObjects(before[index], after[index], path));
    }
    return ops;
  }

  if (isObject(before) && isObject(after)) {
    const ops: DiffOp[] = [];
    const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
    for (const key of keys) {
      const path = joinPath(basePath, key);
      if (!(key in before)) {
        ops.push({ op: 'add', path, value: deepClone(after[key]) });
        continue;
      }
      if (!(key in after)) {
        ops.push({ op: 'remove', path, oldValue: deepClone(before[key]) });
        continue;
      }
      ops.push(...diffObjects(before[key], after[key], path));
    }
    return ops;
  }

  return [
    {
      op: 'replace',
      path: basePath,
      value: deepClone(after),
      oldValue: deepClone(before),
    },
  ];
}

function parsePath(path: string): string[] {
  if (!path || path === ROOT_PATH) {
    return [];
  }
  return path
    .split('/')
    .slice(1)
    .map((segment) => decodePathSegment(segment));
}

function getContainerAndKey(root: unknown, path: string): { container: unknown; key: string | number | undefined } {
  const segments = parsePath(path);
  if (segments.length === 0) {
    return { container: undefined, key: undefined };
  }

  let current = root;
  for (let index = 0; index < segments.length - 1; index += 1) {
    const segment = segments[index];
    if (Array.isArray(current)) {
      current = current[Number(segment)];
    } else if (isObject(current)) {
      current = current[segment];
    } else {
      throw new Error(`Cannot resolve path ${path}`);
    }
  }

  const finalSegment = segments[segments.length - 1];
  return {
    container: current,
    key: Array.isArray(current) ? Number(finalSegment) : finalSegment,
  };
}

export function applyPatch<T>(source: T, operations: DiffOp[]): T {
  let result = deepClone(source);

  for (const operation of operations) {
    if (operation.path === ROOT_PATH) {
      if (operation.op === 'remove') {
        result = undefined as T;
      } else {
        result = deepClone(operation.value) as T;
      }
      continue;
    }

    const { container, key } = getContainerAndKey(result, operation.path);
    if (key === undefined) {
      continue;
    }

    if (Array.isArray(container)) {
      const index = Number(key);
      if (operation.op === 'remove') {
        container.splice(index, 1);
      } else if (operation.op === 'add') {
        if (index >= container.length) {
          container.push(deepClone(operation.value));
        } else {
          container.splice(index, 0, deepClone(operation.value));
        }
      } else {
        container[index] = deepClone(operation.value);
      }
      continue;
    }

    if (isObject(container)) {
      if (operation.op === 'remove') {
        delete container[key as string];
      } else {
        container[key as string] = deepClone(operation.value);
      }
    }
  }

  return result;
}
