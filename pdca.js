document.addEventListener('DOMContentLoaded', () => {
    // Elements: PDCA
    const goalInput = document.getElementById('goalInput');
    const planInput = document.getElementById('planInput');
    const doInput = document.getElementById('doInput');
    const checkInput = document.getElementById('checkInput');
    const actInput = document.getElementById('actInput');
    
    // Elements: Roadmap
    const stepList = document.getElementById('stepList');
    const addStepBtn = document.getElementById('addStepBtn');
    const progressBar = document.getElementById('progressBar');
    const progressText = document.getElementById('progressText');
    
    // Elements: Actions
    const saveBtn = document.getElementById('saveBtn');
    const clearBtn = document.getElementById('clearBtn');
    const toast = document.getElementById('toast');

    // State
    let roadmapSteps = [
        { text: '', completed: false },
        { text: '', completed: false },
        { text: '', completed: false }
    ];

    // データの読み込み
    const loadData = () => {
        const pdcaData = JSON.parse(localStorage.getItem('ekworld_pdca_data'));
        if (pdcaData) {
            goalInput.value = pdcaData.goal || '';
            planInput.value = pdcaData.plan || '';
            doInput.value = pdcaData.do || '';
            checkInput.value = pdcaData.check || '';
            actInput.value = pdcaData.act || '';
            
            if (pdcaData.roadmap && Array.isArray(pdcaData.roadmap)) {
                roadmapSteps = pdcaData.roadmap;
            }
        }
        renderSteps();
    };

    // 保存処理
    const saveData = () => {
        // 現在のステップテキストを状態に反映
        updateStepsTextFromDOM();
        
        const pdcaData = {
            goal: goalInput.value,
            plan: planInput.value,
            do: doInput.value,
            check: checkInput.value,
            act: actInput.value,
            roadmap: roadmapSteps
        };
        localStorage.setItem('ekworld_pdca_data', JSON.stringify(pdcaData));
        showToast('保存しました！');
    };

    // リセット処理
    const clearData = () => {
        if (confirm('入力内容をリセットしますか？\n（保存されているデータも消去されます）')) {
            localStorage.removeItem('ekworld_pdca_data');
            goalInput.value = '';
            planInput.value = '';
            doInput.value = '';
            checkInput.value = '';
            actInput.value = '';
            
            roadmapSteps = [
                { text: '', completed: false },
                { text: '', completed: false },
                { text: '', completed: false }
            ];
            renderSteps();
            showToast('リセットしました');
        }
    };

    // トースト通知を表示する関数
    const showToast = (message) => {
        toast.textContent = message;
        toast.classList.add('show');
        setTimeout(() => {
            toast.classList.remove('show');
        }, 3000);
    };

    // Roadmap Functions
    const renderSteps = () => {
        stepList.innerHTML = '';
        
        roadmapSteps.forEach((step, index) => {
            const itemDiv = document.createElement('div');
            itemDiv.className = `step-item ${step.completed ? 'completed' : ''}`;
            
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.className = 'step-checkbox';
            checkbox.checked = step.completed;
            checkbox.addEventListener('change', (e) => {
                updateStepsTextFromDOM();
                roadmapSteps[index].completed = e.target.checked;
                renderSteps(); // 再描画してスタイルとプログレスを更新
            });
            
            const textInput = document.createElement('input');
            textInput.type = 'text';
            textInput.className = 'step-input';
            textInput.placeholder = `ステップ ${index + 1}`;
            textInput.value = step.text;
            
            const removeBtn = document.createElement('button');
            removeBtn.className = 'btn-remove-step';
            removeBtn.textContent = '×';
            removeBtn.title = '削除';
            removeBtn.addEventListener('click', () => {
                updateStepsTextFromDOM();
                roadmapSteps.splice(index, 1);
                renderSteps();
            });
            
            itemDiv.appendChild(checkbox);
            itemDiv.appendChild(textInput);
            itemDiv.appendChild(removeBtn);
            
            stepList.appendChild(itemDiv);
        });
        
        updateProgress();
    };

    const updateStepsTextFromDOM = () => {
        const inputs = stepList.querySelectorAll('.step-input');
        inputs.forEach((input, index) => {
            if (roadmapSteps[index]) {
                roadmapSteps[index].text = input.value;
            }
        });
    };

    const updateProgress = () => {
        if (roadmapSteps.length === 0) {
            progressBar.style.width = '0%';
            progressText.textContent = '0%';
            return;
        }
        
        const completedCount = roadmapSteps.filter(s => s.completed).length;
        const percentage = Math.round((completedCount / roadmapSteps.length) * 100);
        
        progressBar.style.width = `${percentage}%`;
        progressText.textContent = `${percentage}%`;
        
        // 色の変更
        if (percentage === 100) {
            progressBar.style.backgroundColor = '#4caf50'; // green when 100%
            progressText.style.color = '#4caf50';
        } else {
            progressBar.style.backgroundColor = 'var(--primary)';
            progressText.style.color = 'var(--primary)';
        }
    };

    // イベントリスナーの登録
    saveBtn.addEventListener('click', saveData);
    clearBtn.addEventListener('click', clearData);
    
    addStepBtn.addEventListener('click', () => {
        updateStepsTextFromDOM();
        roadmapSteps.push({ text: '', completed: false });
        renderSteps();
    });

    // 初期化時にデータを読み込む
    loadData();
});
