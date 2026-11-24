/**
 * ito (イト) の同期API (Netlify Functions + Netlify Blobs)
 *
 *   GET  /api/ito?roomId=xxx                     → ルームの状態を返す (なければ null)
 *   POST /api/ito { roomId, action, ... }        → 操作を実行し、新しい状態を返す
 *     action: 'join'  { name }    入室 (ルームがなければ作成)
 *             'start' { theme }   カードを配ってゲーム開始
 *             'play'  { name }    カードを場に出す (判定はサーバーで実施)
 *             'reset'             待機室に戻る
 *
 * ゲームの判定をサーバー側でまとめて行うので、同時にカードを出しても状態が食い違いません。
 */
import { json, openStore, roomKey, readJSON, atomicUpdate, readBody } from '../lib/store.mjs';

const MAX_NAME_LENGTH = 20;
const MAX_THEME_LENGTH = 100;

class ActionError extends Error {}

function newPlayer(name) {
    return { name, card: 0, played: false, playOrder: 0 };
}

function shuffledNumbers() {
    const numbers = Array.from({ length: 100 }, (_, i) => i + 1);
    for (let i = numbers.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [numbers[i], numbers[j]] = [numbers[j], numbers[i]];
    }
    return numbers;
}

const actions = {
    join(state, { name }) {
        name = typeof name === 'string' ? name.trim() : '';
        if (!name || name.length > MAX_NAME_LENGTH) throw new ActionError('invalid name');
        if (!state) {
            return { phase: 'waiting', theme: '', players: [newPlayer(name)], mistakes: 0 };
        }
        if (!state.players.find(p => p.name === name)) {
            state.players.push(newPlayer(name));
        }
        return state;
    },

    start(state, { theme }) {
        if (!state) throw new ActionError('room not found');
        theme = typeof theme === 'string' ? theme.trim() : '';
        if (!theme || theme.length > MAX_THEME_LENGTH) throw new ActionError('invalid theme');
        const numbers = shuffledNumbers();
        state.players.forEach((p, i) => {
            p.card = numbers[i];
            p.played = false;
            p.playOrder = 0;
        });
        state.theme = theme;
        state.phase = 'playing';
        state.mistakes = 0;
        return state;
    },

    play(state, { name }) {
        if (!state) throw new ActionError('room not found');
        const me = state.players.find(p => p.name === name);
        if (!me || me.played || state.phase !== 'playing') return state;

        // 他の人の手札に、これより小さい数字がないかチェック
        const smaller = state.players.filter(p => !p.played && p.card < me.card);
        let order = state.players.reduce((max, p) => Math.max(max, p.playOrder || 0), 0) + 1;
        if (smaller.length > 0) {
            state.mistakes = (state.mistakes || 0) + 1;
            // 小さいカードは強制オープン
            smaller.sort((a, b) => a.card - b.card).forEach(p => {
                p.played = true;
                p.playOrder = order++;
            });
        }
        me.played = true;
        me.playOrder = order;

        if (state.players.every(p => p.played)) state.phase = 'result';
        return state;
    },

    reset(state) {
        if (!state) throw new ActionError('room not found');
        state.phase = 'waiting';
        state.theme = '';
        state.mistakes = 0;
        state.players.forEach(p => {
            p.card = 0;
            p.played = false;
            p.playOrder = 0;
        });
        return state;
    }
};

export default async (req) => {
    const store = openStore('ito-rooms');

    if (req.method === 'GET') {
        const key = roomKey(new URL(req.url).searchParams.get('roomId'));
        if (!key) return json({ error: 'invalid roomId' }, 400);
        return json((await readJSON(store, key)) ?? null);
    }

    if (req.method === 'POST') {
        const { body, error } = await readBody(req, 10 * 1024);
        if (error) return error;
        const key = roomKey(body && body.roomId);
        if (!key) return json({ error: 'invalid roomId' }, 400);
        const action = actions[body.action];
        if (!action) return json({ error: 'invalid action' }, 400);
        try {
            const state = await atomicUpdate(store, key, current => action(current, body));
            return json(state);
        } catch (e) {
            if (e instanceof ActionError) return json({ error: e.message }, 400);
            throw e;
        }
    }

    return json({ error: 'method not allowed' }, 405);
};

export const config = { path: '/api/ito' };
