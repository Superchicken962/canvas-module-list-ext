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
 * Scrape modules from list on course modules page.
 * 
 * @returns { Module[] }
 */
function getCourseModules() {
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
        el.classList.remove("active");
        el.classList.add("customModuleItem");
        el.style.marginLeft = `${indentLevel * 15}px`;

        el.textContent = name;
        el.href = url ?? "#";

        return el;
    }

    // Keep track of the 'last module' element so we can add on as we go down the list.
    let lastModule = modulesLink;

    for (const mod of modules) {
        const modEl = createLink(mod.title, null, 1);
        // Append to last module, then set this one as the last.
        lastModule.after(modEl);
        lastModule = modEl;

        // Indent is 2 for normal items, and 3 for ones with sub heading.
        let indentAt = 2;
        for (const item of mod.items) {
            if (!item.subHeader) indentAt = 2;
            
            const itemEl = createLink(item.title, item.url, indentAt);
            lastModule.after(itemEl);
            lastModule = itemEl;

            if (item.isSubHeader) {
                console.log("sub header", item.title);
                indentAt = 3;
            }
        }
    }
}

/**
 * Remove all module items that was added by this.
 */
function removeModuleItems() {
    document.querySelectorAll(".customModuleItem").forEach(e => e.remove());
}