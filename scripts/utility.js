let env;
getWindowVariable("ENV").then(val => {
    env = val;
});

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
 * @property { String } id
 * @property { Boolean } isSubHeader - Is this item a sub header?
 * @property { String? } subHeader - Sub header this item is under, if under any.
 * @property { String? } url - URL to item page (if it has one).
 */

/**
 * Scrape modules from list on course modules page. Must be done from modules page.
 * 
 * @param { HTMLElement? } doc - Optional override of document - use if not scraping the current page.
 * @returns { Module[] }
 */
function scrapeCourseModules(doc) {
    const modules = {};
    const moduleEls = (doc ?? document).querySelectorAll(".context_module");

    for (let i = 0; i < moduleEls.length; i++) {
        const module = moduleEls[i];

        const moduleName = module.getAttribute("aria-label");
        if (!moduleName) continue;

        const moduleId = module.getAttribute("data-module-id");

        const items = module.querySelectorAll(".context_module_items li");
        let lastSubHeader = null;

        const modData = {
            title: moduleName,
            id: moduleId,
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

    // Ensure we remove existing items first.
    removeModuleItems();

    // Keep track of the 'last module' element so we can add on as we go down the list.
    let lastModule = modulesLink;

    for (let i = 0; i < modules.length; i++) {
        const mod = modules[i];

        const modEl = createLink(mod.title, null, 1);
        modEl.style.fontWeight = "bold";
        modEl.setAttribute("data-list-id", i);
        modEl.classList.add("moduleTopicHeader");
        // Default view is as expanded, so include this class.
        modEl.classList.add("expanded");
        
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

        const toggleExpand = () => {
            modEl.classList.toggle("expanded");
            const children = document.querySelectorAll(`.customModuleItem[data-module-parent-list-id='${i}']`);
            children.forEach(c => c.classList.toggle("hidden"));
            
            return modEl.classList.contains("expanded");
        }

        const expanded = isModuleExpanded(mod.id);
        if (!expanded) toggleExpand();

        modEl.addEventListener("click", (ev) => {
            ev.preventDefault();
            const nowExpanded = toggleExpand();
            setModuleExpandedState(mod.id, nowExpanded, usingSharedModuleState());
        });
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
 * @returns { Module[] | null } Array of modules, or null if it has not been added.
 */
function getModulesForCourse(courseId) {
    try {
        const saved = JSON.parse(localStorage.getItem("courseModules"));
        if (!saved) return null;

        return saved[courseId] || null;
    } catch {
        return null;
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
        !!(localStorage.getItem("DASHBOARD_COURSES") && localStorage.getItem("COURSE_IDS")) ||
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

let hasScrolledToActive = false;

/**
 * Scrolls to active module item (Moreso the parent category / topic).
 */
function scrollToActiveModuleItem() {
    // If we have already scrolled, don't do it again as it may mess it up.
    if (hasScrolledToActive) return;

    const activeModule = document.querySelector(".selectedModulePageItem");
    if (!activeModule) return;

    const parentId = activeModule.getAttribute("data-module-parent-list-id");
    const parentEl = document.querySelector(`.customModuleItem[data-list-id='${parentId}'`);
    if (!parentEl) return;

    const parentBounds = parentEl.getBoundingClientRect();

    const sideBar = getSideBar();
    sideBar?.scrollTo({ top: parentBounds.top - 100, behavior: USE_SMOOTH_SCROLL ? "smooth" : "instant" });
    hasScrolledToActive = true;
}

/**
 * GET a page document from a given url.
 * 
 * @param { String } url 
 * @returns { Promise<HTMLElement> }
 */
async function getPageDocument(url) {
    const body = await (await fetch(url)).text();

    const docEl = document.createElement("html");
    docEl.innerHTML = body;
    return docEl;
}

/**
 * Get window variable from page.
 * 
 * @param { String } variable - Variable/property name to get from window context.
 * @returns { Promise<Object> }
 */
function getWindowVariable(variable) {
    return new Promise((resolve) => {
        chrome.runtime.sendMessage({ event: "GET_WINDOW_VAR", variable }, (data) => {
            resolve(data?.[variable] || null);
        });
    });
}

function getUserId() {
    const userId = env?.current_user_id ?? null;

    // If no user id at the moment, try getting the cached user id (if it has been set).
    if (!userId) {
        return localStorage.getItem("cml:cachedUserId") ?? null;
    }

    // Save user id to cache for next time.
    localStorage.setItem("cml:cachedUserId", userId);
    return userId;
}

/**
 * Check if a module is expanded on the list.
 * 
 * @param { String } id
 * @returns { Boolean }
 */
function isModuleExpanded(id) {
    return getCanvasModuleExpandedState(localStorage.getItem("CURRENT_COURSE_ID"), id) == "true";
}

/**
 * 
 * @param { String } moduleId 
 * @param { Boolean } state
 * @param { Boolean } shareModulePageState - Attach localStorage value to the expanded state of topics on actual modules page?
 */
function setModuleExpandedState(moduleId, state, shareModulePageState = false) {
    const courseId = localStorage.getItem("CURRENT_COURSE_ID");

    if (shareModulePageState) {
        // TODO - it will still store in normal storage, but this will determine if it should sync with modules list.
        // There shouldn't be a need to check when getting, as the two *should* syncronise when setting - clicking either will set it. 
        setModuleExpandedForCanvas(courseId, moduleId, state);
    }

    localStorage.setItem(`cml:moduleExpandState::c${courseId}:m${moduleId}`, state);
}

/**
 * 
 * @param { String } courseId 
 * @param { String } moduleId 
 * @returns { "true"|"false" }
 */
function getCanvasModuleExpandedState(courseId, moduleId) {
    return localStorage.getItem(`cml:moduleExpandState::c${courseId}:m${moduleId}`);
}

/**
 * Sets the module expanded state for the module list on canvas - not the side list, but the main page for canvas.
 * 
 * @param { String } courseId
 * @param { String } moduleId
 * @param { Boolean } expanded - Set to expanded?
 * @returns { Promise<Boolean> } Success?
 */
function setModuleExpandedForCanvas(courseId, moduleId, expanded) {
    return new Promise((resolve) => {
        chrome.runtime.sendMessage({ event: "toggleModuleCollapse", courseId, moduleId, expanded }, (data) => {
            resolve(data.success);
        });
    });
}

/**
 * Check if using shared state between module page (canvas page) and the module list (from extension).
 */
function usingSharedModuleState() {
    return localStorage.getItem("cml:usingSharedModuleState") == "true";
}
/**
 * Set shared state enabled/disabled.
 * TODO: Add checkbox on popup / content to toggle this.
 * 
 * @param { "true"|"false" } state - Sharing states? 
 */
function setUsingSharedModuleState(state = "false") {
    localStorage.setItem("cml:usingSharedModuleState", state);
}

/**
 * Initialise click listeners on modules on the modules page.
 */
function initModulePageListeners() {
    for (const collapseBtn of document.querySelectorAll(".context_module .ig-header-title")) {
        collapseBtn.addEventListener("click", () => {
            if (!usingSharedModuleState()) return;

            const expanded = collapseBtn.classList.contains("expand_module_link");
            const moduleId = (collapseBtn.getAttribute("href") || "").split("modules/")[1]?.split("/")[0]

            // Use false to shared state just so we don't circle back and set the canvas state, since it is already set by this being clicked.
            setModuleExpandedState(moduleId, expanded, false);
        });
    }
}

// TODO: 
// - Perhaps make module sections collapsable - click the heading to toggle collapse. Canvas already uses localStorage for storing it's collapsible, so maybe it could tie into that?
// - Perhaps do the same for assignments section