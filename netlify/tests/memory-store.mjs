// tiny fake of a Netlify Blobs store with etags and conditional writes
export function memoryStore() {
  const data = new Map();
  let version = 0;
  const put = (key, value, opts = {}) => {
    const cur = data.get(key);
    if (opts.onlyIfNew && cur) return { modified: false };
    if (opts.onlyIfMatch && (!cur || cur.etag !== opts.onlyIfMatch)) return { modified: false };
    const etag = `v${++version}`;
    data.set(key, { value: structuredClone(value), etag, metadata: opts.metadata || {} });
    return { modified: true, etag };
  };
  return {
    async get(key) {
      return data.has(key) ? structuredClone(data.get(key).value) : null;
    },
    async getWithMetadata(key) {
      if (!data.has(key)) return null;
      const e = data.get(key);
      return { data: structuredClone(e.value), etag: e.etag, metadata: e.metadata };
    },
    async setJSON(key, value, opts) {
      return put(key, value, opts);
    },
    async set(key, value, opts) {
      return put(key, value, opts);
    },
    async getMetadata(key) {
      if (!data.has(key)) return null;
      const e = data.get(key);
      return { etag: e.etag, metadata: e.metadata };
    },
    async list({ prefix = '' } = {}) {
      return { blobs: [...data.keys()].filter((k) => k.startsWith(prefix)).map((key) => ({ key, etag: data.get(key).etag })) };
    },
    async delete(key) {
      data.delete(key);
    },
    _data: data,
  };
}
