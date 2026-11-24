/**
 * フリップツールの同期API (Netlify Functions + Netlify Blobs)
 *
 *   GET  /api/flip?roomId=xxx[&since=版]  → { etag, state } を返す (ルームがなければ state: null)
 *                                          since が今の版と同じなら { etag, unchanged: true } だけ返す
 *   POST /api/flip  { roomId, state }     → 保存済みの状態とマージして保存し、{ etag, state } を返す
 *
 * Netlify上では Blobs の認証が自動で行われるため、APIキー等の設定は不要です。
 */
import FlipMerge from '../../flip_merge.js';
import { json, openStore, roomKey, atomicUpdate, readBody } from '../lib/store.mjs';

export default async (req) => {
    const store = openStore('flip-rooms');

    if (req.method === 'GET') {
        const params = new URL(req.url).searchParams;
        const key = roomKey(params.get('roomId'));
        if (!key) return json({ error: 'invalid roomId' }, 400);
        const since = params.get('since');
        if (since) {
            // 版だけ先に確認し、変化がなければ中身を送らない (通信量の節約)
            const meta = await store.getMetadata(key);
            if (meta && meta.etag === since) return json({ etag: since, unchanged: true });
        }
        const entry = await store.getWithMetadata(key, { type: 'json' });
        return json(entry ? { etag: entry.etag || null, state: entry.data } : { etag: null, state: null });
    }

    if (req.method === 'POST') {
        const { body, error } = await readBody(req, 1024 * 1024);
        if (error) return error;
        const key = roomKey(body && body.roomId);
        if (!key) return json({ error: 'invalid roomId' }, 400);
        const { data, etag } = await atomicUpdate(store, key, current => FlipMerge.mergeState(current, body.state));
        return json({ etag, state: data });
    }

    return json({ error: 'method not allowed' }, 405);
};

export const config = { path: '/api/flip' };
