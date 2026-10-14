import { applyPatch, deepClone, deepEqual, diffObjects } from './diff';
import { storage } from './storage';
import type { Branch, DiffOp, HistoryState, Snapshot } from './types';

export interface MergeConflict {
  path: string;
  sourceValue: unknown;
  targetValue: unknown;
}

export interface MergeResult<T> {
  merged: T;
  conflicts: MergeConflict[];
  operations: DiffOp[];
}

interface HistoryOptions<T> {
  key: string;
  maxEntries?: number;
  autoBackupEvery?: number;
  onChange?: (state: T, snapshot: Snapshot<T>, branch: Branch<T>) => void;
}

function makeId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function makeSnapshot<T>(data: T, label?: string): Snapshot<T> {
  return {
    id: makeId('snap'),
    timestamp: new Date().toISOString(),
    label,
    data: deepClone(data),
  };
}

function changedPathMap(operations: DiffOp[]): Map<string, DiffOp> {
  return new Map(operations.map((operation) => [operation.path, operation]));
}

export class HistoryManager<T> {
  private readonly options: Required<Pick<HistoryOptions<T>, 'key' | 'maxEntries' | 'autoBackupEvery'>> &
    Pick<HistoryOptions<T>, 'onChange'>;

  private branches = new Map<string, Branch<T>>();
  private activeBranchId: string;
  private dirtyChanges = 0;

  constructor(initialState: T, options: HistoryOptions<T>) {
    this.options = {
      key: options.key,
      maxEntries: options.maxEntries ?? 100,
      autoBackupEvery: options.autoBackupEvery ?? 5,
      onChange: options.onChange,
    };

    const initialBranch: Branch<T> = {
      id: makeId('branch'),
      name: 'main',
      snapshots: [makeSnapshot(initialState, 'Initial state')],
      current: 0,
    };

    this.branches.set(initialBranch.id, initialBranch);
    this.activeBranchId = initialBranch.id;
    void this.persist();
  }

  get state(): T {
    return deepClone(this.currentSnapshot.data);
  }

  get currentBranch(): Branch<T> {
    const branch = this.branches.get(this.activeBranchId);
    if (!branch) {
      throw new Error('Active branch not found.');
    }
    return branch;
  }

  get currentSnapshot(): Snapshot<T> {
    return this.currentBranch.snapshots[this.currentBranch.current];
  }

  listBranches(): Branch<T>[] {
    return Array.from(this.branches.values()).map((branch) => deepClone(branch));
  }

  applyChange(nextState: T, label = 'Updated'): void {
    if (deepEqual(this.currentSnapshot.data, nextState)) {
      return;
    }

    const branch = this.currentBranch;
    const snapshots = branch.snapshots.slice(0, branch.current + 1);
    snapshots.push(makeSnapshot(nextState, label));
    while (snapshots.length > this.options.maxEntries) {
      snapshots.shift();
    }
    branch.snapshots = snapshots;
    branch.current = snapshots.length - 1;
    this.branches.set(branch.id, branch);
    this.dirtyChanges += 1;
    this.emit();
    void this.autoBackup();
  }

  createSnapshot(label: string): Snapshot<T> {
    const snapshot = makeSnapshot(this.currentSnapshot.data, label);
    const branch = this.currentBranch;
    branch.snapshots = [...branch.snapshots.slice(0, branch.current + 1), snapshot];
    branch.current = branch.snapshots.length - 1;
    this.branches.set(branch.id, branch);
    this.emit();
    return snapshot;
  }

  undo(): boolean {
    const branch = this.currentBranch;
    if (branch.current === 0) {
      return false;
    }
    branch.current -= 1;
    this.emit();
    return true;
  }

  redo(): boolean {
    const branch = this.currentBranch;
    if (branch.current >= branch.snapshots.length - 1) {
      return false;
    }
    branch.current += 1;
    this.emit();
    return true;
  }

  createBranch(name: string): string {
    const currentBranch = this.currentBranch;
    const snapshots = currentBranch.snapshots.slice(0, currentBranch.current + 1).map((snapshot) => deepClone(snapshot));
    const branchId = makeId('branch');
    const branch: Branch<T> = {
      id: branchId,
      name,
      parentBranchId: currentBranch.id,
      parentSnapshotId: currentBranch.snapshots[currentBranch.current]?.id,
      snapshots,
      current: snapshots.length - 1,
    };
    this.branches.set(branchId, branch);
    this.activeBranchId = branchId;
    this.emit();
    return branchId;
  }

  switchBranch(branchId: string): boolean {
    if (!this.branches.has(branchId)) {
      return false;
    }
    this.activeBranchId = branchId;
    this.emit();
    return true;
  }

  diffSnapshots(leftSnapshotId: string, rightSnapshotId: string, branchId = this.activeBranchId): DiffOp[] {
    const branch = this.branches.get(branchId);
    if (!branch) {
      return [];
    }
    const left = branch.snapshots.find((snapshot) => snapshot.id === leftSnapshotId);
    const right = branch.snapshots.find((snapshot) => snapshot.id === rightSnapshotId);
    if (!left || !right) {
      return [];
    }
    return diffObjects(left.data, right.data);
  }

  mergeBranch(
    sourceBranchId: string,
    targetBranchId = this.activeBranchId,
    strategy: 'source-wins' | 'target-wins' = 'source-wins',
  ): MergeResult<T> | undefined {
    const source = this.branches.get(sourceBranchId);
    const target = this.branches.get(targetBranchId);
    if (!source || !target) {
      return undefined;
    }

    const sourceState = source.snapshots[source.current]?.data;
    const targetState = target.snapshots[target.current]?.data;
    const baseState = source.parentSnapshotId
      ? source.snapshots.find((snapshot) => snapshot.id === source.parentSnapshotId)?.data ?? target.snapshots[0]?.data
      : target.snapshots[0]?.data;
    if (sourceState === undefined || targetState === undefined || baseState === undefined) {
      return undefined;
    }

    const sourceOps = diffObjects(baseState, sourceState);
    const targetOps = diffObjects(baseState, targetState);
    const sourceMap = changedPathMap(sourceOps);
    const conflicts: MergeConflict[] = [];

    targetOps.forEach((operation) => {
      const sourceOperation = sourceMap.get(operation.path);
      if (sourceOperation && !deepEqual(sourceOperation.value, operation.value)) {
        conflicts.push({
          path: operation.path,
          sourceValue: sourceOperation.value,
          targetValue: operation.value,
        });
      }
    });

    const merged = strategy === 'source-wins' ? applyPatch(targetState, sourceOps) : applyPatch(sourceState, targetOps);
    this.activeBranchId = targetBranchId;
    this.applyChange(merged, `Merged ${source.name} into ${target.name}`);

    return {
      merged,
      conflicts,
      operations: diffObjects(targetState, merged),
    };
  }

  private emit(): void {
    void this.persist();
    this.options.onChange?.(this.state, this.currentSnapshot, deepClone(this.currentBranch));
  }

  private async autoBackup(): Promise<void> {
    if (this.dirtyChanges > 0 && this.dirtyChanges % this.options.autoBackupEvery === 0) {
      await storage.backup('history', this.options.key, {
        branchId: this.activeBranchId,
        snapshot: this.currentSnapshot,
      });
    }
  }

  private async persist(): Promise<void> {
    const serialized: HistoryState<T> = {
      activeBranchId: this.activeBranchId,
      branches: Array.from(this.branches.values()).map((branch) => deepClone(branch)),
    };
    await storage.set('history', this.options.key, serialized);
  }
}
