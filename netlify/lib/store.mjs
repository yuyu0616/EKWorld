/**
 * Netlify Blobs の共通ヘルパー
 */
import { getStore } from '@netlify/blobs';

export const json = (data, status = 200) =>
    new Response(JSON.stringify(data), {
        status,
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
    });

export function openStore(name) {
    return getStore({ name, consistency: 'strong' });
}

export function roomKey(roomId, maxLength = 30) {
    if (typeof roomId !== 'string') return null;
    const id = roomId.trim();
    if (!id || id.length > maxLength) return null;
    return 'room/' + encodeURIComponent(id);
}

export async function readJSON(store, key) {
    return store.get(key, { type: 'json' });
}

/**
 * 読み込み → 変更 → 書き込み を安全に行う。
 * 途中で他の人が書き込んでいたら (ETag不一致) 最初からやり直すので、同時操作でもデータが壊れない。
 * fn(現在の状態 or null) は新しい状態を返す。
 */
export async function atomicUpdate(store, key, fn, retries = 10) {
    for (let i = 0; i < retries; i++) {
        const entry = await store.getWithMetadata(key, { type: 'json' });
        const current = entry ? entry.data : null;
        const next = fn(current === undefined ? null : current);
        const res = entry
            ? await store.setJSON(key, next, { onlyIfMatch: entry.etag })
            : await store.setJSON(key, next, { onlyIfNew: true });
        if (res.modified) return next;
        await new Promise(r => setTimeout(r, 30 + Math.random() * 120));
    }
    throw new Error('too many concurrent updates');
}

export async function readBody(req, maxBytes = 100 * 1024) {
    const text = await req.text();
    if (text.length > maxBytes) return { error: json({ error: 'too large' }, 413) };
    try {
        return { body: JSON.parse(text) };
    } catch {
        return { error: json({ error: 'invalid json' }, 400) };
    }
}
