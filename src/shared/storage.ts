type StoreName = 'definitions' | 'renderDefinitions' | 'documentData' | 'attachments' | 'history' | 'backups';

interface StoredRecord<T> {
  id: string;
  value: T;
  updatedAt: string;
}

const STORE_NAMES: StoreName[] = [
  'definitions',
  'renderDefinitions',
  'documentData',
  'attachments',
  'history',
  'backups',
];

export class DocBenchStorage {
  private readonly dbName = 'docbench';
  private readonly version = 1;
  private databasePromise: Promise<IDBDatabase> | null = null;

  async open(): Promise<IDBDatabase> {
    if (!this.databasePromise) {
      this.databasePromise = new Promise((resolve, reject) => {
        const request = indexedDB.open(this.dbName, this.version);
        request.onupgradeneeded = () => {
          const db = request.result;
          STORE_NAMES.forEach((name) => {
            if (!db.objectStoreNames.contains(name)) {
              db.createObjectStore(name, { keyPath: 'id' });
            }
          });
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    }
    return this.databasePromise;
  }

  private async transaction<T>(
    storeName: StoreName,
    mode: IDBTransactionMode,
    task: (store: IDBObjectStore) => Promise<T>,
  ): Promise<T> {
    const db = await this.open();
    const tx = db.transaction(storeName, mode);
    const store = tx.objectStore(storeName);
    const result = await task(store);
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
    return result;
  }

  async get<T>(storeName: StoreName, id: string): Promise<T | undefined> {
    return this.transaction(storeName, 'readonly', (store) => new Promise<T | undefined>((resolve, reject) => {
      const request = store.get(id);
      request.onsuccess = () => {
        const record = request.result as StoredRecord<T> | undefined;
        resolve(record?.value);
      };
      request.onerror = () => reject(request.error);
    }));
  }

  async set<T>(storeName: StoreName, id: string, value: T): Promise<void> {
    return this.transaction(storeName, 'readwrite', (store) => new Promise<void>((resolve, reject) => {
      const request = store.put({ id, value, updatedAt: new Date().toISOString() } as StoredRecord<T>);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    }));
  }

  async delete(storeName: StoreName, id: string): Promise<void> {
    return this.transaction(storeName, 'readwrite', (store) => new Promise<void>((resolve, reject) => {
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    }));
  }

  async list<T>(storeName: StoreName): Promise<T[]> {
    return this.transaction(storeName, 'readonly', (store) => new Promise<T[]>((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => {
        const records = (request.result as StoredRecord<T>[]).sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
        resolve(records.map((record) => record.value));
      };
      request.onerror = () => reject(request.error);
    }));
  }

  async backup<T>(sourceStore: Exclude<StoreName, 'backups'>, id: string, data: T): Promise<string> {
    const backupId = `${sourceStore}:${id}:${Date.now()}`;
    await this.set('backups', backupId, {
      sourceStore,
      sourceId: id,
      createdAt: new Date().toISOString(),
      data,
    });
    return backupId;
  }
}

export const storage = new DocBenchStorage();
