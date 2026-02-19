document.addEventListener('DOMContentLoaded', async () => {
    // Views
    const viewList = document.getElementById('view-list');
    const viewForm = document.getElementById('view-form');

    // UI Elements
    const rulesContainer = document.getElementById('rules-container');
    const addBtn = document.getElementById('add-btn');
    const backBtn = document.getElementById('back-btn');
    const cancelBtn = document.getElementById('cancel-btn');
    const saveBtn = document.getElementById('save-btn');
    const autofillBtn = document.getElementById('autofill-btn');
    const testBtn = document.getElementById('test-btn');
    const formTitle = document.getElementById('form-title');
    const autoRefreshCheck = document.getElementById('auto-refresh-check');

    // Inputs
    const nameInput = document.getElementById('rule-name');
    const patternInput = document.getElementById('rule-pattern');
    const selectorInput = document.getElementById('rule-selector');
    const cleanInput = document.getElementById('rule-clean');

    // State
    let rules = [];
    let editingIndex = -1; // -1 = Add Mode, >=0 = Edit Mode

    // --- VIEW MANAGEMENT ---
    function showList() {
        viewForm.classList.add('hidden');
        viewForm.classList.remove('active');

        viewList.classList.remove('hidden');
        viewList.classList.add('active');

        renderRules();
    }

    function showForm(index = -1) {
        editingIndex = index;

        // Reset or Fill Form
        if (index >= 0) {
            const rule = rules[index];
            formTitle.textContent = 'Edit Rule';
            nameInput.value = rule.name;
            patternInput.value = rule.urlPattern;
            selectorInput.value = rule.selector;
            cleanInput.value = rule.cleanPattern || '';
        } else {
            formTitle.textContent = 'Add New Rule';
            nameInput.value = '';
            patternInput.value = '';
            selectorInput.value = '';
            cleanInput.value = '';
        }

        // Switch View
        viewList.classList.add('hidden');
        viewList.classList.remove('active');

        viewForm.classList.remove('hidden');
        viewForm.classList.add('active');
    }

    // --- DATA OPERATIONS ---
    async function loadRules() {
        try {
            const result = await browser.storage.local.get("rules");
            rules = (result.rules && Array.isArray(result.rules)) ? result.rules : [];
        } catch (e) {
            console.error("[AutoTabRenamer] Storage error:", e);
            rules = [];
        }
        renderRules();
    }

    async function saveRules() {
        try {
            await browser.storage.local.set({ rules: rules });
        } catch (e) {
            console.error("[AutoTabRenamer] Save error:", e);
        }
    }

    function renderRules() {
        rulesContainer.innerHTML = '';

        if (rules.length === 0) {
            rulesContainer.innerHTML = `
                <div class="empty-state">
                    No rules defined yet.<br>
                    Click the "Add Rule" button to create one for the current site.
                </div>
            `;
            return;
        }

        rules.forEach((rule, index) => {
            const card = document.createElement('div');
            card.className = 'rule-card';
            card.innerHTML = `
                <div class="rule-info">
                    <span class="rule-name">${escapeHtml(rule.name)}</span>
                    <span class="rule-detail">${escapeHtml(rule.urlPattern)}</span>
                </div>
                <div class="rule-actions">
                    <button class="action-btn edit" data-index="${index}" title="Edit">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                    </button>
                    <button class="action-btn delete" data-index="${index}" title="Delete">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                    </button>
                </div>
            `;
            rulesContainer.appendChild(card);
        });

        // Bind events
        document.querySelectorAll('.action-btn.edit').forEach(btn => {
            btn.addEventListener('click', (e) => showForm(parseInt(e.currentTarget.dataset.index)));
        });
        document.querySelectorAll('.action-btn.delete').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const idx = parseInt(e.currentTarget.dataset.index);
                if (confirm('Delete this rule?')) {
                    rules.splice(idx, 1);
                    await saveRules();
                    renderRules();
                }
            });
        });
    }

    // --- LOGIC ---
    // AI_CONTEXT: Auto-fill logic from current tab
    async function handleAutoFill() {
        try {
            const tabs = await browser.tabs.query({ active: true, currentWindow: true });
            if (tabs.length === 0) return;

            const tab = tabs[0];
            const url = new URL(tab.url);

            // Intelligence for naming
            let name = tab.title || url.hostname;
            // Clean common suffixes
            name = name.replace(/ - .*$/, '').replace(/ \| .*$/, '').trim();
            if (name.length > 25) name = url.hostname;

            nameInput.value = name;
            patternInput.value = url.hostname.replace(/\./g, '\\.');

            // Visual Feedback
            const originalText = autofillBtn.innerHTML;
            autofillBtn.innerHTML = '✅ Auto-filled!';
            setTimeout(() => { autofillBtn.innerHTML = originalText; }, 1500);

        } catch (e) {
            console.error("Autofill error", e);
        }
    }

    async function handleTestSelector() {
        const selector = selectorInput.value.trim();
        if (!selector) { alert('Enter a selector first'); return; }

        try {
            const tabs = await browser.tabs.query({ active: true, currentWindow: true });
            if (tabs[0].url.startsWith('chrome') || tabs[0].url.startsWith('about')) {
                alert('Cannot test on system pages'); return;
            }

            const results = await browser.scripting.executeScript({
                target: { tabId: tabs[0].id },
                func: (sel) => {
                    const el = document.querySelector(sel);
                    return el ? { found: true, text: el.innerText.trim(), tag: el.tagName } : { found: false };
                },
                args: [selector]
            });

            const res = results[0].result;
            if (res.found) {
                alert(`✅ FOUND: <${res.tag}>\nContent: "${res.text.substring(0, 50)}..."`);
            } else {
                alert('❌ Not found');
            }
        } catch (e) {
            alert('Error: ' + e.message);
        }
    }

    async function handleSave() {
        const name = nameInput.value.trim();
        const pattern = patternInput.value.trim();
        const selector = selectorInput.value.trim();

        if (!name || !pattern || !selector) {
            alert('Name, URL Pattern, and Selector are required.');
            return;
        }

        const newRule = {
            name,
            urlPattern: pattern,
            selector,
            cleanPattern: cleanInput.value.trim()
        };

        if (editingIndex >= 0) {
            rules[editingIndex] = newRule;
        } else {
            rules.push(newRule);
        }

        await saveRules();

        // AI_CONTEXT: Auto-refresh logic
        // WHY: Users want to see the new rule applied immediately
        if (autoRefreshCheck.checked) {
            browser.tabs.reload(); // Reload active tab
        }

        showList();
    }

    // --- EVENT LISTENERS ---
    addBtn.addEventListener('click', () => showForm(-1));
    backBtn.addEventListener('click', showList);
    cancelBtn.addEventListener('click', showList);

    autofillBtn.addEventListener('click', handleAutoFill);
    testBtn.addEventListener('click', handleTestSelector);
    saveBtn.addEventListener('click', handleSave);

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text || '';
        return div.innerHTML;
    }

    // Init
    loadRules();
});
