/**
 * フリップツールの同期API (Netlify Functions + Netlify Blobs)
 *
 *   GET  /api/flip?roomId=xxx           → ルームの状態を返す (なければ null)
 *   POST /api/flip  { roomId, state }   → 保存済みの状態とマージして保存し、マージ結果を返す
 *
 * Netlify上では Blobs の認証が自動で行われるため、APIキー等の設定は不要です。
 */
import { getStore } from '@netlify/blobs';
import FlipMerge from '../../flip_merge.js';

const MAX_ROOM_ID_LENGTH = 30;
const MAX_BODY_BYTES = 100 * 1024;

const json = (data, status = 200) =>
    new Response(JSON.stringify(data), {
        status,
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
    });

function roomKey(roomId) {
    if (typeof roomId !== 'string') return null;
    const id = roomId.trim();
    if (!id || id.length > MAX_ROOM_ID_LENGTH) return null;
    return 'room/' + encodeURIComponent(id);
}

export default async (req) => {
    const store = getStore({ name: 'flip-rooms', consistency: 'strong' });

    if (req.method === 'GET') {
        const key = roomKey(new URL(req.url).searchParams.get('roomId'));
        if (!key) return json({ error: 'invalid roomId' }, 400);
        const state = await store.get(key, { type: 'json' });
        return json(state ?? null);
    }

    if (req.method === 'POST') {
        const text = await req.text();
        if (text.length > MAX_BODY_BYTES) return json({ error: 'too large' }, 413);
        let body;
        try {
            body = JSON.parse(text);
        } catch {
            return json({ error: 'invalid json' }, 400);
        }
        const key = roomKey(body && body.roomId);
        if (!key) return json({ error: 'invalid roomId' }, 400);

        const current = await store.get(key, { type: 'json' });
        const merged = FlipMerge.mergeState(current, body.state);
        await store.setJSON(key, merged);
        return json(merged);
    }

    return json({ error: 'method not allowed' }, 405);
};

export const config = { path: '/api/flip' };
