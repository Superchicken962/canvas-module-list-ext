chrome.runtime.onMessage.addListener((msg, sender, reply) => {
    switch(msg.subject) {
        case "checkCanvasDetection":
            const status = isCanvasSite();
            reply({ success: true, canvasDetected: status });
            break;

        case "addToCanvasInclusion":
            localStorage.removeItem("cml:isCanvas:excluded");
            localStorage.setItem("cml:isCanvas:included", true);
            reply({ success: true });
            break;

        case "addToCanvasExclusion":
            localStorage.removeItem("cml:isCanvas:included");
            localStorage.setItem("cml:isCanvas:excluded", true);
            reply({ success: true });
            break;

        case "reloadPage":
            setTimeout(() => {
                window.location.reload();
            }, 50);
            reply({ success: true });
            break;

        default:
            reply({ success: false });
    }
    
    return true;
});

/**
 * @typedef { Object } Module
 * @property { String } title
 * @property { ModuleItem[] } items
 * @property { Number } order
 */

/**
 * @typedef { Object } ModuleItem
 * @property { String } title
 * @property { Boolean } isSubHeader - Is this item a sub header?
 * @property { String? } subHeader - Sub header this item is under, if under any.
 * @property { String? } url - URL to item page (if it has one).
 */

/**
 * Scrape modules from list on course modules page. Must be done from modules page.
 * 
 * @returns { Module[] }
 */
function scrapeCourseModules() {
    const modules = {};
    const moduleEls = document.querySelectorAll(".context_module");

    for (let i = 0; i < moduleEls.length; i++) {
        const module = moduleEls[i];

        const moduleName = module.getAttribute("aria-label");
        if (!moduleName) continue;

        const items = module.querySelectorAll(".context_module_items li");
        let lastSubHeader = null;

        const modData = {
            title: moduleName,
            items: [],
            order: i
        }

        for (const item of items) {
            const isSubHeader = item.classList.contains("context_module_sub_header");

            if (isSubHeader) {
                const subHeaderTitle = item.querySelector(".module-item-title .item_name .title.locked_title").textContent.trim();
                lastSubHeader = subHeaderTitle;
                modData.items.push({
                    isSubHeader,
                    title: subHeaderTitle
                });
                continue;
            }

            // If item is not indented, then remove sub header association.
            if (item.classList.contains("indent_0")) {
                lastSubHeader = null;
            }

            const titleEl = item.querySelector(".module-item-title .item_name .ig-title.title.item_link");
            if (!titleEl) continue;

            const itemName = titleEl.textContent.trim();
            const itemUrl = titleEl.href;

            modData.items.push({
                isSubHeader,
                subHeader: lastSubHeader,
                title: itemName,
                url: itemUrl
            });
        }

        modules[moduleName] = modData;
    }

    return Object.values(modules).sort((a,b) => a.order - b.order);
}

/**
 * Add modules to page.
 * 
 * @param { Module[] } modules 
 */
function addToPage(modules) {
    const modulesLink = document.querySelector("#modules-link");
    if (!modulesLink) return;

    const baseClone = modulesLink.cloneNode(true);
    
    /**
     * Create link element.
     * 
     * @param { String } name Name / titlee
     * @param { String } url - Url / href
     * @param { Number } indentLevel - Level of indent - >1 increments margin-left by 15px
     * @returns { HTMLElement }
     */
    const createLink = (name, url, indentLevel = 0) => {
        const el = baseClone.cloneNode(true);
        el.classList.remove("active", "selectedModulePageItem");
        el.classList.add("customModuleItem");
        el.style.marginLeft = `${indentLevel * 15}px`;

        // Highlight the page is it is the one we have open.
        const idFromUrl = (url) ? url.split("items/")[1]?.split("/")?.[0] || "-" : "-";
        if (isOnModulePage(idFromUrl)) {
            // Use 'selectedModulePageItem' as our own selector if we want to target this later.
            el.classList.add("active", "selectedModulePageItem");
        }

        el.textContent = name;
        el.href = url ?? "#";

        return el;
    }

    // Keep track of the 'last module' element so we can add on as we go down the list.
    let lastModule = modulesLink;

    for (let i = 0; i < modules.length; i++) {
        const mod = modules[i];

        const modEl = createLink(mod.title, null, 1);
        modEl.style.fontWeight = "bold";
        modEl.setAttribute("data-list-id", i);
        
        // Append to last module, then set this one as the last.
        lastModule.after(modEl);
        lastModule = modEl;

        // Indent is 2 for normal items, and 3 for ones with sub heading.
        let indentAt = 2;
        for (const item of mod.items) {
            if (!item.subHeader) indentAt = 2;
            
            const itemEl = createLink(item.title, item.url, indentAt);
            // Set id of the 'module parent', so we can find it's root parent if needed.
            itemEl.setAttribute("data-module-parent-list-id", i);
            lastModule.after(itemEl);
            lastModule = itemEl;

            // Make sub items intended one level further.
            if (item.isSubHeader) {
                indentAt = 3;
                itemEl.style.fontWeight = "bold";
            }
        }
    }

    (async() => {
        let sideBar = getSideBar();
        let tries = 0;

        // Get side bar until it is either found, or it has been about 2-3s of nothing.
        while (!sideBar && tries < 30) {
            sideBar = getSideBar();
            await wait(100);

            tries++;
        }

        scrollToActiveModuleItem();
    })();
}

/**
 * Remove all module items that was added by this.
 */
function removeModuleItems() {
    document.querySelectorAll(".customModuleItem").forEach(e => e.remove());
}

/**
 * Get course modules for a given course. Searches localStorage, if not found, scrapes them. Must be on modules page to scrape!
 * 
 * @param { String } courseId 
 * @returns { Module[] }
 */
function getModulesForCourse(courseId) {
    try {
        const saved = JSON.parse(localStorage.getItem("courseModules"));
        if (!saved) return [];

        return saved[courseId] || [];
    } catch {
        return [];
    }
}

/**
 * Save course modules to localStorage.
 * 
 * @param { String } courseId
 * @param { Module[] } modules 
 */
function saveModulesForCourse(courseId, modules) {
    try {
        const saved = JSON.parse(localStorage.getItem("courseModules")) || {};
        saved[courseId] = modules;

        localStorage.setItem("courseModules", JSON.stringify(saved));
    } catch {}
}

/**
 * Does a simple check to see if the current site is Canvas
 * 
 * @returns { Boolean }
 */
function isCanvasSite() {
    return !!(
        localStorage.getItem("canvas_host") ||
        // Is a canvas site if marked as included.
        localStorage.getItem("cml:isCanvas:included")
    ) && (
        // Is not a canvas site if marked as excluded.
        !localStorage.getItem("cml:isCanvas:excluded")
    );
}

/**
 * Check if the user is a on any module/item page. If an item id is provided, checks for that item specifically.
 * 
 * @param { String? } itemId
 */
function isOnModulePage(itemId) {
    const current = new URL(window.location.href);
    let onItem = current.searchParams.get("module_item_id");

    // If not using query parameter, try checking the path name.
    if (!onItem) {
        onItem = current.pathname.split("modules/items/")[1]?.split("/")?.[0];
        if (!onItem) return false; // After checking again juts return false.
    }

    if (!itemId) return true;
    
    return itemId == onItem;
}

/**
 * @returns { HTMLDivElement }
 */
function getSideBar() {
    return document.querySelector(".ic-sticky-frame.has-scrollbar");
}

/**
 * @param { Number } ms 
 */
function wait(ms = 1000) {
    return new Promise(resolve => {
        setTimeout(resolve, ms);
    });
}

/**
 * Perhaps make this into a checkbox option on the extension?
 */
const USE_SMOOTH_SCROLL = false;

/**
 * Scrolls to active module item (Moreso the parent category / topic).
 */
function scrollToActiveModuleItem() {
    const activeModule = document.querySelector(".selectedModulePageItem");
    if (!activeModule) return;

    const parentId = activeModule.getAttribute("data-module-parent-list-id");
    const parentEl = document.querySelector(`.customModuleItem[data-list-id='${parentId}'`);
    if (!parentEl) return;

    const parentBounds = parentEl.getBoundingClientRect();

    const sideBar = getSideBar();
    sideBar?.scrollTo({ top: parentBounds.top - 100, behavior: USE_SMOOTH_SCROLL ? "smooth" : "instant" });
}

// TODO: 
// - Check for any course updates when visiting course page - right now it probably will just keep current data.
// - Perhaps make module sections collapsable - click the heading to toggle collapse. Canvas already uses localStorage for storing it's collapsible, so maybe it could tie into that?
// - Perhaps do the same for assignments section
// - Add 'inclusion' and 'exclusion' lists for if canvas site is not detected, or if it is wrong - user can add site to be detected / not detected.