const sizeSelect = document.getElementById('bracket-size');
const container = document.getElementById('participants-container');
const wrapper = document.getElementById('tournament-wrapper');

function renderInputs() {
    const size = parseInt(sizeSelect.value);
    
    // Save current values to prevent loss
    const currentValues = [];
    const existingInputs = container.querySelectorAll('input');
    existingInputs.forEach(input => currentValues.push(input.value));
    
    container.innerHTML = '';
    
    for (let i = 0; i < size; i++) {
        const wrap = document.createElement('div');
        wrap.style.display = 'flex';
        wrap.style.alignItems = 'center';
        wrap.style.gap = '8px';
        
        const label = document.createElement('span');
        label.style.fontWeight = '800';
        label.style.width = '24px';
        label.style.textAlign = 'right';
        label.style.color = 'var(--text-color)';
        label.textContent = (i + 1) + '.';
        
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'modal-input';
        input.style.padding = '8px 12px';
        input.style.flex = '1';
        input.style.fontSize = '16px';
        input.placeholder = '名前 (空欄でBye)';
        input.id = 'participant-' + i;
        
        if (i < currentValues.length) {
            input.value = currentValues[i];
        }
        
        wrap.appendChild(label);
        wrap.appendChild(input);
        container.appendChild(wrap);
    }
}

function shuffleParticipants() {
    const size = parseInt(sizeSelect.value);
    const inputs = [];
    for (let i = 0; i < size; i++) {
        inputs.push(document.getElementById('participant-' + i).value);
    }
    
    // Fisher-Yates shuffle
    for (let i = inputs.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [inputs[i], inputs[j]] = [inputs[j], inputs[i]];
    }
    
    for (let i = 0; i < size; i++) {
        document.getElementById('participant-' + i).value = inputs[i];
    }
}

sizeSelect.addEventListener('change', renderInputs);
window.addEventListener('load', renderInputs);

function generateBracket() {
    const size = parseInt(sizeSelect.value);
    const participants = [];
    for (let i = 0; i < size; i++) {
        const val = document.getElementById('participant-' + i).value.trim();
        participants.push(val);
    }
    
    wrapper.style.display = 'block';
    wrapper.innerHTML = '';
    
    // ヘッダー部分（リセットボタン等）を追加
    const headerDiv = document.createElement('div');
    headerDiv.style.display = 'flex';
    headerDiv.style.justifyContent = 'space-between';
    headerDiv.style.alignItems = 'center';
    headerDiv.style.marginBottom = '20px';
    headerDiv.style.position = 'sticky';
    headerDiv.style.left = '0';
    headerDiv.style.zIndex = '10'; // スクロール時に他の要素より上に表示
    
    const titleH2 = document.createElement('h2');
    titleH2.style.margin = '0';
    titleH2.style.color = 'var(--primary)';
    titleH2.textContent = '試合表';
    
    const resetBtn = document.createElement('button');
    resetBtn.className = 'btn reset-btn';
    resetBtn.style.margin = '0';
    resetBtn.style.padding = '8px 16px';
    resetBtn.style.fontSize = '14px';
    resetBtn.textContent = '🔄 勝敗リセット';
    resetBtn.onclick = generateBracket;
    
    headerDiv.appendChild(titleH2);
    headerDiv.appendChild(resetBtn);
    wrapper.appendChild(headerDiv);
    
    const rounds = Math.log2(size);
    
    const bracketDiv = document.createElement('div');
    bracketDiv.className = 'bracket';
    
    for (let r = 0; r <= rounds; r++) {
        const roundDiv = document.createElement('div');
        roundDiv.className = 'round round-' + r;
        
        // r = rounds の時は優勝者表示のみ
        if (r === rounds) {
            const matchDiv = document.createElement('div');
            matchDiv.className = 'match';
            const topDiv = document.createElement('div');
            topDiv.className = 'match-top';
            const pBox = document.createElement('div');
            pBox.className = 'player-box final-winner';
            pBox.textContent = '優勝🏆';
            topDiv.appendChild(pBox);
            matchDiv.appendChild(topDiv);
            roundDiv.appendChild(matchDiv);
            bracketDiv.appendChild(roundDiv);
            break;
        }

        const numMatches = size / Math.pow(2, r + 1);
        for (let m = 0; m < numMatches; m++) {
            const matchDiv = document.createElement('div');
            matchDiv.className = 'match';
            
            const topDiv = document.createElement('div');
            topDiv.className = 'match-team top';
            const topBox = document.createElement('div');
            topBox.className = 'player-box';
            
            const bottomDiv = document.createElement('div');
            bottomDiv.className = 'match-team bottom';
            const bottomBox = document.createElement('div');
            bottomBox.className = 'player-box';
            
            if (r === 0) {
                // 初回ラウンドは入力された名前を入れる
                const p1 = participants[m * 2] || 'Bye';
                const p2 = participants[m * 2 + 1] || 'Bye';
                
                topBox.textContent = p1;
                bottomBox.textContent = p2;
                
                if (p1 === 'Bye') topBox.classList.add('bye');
                if (p2 === 'Bye') bottomBox.classList.add('bye');
            } else {
                // 2回戦以降は空欄
                topBox.textContent = '';
                bottomBox.textContent = '';
            }
            
            // 勝敗切り替え（クリックしたら色が変わるなど）
            topBox.onclick = () => selectWinner(topBox, bottomBox);
            bottomBox.onclick = () => selectWinner(bottomBox, topBox);
            
            topDiv.appendChild(topBox);
            bottomDiv.appendChild(bottomBox);
            
            matchDiv.appendChild(topDiv);
            matchDiv.appendChild(bottomDiv);
            
            roundDiv.appendChild(matchDiv);
        }
        
        bracketDiv.appendChild(roundDiv);
    }
    
    wrapper.appendChild(bracketDiv);
    
    // Byeの自動進行をシミュレート
    const firstRoundMatches = bracketDiv.querySelectorAll('.round-0 .match');
    firstRoundMatches.forEach(match => {
        const topBox = match.children[0].querySelector('.player-box');
        const bottomBox = match.children[1].querySelector('.player-box');
        const isTopBye = topBox.classList.contains('bye') || topBox.textContent === 'Bye';
        const isBottomBye = bottomBox.classList.contains('bye') || bottomBox.textContent === 'Bye';
        
        if (isBottomBye && !isTopBye) {
            setTimeout(() => selectWinner(topBox, bottomBox), 100);
        } else if (isTopBye && !isBottomBye) {
            setTimeout(() => selectWinner(bottomBox, topBox), 100);
        }
    });
    
    // 少しスクロール
    wrapper.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function selectWinner(winnerBox, loserBox) {
    if (winnerBox.textContent.trim() === '' || winnerBox.classList.contains('bye') || winnerBox.textContent === 'Bye') return;
    
    winnerBox.style.backgroundColor = 'var(--primary)';
    winnerBox.style.color = 'var(--white)';
    winnerBox.style.borderColor = 'var(--primary-dark)';
    winnerBox.style.opacity = '1';
    
    if (loserBox) {
        loserBox.style.backgroundColor = 'var(--white)';
        loserBox.style.color = 'var(--text-color)';
        loserBox.style.borderColor = 'var(--text-color)';
        loserBox.style.opacity = '0.5';
    }
    
    try {
        const teamDiv = winnerBox.parentNode;
        const matchDiv = teamDiv.parentNode;
        const roundDiv = matchDiv.parentNode;
        const bracketDiv = roundDiv.parentNode;
        
        const roundClass = Array.from(roundDiv.classList).find(c => c.startsWith('round-'));
        const rIndex = parseInt(roundClass.split('-')[1]);
        
        const matches = Array.from(roundDiv.children);
        const mIndex = matches.indexOf(matchDiv);
        
        const nextRoundDiv = bracketDiv.querySelector('.round-' + (rIndex + 1));
        if (nextRoundDiv) {
            // 決勝戦ラウンドの場合の処理
            if (nextRoundDiv.children[0].querySelector('.final-winner')) {
                const finalBox = nextRoundDiv.children[0].querySelector('.final-winner');
                finalBox.textContent = '🏆 ' + winnerBox.textContent + ' 🏆';
                finalBox.style.backgroundColor = 'var(--accent)';
                finalBox.style.color = 'var(--text-color)';
                return;
            }

            const nextMatches = Array.from(nextRoundDiv.children);
            const nextMatchIndex = Math.floor(mIndex / 2);
            const isTop = mIndex % 2 === 0;
            
            const nextMatch = nextMatches[nextMatchIndex];
            if (nextMatch) {
                const targetTeamDiv = nextMatch.children[isTop ? 0 : 1];
                const targetBox = targetTeamDiv.querySelector('.player-box');
                targetBox.textContent = winnerBox.textContent;
                targetBox.classList.remove('bye');
                targetBox.style.backgroundColor = '';
                targetBox.style.color = '';
                targetBox.style.borderColor = '';
                targetBox.style.opacity = '1';
                
                // 次の相手が Bye の場合、自動で勝たせる
                const siblingTeamDiv = nextMatch.children[isTop ? 1 : 0];
                if (siblingTeamDiv) {
                    const siblingBox = siblingTeamDiv.querySelector('.player-box');
                    if (siblingBox.classList.contains('bye') || siblingBox.textContent === 'Bye') {
                        setTimeout(() => {
                            selectWinner(targetBox, siblingBox);
                        }, 300);
                    }
                }
            }
        }
    } catch (e) {
        console.error("次の枠への進行エラー", e);
    }
}
