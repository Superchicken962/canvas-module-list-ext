/**
 * Scrape modules from list on course modules page.
 * 
 * @returns { Record<String, Object[]> }
 */
function getCourseModules() {
    const modules = {};
    const moduleEls = document.querySelectorAll(".context_module");

    for (const module of moduleEls) {
        const moduleName = module.getAttribute("aria-label");
        if (!moduleName) continue;

        modules[moduleName] = [];
        const items = module.querySelectorAll(".context_module_items li");
        let lastSubHeader = null;

        for (const item of items) {
            const isSubHeader = item.classList.contains("context_module_sub_header");

            if (isSubHeader) {
                const subHeaderTitle = item.querySelector(".module-item-title .item_name .title.locked_title").textContent.trim();
                lastSubHeader = subHeaderTitle;
                modules[moduleName].push({
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

            modules[moduleName].push({
                isSubHeader,
                subHeader: lastSubHeader,
                title: itemName,
                url: itemUrl
            });
        }
    }

    return modules;
}