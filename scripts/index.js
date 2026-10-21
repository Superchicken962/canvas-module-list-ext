async function initModules(forceRedirect = true) {
    if (!isCanvasSite()) return;
    
    const url = new URL(window.location.href);

    // Extract course id from url path.
    const pathname = url.pathname;
    const courseId = pathname.split("courses/")[1]?.split("/")?.[0];
    
    // No course id (must not be on a course page) so do nothing.
    if (!courseId) return;

    const modules = getModulesForCourse(courseId);
    const courseModulesPath = `/courses/${courseId}/modules`;
    const onModulesPage = (pathname === courseModulesPath);

    // If there are existing modules, add them now before checking further (minimise delay).
    if (modules && modules.length > 0) {
        addToPage(modules);
    }

    /**
     * For non-module page, this will be overwritten to be the course module document. Otherwise, the scrapeCourseModules function will handle using default.
     */
    let doc = null;

    // Scrape & save modules to localStorage.
    const scrapeAndSave = () => {
        const scrapedModules = scrapeCourseModules(doc);
        saveModulesForCourse(courseId, scrapedModules);
        return scrapedModules;
    }

    // If not on modules page, send a GET request and get the document to scrape from - means we don't need to redirect.
    if (!onModulesPage) {
        doc = await getPageDocument(courseModulesPath);
    }

    // Scrape & save modules to localStorage.
    const scrapedModules = scrapeAndSave();
    addToPage(scrapedModules);
}

initModules();

// Add class name to target with css - so we target it on canvas only.
if (isCanvasSite()) {
    document.querySelector("body").classList.add("canvasPage");
}
