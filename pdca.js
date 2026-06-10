const GAS_WEBAPP_URL = 'https://script.google.com/macros/s/AKfycbyTAbaT2TaWPxs05F3pDDKWiAw4bNUYMJHXoEqU8h6xWvaoAhvth3Ms3bv05jP2Zwyl/exec';

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

    // Elements: Tabs
    const modeTabs = document.querySelectorAll('.mode-tab');
    const modeContents = document.querySelectorAll('.mode-content');

    // Elements: Edit/Display Toggle
    const editModeToggle = document.getElementById('editModeToggle');
    const editLabelText = document.getElementById('editLabelText');
    const displayElements = {
        goal: document.getElementById('goalDisplay'),
        plan: document.getElementById('planDisplay'),
        do: document.getElementById('doDisplay'),
        check: document.getElementById('checkDisplay'),
        act: document.getElementById('actDisplay')
    };
    const inputElements = {
        goal: goalInput,
        plan: planInput,
        do: doInput,
        check: checkInput,
        act: actInput
    };
    const actionsContainer = document.querySelector('.actions');

    // Mode Switch Logic
    modeTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            modeTabs.forEach(t => t.classList.remove('active'));
            modeContents.forEach(c => c.classList.remove('active'));
            
            tab.classList.add('active');
            const targetMode = tab.getAttribute('data-mode');
            document.getElementById(targetMode).classList.add('active');
        });
    });

    // Edit Mode Toggle Logic
    const updateEditMode = () => {
        const isEditMode = editModeToggle.checked;
        editLabelText.style.color = isEditMode ? 'var(--primary)' : 'var(--text-color)';
        editLabelText.previousElementSibling.previousElementSibling.style.color = isEditMode ? 'var(--text-color)' : 'var(--primary)';

        for (const key in inputElements) {
            if (isEditMode) {
                inputElements[key].classList.remove('hidden');
                displayElements[key].classList.add('hidden');
            } else {
                inputElements[key].classList.add('hidden');
                displayElements[key].textContent = inputElements[key].value || '（未入力）';
                displayElements[key].classList.remove('hidden');
            }
        }

        addStepBtn.style.display = isEditMode ? 'block' : 'none';
        actionsContainer.style.display = isEditMode ? 'flex' : 'none';
        renderSteps();
    };

    editModeToggle.addEventListener('change', updateEditMode);

    // State
    let roadmapSteps = [
        { text: '', completed: false },
        { text: '', completed: false },
        { text: '', completed: false }
    ];

    // データの読み込み
    const loadData = async () => {
        if (!GAS_WEBAPP_URL || GAS_WEBAPP_URL === 'ここにコピーしたURLを貼り付けます') {
            const localData = JSON.parse(localStorage.getItem('ekworld_pdca_data'));
            if (localData) applyData(localData);
            return;
        }

        try {
            saveBtn.textContent = "読み込み中...";
            saveBtn.disabled = true;
            const response = await fetch(GAS_WEBAPP_URL);
            const data = await response.json();
            if (data && !data.error) {
                applyData(data);
            }
        } catch (error) {
            console.error("データの読み込みに失敗しました", error);
            showToast("読み込み失敗");
        } finally {
            saveBtn.textContent = "保存する！";
            saveBtn.disabled = false;
        }
    };

    const applyData = (pdcaData) => {
        goalInput.value = pdcaData.goal || '';
        planInput.value = pdcaData.plan || '';
        doInput.value = pdcaData.do || '';
        checkInput.value = pdcaData.check || '';
        actInput.value = pdcaData.act || '';
        
        if (pdcaData.roadmap && Array.isArray(pdcaData.roadmap)) {
            roadmapSteps = pdcaData.roadmap;
        }
        renderSteps();
        updateEditMode();
    };

    // 保存処理
    const saveData = async () => {
        updateStepsTextFromDOM();
        
        const pdcaData = {
            goal: goalInput.value,
            plan: planInput.value,
            do: doInput.value,
            check: checkInput.value,
            act: actInput.value,
            roadmap: roadmapSteps
        };

        if (!GAS_WEBAPP_URL || GAS_WEBAPP_URL === 'ここにコピーしたURLを貼り付けます') {
            localStorage.setItem('ekworld_pdca_data', JSON.stringify(pdcaData));
            showToast('保存しました！(ローカル)');
            return;
        }

        try {
            saveBtn.textContent = "保存中...";
            saveBtn.disabled = true;
            const response = await fetch(GAS_WEBAPP_URL, {
                method: 'POST',
                body: JSON.stringify(pdcaData)
            });
            const result = await response.json();
            if (result.success) {
                showToast('保存しました！');
            } else {
                showToast('保存エラー');
            }
        } catch (error) {
            console.error("保存に失敗しました", error);
            showToast('保存失敗');
        } finally {
            saveBtn.textContent = "保存する！";
            saveBtn.disabled = false;
        }
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
        const isEditMode = editModeToggle.checked;
        
        roadmapSteps.forEach((step, index) => {
            const itemDiv = document.createElement('div');
            itemDiv.className = `step-item ${step.completed ? 'completed' : ''}`;
            
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.className = 'step-checkbox';
            checkbox.checked = step.completed;
            checkbox.disabled = !isEditMode;
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
            textInput.readOnly = !isEditMode;
            
            const removeBtn = document.createElement('button');
            removeBtn.className = 'btn-remove-step';
            removeBtn.textContent = '×';
            removeBtn.title = '削除';
            removeBtn.style.display = isEditMode ? 'flex' : 'none';
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
