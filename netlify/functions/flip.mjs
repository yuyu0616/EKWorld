/**
 * フリップツールの同期API (Netlify Functions + Netlify Blobs)
 *
 *   GET  /api/flip?roomId=xxx           → ルームの状態を返す (なければ null)
 *   POST /api/flip  { roomId, state }   → 保存済みの状態とマージして保存し、マージ結果を返す
 *
 * Netlify上では Blobs の認証が自動で行われるため、APIキー等の設定は不要です。
 */
import FlipMerge from '../../flip_merge.js';
import { json, openStore, roomKey, readJSON, atomicUpdate, readBody } from '../lib/store.mjs';

export default async (req) => {
    const store = openStore('flip-rooms');

    if (req.method === 'GET') {
        const key = roomKey(new URL(req.url).searchParams.get('roomId'));
        if (!key) return json({ error: 'invalid roomId' }, 400);
        return json((await readJSON(store, key)) ?? null);
    }

    if (req.method === 'POST') {
        const { body, error } = await readBody(req);
        if (error) return error;
        const key = roomKey(body && body.roomId);
        if (!key) return json({ error: 'invalid roomId' }, 400);
        const merged = await atomicUpdate(store, key, current => FlipMerge.mergeState(current, body.state));
        return json(merged);
    }

    return json({ error: 'method not allowed' }, 405);
};

export const config = { path: '/api/flip' };
