// pokemon.js - State management and logic for Pokemon Stream Overlay Tool

const bc = new BroadcastChannel('pokemon_overlay_channel');
const STORAGE_KEY = 'ekworld_pokemon_overlay_data';

// データを取得（localStorage優先、なければ current_state.js から読み込み）
function getData() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
            return JSON.parse(raw);
        }
    } catch(e) {
        console.error("Failed to read from localStorage", e);
    }

    if (typeof currentBattleState !== 'undefined') {
        // Deep copy
        return JSON.parse(JSON.stringify(currentBattleState));
    }
    console.error("currentBattleState is not defined! Please check current_state.js");
    return {};
}

// データを保存・送信 (LocalStorage + BroadcastChannel)
function sendData(data) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch(e) {
        console.error("Failed to save to localStorage", e);
    }
    bc.postMessage(data);
}

// データをリセット
function resetData() {
    if(confirm("画面表示を初期状態(current_state.jsの内容)に戻しますか？")) {
        localStorage.removeItem(STORAGE_KEY);
        location.reload();
    }
}


/* =========================================================
   CONTROL PANEL LOGIC
   ========================================================= */
function initControlPanel() {
    const data = getData();

    // 単純なテキストフィールドのバインド
    const bindText = (id, key) => {
        const el = document.getElementById(id);
        if(!el) return;
        el.value = data[key] || "";
        el.addEventListener('input', (e) => {
            data[key] = e.target.value;
            sendData(data);
        });
    };

    bindText('ctrl-title', 'title');
    bindText('ctrl-rule', 'rule');
    bindText('ctrl-rate', 'rate');
    bindText('ctrl-telop', 'telop');
    bindText('ctrl-damage-calc', 'damageCalc');
    bindText('ctrl-memo', 'memo');

    // ガイド表示チェックボックス
    const guideCb = document.getElementById('ctrl-show-guide');
    if (guideCb) {
        guideCb.checked = data.showGuide !== false;
        guideCb.addEventListener('change', (e) => {
            data.showGuide = e.target.checked;
            sendData(data);
        });
    }

    // パーティ入力フォームの生成
    const renderPartyForms = (containerId, partyData, side) => {
        const container = document.getElementById(containerId);
        if(!container) return;
        container.innerHTML = '';

        partyData.forEach((poke, index) => {
            const slot = document.createElement('div');
            slot.className = 'party-edit-slot';
            
            // 選出チェックボックス
            const selectedHtml = `<label class="checkbox-label" style="justify-content: center; margin-bottom: 8px;">
                <input type="checkbox" id="sel-${side}-${index}" ${poke.selected ? 'checked' : ''}> 🌟 選出する
            </label>`;

            // 名前
            const nameHtml = `<div class="form-group" style="margin-bottom: 5px;">
                <div class="autocomplete-wrapper" id="ac-wrap-${side}-${index}">
                    <input type="text" id="name-${side}-${index}" class="form-control" autocomplete="off" placeholder="ポケモン名" value="${poke.name}">
                    <div class="autocomplete-list" id="ac-list-${side}-${index}"></div>
                </div>
            </div>`;

            // もちもの
            const itemHtml = `<div class="form-group" style="margin-bottom: 5px;">
                <div class="autocomplete-wrapper" id="item-ac-wrap-${side}-${index}">
                    <input type="text" id="item-${side}-${index}" class="form-control" autocomplete="off" placeholder="もちもの" value="${poke.itemName || ''}" style="font-size: 14px;">
                    <div class="autocomplete-list" id="item-ac-list-${side}-${index}"></div>
                </div>
            </div>`;

            slot.innerHTML = `<h3>枠 ${index + 1}</h3>` + selectedHtml + nameHtml + itemHtml;
            container.appendChild(slot);

            // イベントリスナー登録
            document.getElementById(`sel-${side}-${index}`).addEventListener('change', e => {
                poke.selected = e.target.checked;
                slot.classList.toggle('active', poke.selected);
                sendData(data);
            });
            // 初期状態のactiveクラス
            if(poke.selected) slot.classList.add('active');

            const nameInput = document.getElementById(`name-${side}-${index}`);
            const listContainer = document.getElementById(`ac-list-${side}-${index}`);

            const updateSuggest = (query) => {
                if (!query || typeof pokemonDatabase === 'undefined') {
                    listContainer.innerHTML = '';
                    return;
                }
                const q = query.toLowerCase();
                const filtered = pokemonDatabase.filter(p => 
                    p.name.toLowerCase().includes(q) || 
                    p.types.some(t => t.includes(q))
                );
                
                listContainer.innerHTML = '';
                filtered.slice(0, 10).forEach(p => {
                    const item = document.createElement('div');
                    item.className = 'autocomplete-item';
                    item.innerHTML = `
                        <img src="${p.imageUrl}" class="autocomplete-icon" onerror="this.style.display='none'">
                        <div style="flex:1; line-height: 1.2;">
                            <div style="font-weight:bold; font-size: 14px;">${p.name}</div>
                            <div style="margin-top: 2px;">${p.types.map(t => `<span class="autocomplete-type">${t}</span>`).join(' ')}</div>
                        </div>
                    `;
                    item.addEventListener('click', () => {
                        poke.name = p.name;
                        poke.imageUrl = p.imageUrl;
                        nameInput.value = p.name;
                        sendData(data);
                        listContainer.innerHTML = '';
                    });
                    listContainer.appendChild(item);
                });
            };

            nameInput.addEventListener('input', e => {
                poke.name = e.target.value;
                sendData(data);
                updateSuggest(e.target.value);
            });
            nameInput.addEventListener('blur', () => {
                setTimeout(() => { listContainer.innerHTML = ''; }, 200);
            });
            nameInput.addEventListener('focus', e => {
                updateSuggest(e.target.value);
            });

            // もちものサジェストロジック
            const itemInput = document.getElementById(`item-${side}-${index}`);
            const itemListContainer = document.getElementById(`item-ac-list-${side}-${index}`);

            const updateItemSuggest = (query) => {
                if (!query || typeof itemDatabase === 'undefined') {
                    itemListContainer.innerHTML = '';
                    return;
                }
                const q = query.toLowerCase();
                const filtered = itemDatabase.filter(i => i.name.toLowerCase().includes(q));
                
                itemListContainer.innerHTML = '';
                filtered.slice(0, 10).forEach(i => {
                    const item = document.createElement('div');
                    item.className = 'autocomplete-item';
                    item.innerHTML = `
                        <img src="${i.imageUrl}" class="autocomplete-icon" onerror="this.style.display='none'">
                        <div style="flex:1; line-height: 1.2;">
                            <div style="font-weight:bold; font-size: 14px;">${i.name}</div>
                        </div>
                    `;
                    item.addEventListener('click', () => {
                        poke.itemName = i.name;
                        poke.itemImageUrl = i.imageUrl;
                        itemInput.value = i.name;
                        sendData(data);
                        itemListContainer.innerHTML = '';
                    });
                    itemListContainer.appendChild(item);
                });
            };

            itemInput.addEventListener('input', e => {
                poke.itemName = e.target.value;
                sendData(data);
                updateItemSuggest(e.target.value);
            });
            itemInput.addEventListener('blur', () => {
                setTimeout(() => { itemListContainer.innerHTML = ''; }, 200);
            });
            itemInput.addEventListener('focus', e => {
                updateItemSuggest(e.target.value);
            });
        });
    };

    renderPartyForms('ctrl-party-left-container', data.partyLeft, 'left');
    renderPartyForms('ctrl-party-right-container', data.partyRight, 'right');
}

/* =========================================================
   OVERLAY LOGIC
   ========================================================= */
function initOverlay() {
    updateOverlay(getData());

    // コントロールパネルからBroadcastChannel経由でメッセージを受け取る
    bc.onmessage = (event) => {
        if(event.data) {
            updateOverlay(event.data);
        }
    };
}

function updateOverlay(data) {
    // テキスト要素の更新
    const setText = (id, text) => {
        const el = document.getElementById(id);
        if(el) {
            // 改行を<br>に変換して表示する（メモなど）
            el.innerHTML = (text || "").replace(/\n/g, '<br>');
        }
    };

    setText('ov-title', data.title);
    setText('ov-rule', data.rule);
    setText('ov-rate', data.rate);
    setText('ov-telop', data.telop);
    setText('ov-damage-calc', data.damageCalc);
    setText('ov-memo', data.memo);

    // ガイドラインの表示・非表示
    const showGuide = data.showGuide !== false;
    const mainGuide = document.getElementById('ov-main-guide');
    if(mainGuide) {
        mainGuide.style.display = showGuide ? 'block' : 'none';
        mainGuide.parentElement.style.border = showGuide ? '4px dashed rgba(0,0,0,0.1)' : 'none';
    }
    const camGuide = document.getElementById('ov-camera-guide');
    if(camGuide) {
        camGuide.style.display = showGuide ? 'flex' : 'none';
        camGuide.parentElement.style.backgroundColor = showGuide ? '#fff3e0' : 'transparent';
        if(!showGuide) {
            camGuide.parentElement.style.boxShadow = 'none';
            camGuide.parentElement.style.border = 'none';
        } else {
            camGuide.parentElement.style.boxShadow = '6px 6px 0px rgba(0, 0, 0, 0.2)';
            camGuide.parentElement.style.border = '4px solid var(--border-color)';
        }
    }

    // パーティの描画
    const renderParty = (containerId, partyData) => {
        const container = document.getElementById(containerId);
        if(!container) return;
        
        container.innerHTML = '';
        partyData.forEach((poke, index) => {
            const slot = document.createElement('div');
            slot.className = `pokemon-slot ${poke.selected ? 'selected' : ''}`;
            
            const bgStyle = poke.imageUrl ? `style="background-image: url('${poke.imageUrl}'); background-size: cover; background-position: center;"` : '';
            const itemBgStyle = poke.itemImageUrl ? `style="background-image: url('${poke.itemImageUrl}'); background-size: contain; background-position: center; background-repeat: no-repeat;"` : '';
            const itemNameHtml = poke.itemName ? `<div class="poke-item-name">${poke.itemName}</div>` : '';

            slot.innerHTML = `
                <div class="poke-num">${index + 1}</div>
                <div class="poke-icon-container">
                    <div class="poke-icon" ${bgStyle}></div>
                    <div class="item-icon" ${itemBgStyle}></div>
                </div>
                <div class="poke-info">
                    <div class="poke-name">${poke.name || '???'}</div>
                    ${itemNameHtml}
                </div>
            `;
            container.appendChild(slot);
        });
    };

    renderParty('ov-party-left', data.partyLeft);
    renderParty('ov-party-right', data.partyRight);
}
