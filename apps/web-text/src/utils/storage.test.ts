import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Doc, HistoryEntry } from './storage';

type StorageModule = typeof import('./storage');

/** 内存版 localStorage（node 环境下替身） */
function createMemoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (key) => (map.has(key) ? map.get(key)! : null),
    key: (i) => [...map.keys()][i] ?? null,
    removeItem: (key) => void map.delete(key),
    setItem: (key, value) => void map.set(key, String(value)),
  };
}

let storage: StorageModule;
let ls: Storage;

// storage.ts 在模块级缓存 DB 连接：每个用例换一个全新的 IndexedDB 并重新加载模块
beforeEach(async () => {
  vi.stubGlobal('indexedDB', new IDBFactory());
  ls = createMemoryStorage();
  vi.stubGlobal('localStorage', ls);
  vi.resetModules();
  storage = await import('./storage');
});

const doc = (id: string, updatedAt: number, extra: Partial<Doc> = {}): Doc => ({
  id,
  name: `name-${id}`,
  content: `content-${id}`,
  createdAt: 1,
  updatedAt,
  ...extra,
});

const hist = (id: string, docId: string, timestamp: number, extra: Partial<HistoryEntry> = {}): HistoryEntry => ({
  id,
  docId,
  content: `c-${id}`,
  timestamp,
  ...extra,
});

describe('纯函数', () => {
  it('uid 唯一且只含 [0-9a-z-]', () => {
    const ids = new Set(Array.from({ length: 500 }, () => storage.uid()));
    expect(ids.size).toBe(500);
    for (const id of ids) expect(id).toMatch(/^[0-9a-z]+-[0-9a-z]+$/);
  });

  it('getTextSize 按 UTF-8 字节计算', () => {
    expect(storage.getTextSize('')).toBe(0);
    expect(storage.getTextSize('abc')).toBe(3);
    expect(storage.getTextSize('中文')).toBe(6);
    expect(storage.getTextSize('😀')).toBe(4);
  });

  it('formatSize 单位边界', () => {
    expect(storage.formatSize(0)).toBe('0 B');
    expect(storage.formatSize(1023)).toBe('1023 B');
    expect(storage.formatSize(1024)).toBe('1.0 KB');
    expect(storage.formatSize(1536)).toBe('1.5 KB');
    expect(storage.formatSize(1024 * 1024)).toBe('1.0 MB');
    expect(storage.formatSize(5.25 * 1024 * 1024)).toBe('5.3 MB');
  });

  it('formatSize 四舍五入到 1024 KB 时进位为 MB（回归：曾显示 “1024.0 KB”）', () => {
    expect(storage.formatSize(1024 * 1024 - 1)).toBe('1.0 MB');
    expect(storage.formatSize(1024 * 1024 - 100)).toBe('1023.9 KB');
  });

  it('getStorageInfo：history 中的固定版本只计入 pinnedSize，不重复计算', () => {
    const pinned = hist('p', 'd', 1, { content: '12345', pinned: true });
    const plain = hist('h', 'd', 2, { content: '中' });
    const all = [plain, pinned];
    const info = storage.getStorageInfo('ab', all, all.filter((e) => e.pinned));
    expect(info).toEqual({ contentSize: 2, historySize: 3, pinnedSize: 5, totalSize: 10 });
  });

  it('renameHistoryEntry 只改目标条目，且不修改入参', () => {
    const a = hist('a', 'd', 1);
    const b = hist('b', 'd', 2, { pinned: true });
    const history = [a, b];
    const pinned = [b];
    const res = storage.renameHistoryEntry('b', '定稿', history, pinned);
    expect(res.history.map((e) => e.name)).toEqual([undefined, '定稿']);
    expect(res.pinned[0]).toEqual({ ...b, name: '定稿' });
    expect(b.name).toBeUndefined();
  });
});

describe('文档 CRUD（IndexedDB）', () => {
  it('空库 loadDocs 返回空数组', async () => {
    expect(await storage.loadDocs()).toEqual([]);
  });

  it('loadDocs 按 updatedAt 倒序', async () => {
    await storage.saveDoc(doc('a', 10));
    await storage.saveDoc(doc('b', 30));
    await storage.saveDoc(doc('c', 20));
    expect((await storage.loadDocs()).map((d) => d.id)).toEqual(['b', 'c', 'a']);
  });

  it('saveDoc 同 id 覆盖写入', async () => {
    await storage.saveDoc(doc('a', 1));
    await storage.saveDoc(doc('a', 2, { content: 'new' }));
    const docs = await storage.loadDocs();
    expect(docs).toHaveLength(1);
    expect(docs[0].content).toBe('new');
  });

  it('deleteDocWithHistory 删除文档及其历史，不影响其他文档', async () => {
    await storage.saveDoc(doc('a', 1));
    await storage.saveDoc(doc('b', 2));
    await storage.saveHistory('a', [hist('a1', 'a', 1), hist('a2', 'a', 2)]);
    await storage.saveHistory('b', [hist('b1', 'b', 1)]);

    await storage.deleteDocWithHistory('a');

    expect((await storage.loadDocs()).map((d) => d.id)).toEqual(['b']);
    expect(await storage.loadHistory('a')).toEqual([]);
    expect((await storage.loadHistory('b')).map((e) => e.id)).toEqual(['b1']);
  });
});

describe('历史版本（IndexedDB）', () => {
  it('loadHistory 只返回该文档的版本，按时间倒序', async () => {
    await storage.saveHistory('a', [hist('a1', 'a', 1), hist('a3', 'a', 3), hist('a2', 'a', 2)]);
    await storage.saveHistory('b', [hist('b1', 'b', 9)]);
    expect((await storage.loadHistory('a')).map((e) => e.id)).toEqual(['a3', 'a2', 'a1']);
  });

  it('saveHistory 为覆盖式：旧条目被移除，pinned / name 字段保留', async () => {
    await storage.saveHistory('a', [hist('a1', 'a', 1), hist('a2', 'a', 2)]);
    await storage.saveHistory('a', [hist('a3', 'a', 3, { pinned: true, name: 'v1' })]);
    expect(await storage.loadHistory('a')).toEqual([hist('a3', 'a', 3, { pinned: true, name: 'v1' })]);
  });

  it('saveHistory 传空数组即清空该文档历史', async () => {
    await storage.saveHistory('a', [hist('a1', 'a', 1)]);
    await storage.saveHistory('a', []);
    expect(await storage.loadHistory('a')).toEqual([]);
  });

  it('兼容 v1 库：history store 缺少 docId 索引时升级到 v2 自动补建', async () => {
    // 模拟迁移页早期版本创建的库（v1，history 无 docId 索引，已有数据）
    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.open('web-text-db', 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        db.createObjectStore('docs', { keyPath: 'id' });
        const store = db.createObjectStore('history', { keyPath: 'id' });
        store.put(hist('old', 'a', 5));
      };
      req.onsuccess = () => {
        req.result.close();
        resolve();
      };
      req.onerror = () => reject(req.error);
    });

    expect((await storage.loadHistory('a')).map((e) => e.id)).toEqual(['old']);
  });
});

describe('备份 / 恢复', () => {
  it('exportBackup → JSON → importBackup 往返无损', async () => {
    await storage.saveDoc(doc('a', 1));
    await storage.saveDoc(doc('b', 2, { name: '中文 & <名称>' }));
    await storage.saveHistory('a', [hist('a1', 'a', 1, { pinned: true, name: '定稿' })]);
    await storage.saveHistory('b', [hist('b1', 'b', 2)]);

    const backup = await storage.exportBackup();
    expect(backup.format).toBe('web-text-backup');
    expect(backup.version).toBe(1);
    expect(Number.isNaN(Date.parse(backup.exportedAt))).toBe(false);

    // 换一个全新的库导入，模拟在另一台设备恢复
    const serialized = JSON.parse(JSON.stringify(backup));
    vi.stubGlobal('indexedDB', new IDBFactory());
    vi.resetModules();
    const fresh: StorageModule = await import('./storage');

    expect(await fresh.importBackup(serialized)).toEqual({ docs: 2, history: 2 });
    expect(await fresh.loadDocs()).toEqual(await storage.loadDocs());
    expect(await fresh.loadHistory('a')).toEqual([hist('a1', 'a', 1, { pinned: true, name: '定稿' })]);
    expect(await fresh.loadHistory('b')).toEqual([hist('b1', 'b', 2)]);
  });

  it('importBackup 先清空现有数据，再写入备份内容', async () => {
    await storage.saveDoc(doc('stale', 1));
    await storage.saveHistory('stale', [hist('s1', 'stale', 1)]);

    await storage.importBackup({
      format: 'web-text-backup',
      version: 1,
      exportedAt: new Date(0).toISOString(),
      docs: [doc('n', 5)],
      history: [hist('n1', 'n', 5)],
    });

    expect((await storage.loadDocs()).map((d) => d.id)).toEqual(['n']);
    expect(await storage.loadHistory('stale')).toEqual([]);
    expect((await storage.loadHistory('n')).map((e) => e.id)).toEqual(['n1']);
  });

  it('importBackup 容忍缺失 / 非数组的 docs、history 字段', async () => {
    await storage.saveDoc(doc('x', 1));
    const res = await storage.importBackup({
      format: 'web-text-backup',
      version: 1,
      exportedAt: '',
      docs: undefined,
      history: 'oops',
    } as unknown as Parameters<StorageModule['importBackup']>[0]);
    expect(res).toEqual({ docs: 0, history: 0 });
    expect(await storage.loadDocs()).toEqual([]);
  });
});

describe('migrateLegacyStorage（localStorage → IndexedDB）', () => {
  it('无旧内容：返回 null，并清理残留的旧历史键', async () => {
    ls.setItem('web-text-history', '[]');
    ls.setItem('web-text-pinned', '[]');
    ls.setItem('web-text-theme', 'dark');
    expect(await storage.migrateLegacyStorage('未命名')).toBeNull();
    expect(ls.getItem('web-text-history')).toBeNull();
    expect(ls.getItem('web-text-pinned')).toBeNull();
    // 非迁移键（主题等轻量设置）保留
    expect(ls.getItem('web-text-theme')).toBe('dark');
    expect(await storage.loadDocs()).toEqual([]);
  });

  it('旧内容 + 历史 + 固定版本：建文档、合并历史、删除旧键', async () => {
    ls.setItem('web-text-content', '# legacy');
    ls.setItem(
      'web-text-history',
      JSON.stringify([
        { id: 'h1', content: 'v1', timestamp: 100 },
        { id: 'h2', content: 'v2', timestamp: 200, name: '命名版本' },
      ])
    );
    ls.setItem('web-text-pinned', JSON.stringify([{ id: 'p1', content: 'pinned', timestamp: 50 }]));

    const docId = await storage.migrateLegacyStorage('未命名');
    expect(docId).toEqual(expect.any(String));

    const docs = await storage.loadDocs();
    expect(docs).toHaveLength(1);
    expect(docs[0]).toMatchObject({ id: docId, name: '未命名', content: '# legacy' });

    const history = await storage.loadHistory(docId!);
    expect(history.map((e) => [e.id, e.pinned, e.name])).toEqual([
      ['h2', false, '命名版本'],
      ['h1', false, undefined],
      // 回归：旧 pinned 键里的条目没有 pinned 标记，迁移后也必须是固定版本
      ['p1', true, undefined],
    ]);
    expect(history.every((e) => e.docId === docId)).toBe(true);

    for (const key of ['web-text-content', 'web-text-history', 'web-text-pinned']) {
      expect(ls.getItem(key)).toBeNull();
    }
  });

  it('同一 id 同时在历史与固定列表中：保留固定状态', async () => {
    ls.setItem('web-text-content', 'x');
    ls.setItem('web-text-history', JSON.stringify([{ id: 'dup', content: 'v', timestamp: 1 }]));
    ls.setItem('web-text-pinned', JSON.stringify([{ id: 'dup', content: 'v', timestamp: 1, pinned: true }]));
    const docId = await storage.migrateLegacyStorage('n');
    const history = await storage.loadHistory(docId!);
    expect(history).toHaveLength(1);
    expect(history[0].pinned).toBe(true);
  });

  it('旧历史 JSON 损坏 / 非数组 / 含脏条目时仍能完成迁移', async () => {
    // 回归：'null' / '{}' 曾在展开时抛 TypeError，旧键不被删除，每次打开都会再迁移出一份重复文档
    ls.setItem('web-text-content', 'body');
    ls.setItem('web-text-history', 'null');
    ls.setItem('web-text-pinned', '{"not":"array"}');
    const docId = await storage.migrateLegacyStorage('n');
    expect(docId).not.toBeNull();
    expect(await storage.loadHistory(docId!)).toEqual([]);
    expect(ls.getItem('web-text-content')).toBeNull();

    // 第二次调用不应再建文档
    expect(await storage.migrateLegacyStorage('n')).toBeNull();
    expect(await storage.loadDocs()).toHaveLength(1);
  });

  it('非法 JSON 与缺字段条目：过滤无 id 条目，补默认值', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(4242);
    ls.setItem('web-text-content', '');
    ls.setItem('web-text-history', JSON.stringify([null, { content: 'no id' }, { id: 'ok', content: 7 }]));
    ls.setItem('web-text-pinned', '{broken json');
    const docId = await storage.migrateLegacyStorage('n');
    vi.restoreAllMocks();

    // 空字符串也是有效的旧内容
    expect((await storage.loadDocs())[0].content).toBe('');
    expect(await storage.loadHistory(docId!)).toEqual([
      { id: 'ok', docId, content: '7', timestamp: 4242, pinned: false, name: undefined },
    ]);
  });
});
