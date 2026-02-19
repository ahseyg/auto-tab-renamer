// content.js - Cross-browser version

let rules = [];
let activeRule = null;
let debounceTimer = null;
let isRenaming = false; // Flag to prevent infinite loops when we change the title

// Default rules to get started (will be merged/overridden by storage)
const DEFAULT_RULES = [
    {
        name: "ChatGPT",
        urlPattern: "chatgpt\\.com",
        selector: "[data-testid='conversation-title']", // Top bar title
        cleanPattern: "",
    },
    {
        name: "Google Gemini",
        urlPattern: "gemini\\.google\\.com",
        selector: ".gds-title-m.ng-star-inserted", // Updated specific selector
        cleanPattern: "Gemini",
    }
];

// Initialize
(async () => {
    await loadRules();
    detectActiveRule();
    if (activeRule) {
        console.log("[AutoTabRenamer] Active rule found:", activeRule.name);
        startObserving();
        // Initial attempt
        attemptRename();
    }
})();

async function loadRules() {
    try {
        const stored = await browser.storage.local.get("rules");
        if (stored.rules && stored.rules.length > 0) {
            rules = stored.rules;
        } else {
            rules = DEFAULT_RULES;
            await browser.storage.local.set({ rules: DEFAULT_RULES });
        }
    } catch (e) {
        console.error("[AutoTabRenamer] Failed to load rules", e);
        rules = DEFAULT_RULES;
    }
}

function detectActiveRule() {
    const currentUrl = window.location.href;
    activeRule = rules.find(r => new RegExp(r.urlPattern, 'i').test(currentUrl));
}

function startObserving() {
    // Observe DOM for the selector appearance/change
    const observer = new MutationObserver((mutations) => {
        // Debounce the rename attempt
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            attemptRename();
        }, 1000); // 1-second debounce (performance)
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true,
        characterData: true
    });

    // Also watch for URL changes (SPA navigation)
    let lastUrl = location.href;
    new MutationObserver(() => {
        const url = location.href;
        if (url !== lastUrl) {
            lastUrl = url;
            console.log("[AutoTabRenamer] URL changed, re-detecting rules...");
            detectActiveRule();
            attemptRename();
        }
    }).observe(document, { subtree: true, childList: true });
}

function attemptRename() {
    if (!activeRule) return;
    if (isRenaming) return;

    // AI_CONTEXT: Fix for Gemini "New Chat" page
    // WHY: On the blank /app page, selectors often grab the top history item from sidebar
    // SIDE_EFFECT: Leaves the title as "Google Gemini" (or whatever the site default is)
    if (window.location.hostname.includes("gemini.google.com") &&
        (window.location.pathname === "/app" || window.location.pathname === "/app/")) {
        return;
    }


    try {
        // AI_CONTEXT: Smart Selector Logic
        // WHY: Many sites (Gemini, ChatGPT) reuse classes in the sidebar/history. 
        // We want the MAIN title, not the sidebar items.
        // STRATEGY: If the first match is inside a <nav> or <aside>, look for a match that isn't.
        let targetElement = document.querySelector(activeRule.selector);

        if (targetElement && (targetElement.closest('nav') || targetElement.closest('aside') || targetElement.closest('[role="navigation"]'))) {
            const allMatches = document.querySelectorAll(activeRule.selector);
            for (const el of allMatches) {
                // Skip elements in navigation areas
                if (!el.closest('nav') && !el.closest('aside') && !el.closest('[role="navigation"]')) {
                    targetElement = el;
                    break;
                }
            }
        }

        if (targetElement) {
            let newTitle = targetElement.innerText.trim();

            // Clean up
            if (activeRule.cleanPattern) {
                try {
                    const regex = new RegExp(activeRule.cleanPattern, 'gi');
                    newTitle = newTitle.replace(regex, '').trim();
                } catch (e) {
                    console.warn("Invalid clean regex", e);
                }
            }

            // Zen Browser Optimization: Truncate
            // Vertical tabs need shorter titles. ~20-30 chars.
            const MAX_LENGTH = 25;
            if (newTitle.length > MAX_LENGTH) {
                newTitle = newTitle.substring(0, MAX_LENGTH) + "…";
            }

            if (newTitle && document.title !== newTitle) {
                console.log(`[AutoTabRenamer] Renaming tab from '${document.title}' to '${newTitle}'`);
                isRenaming = true;
                document.title = newTitle;
                setTimeout(() => { isRenaming = false; }, 100); // unlock after short delay
            }
        }
    } catch (e) {
        console.error("[AutoTabRenamer] Error renaming:", e);
    }
}
