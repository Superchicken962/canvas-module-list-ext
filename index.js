function initModules(forceRedirect = true) {
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

    if (modules.length > 0) {
        addToPage(modules);
        return;
    }

    // If modules are not loaded, and not on the modules page, redirect to scrape them. Add redirect path to query variable.
    if (modules.length === 0 && !onModulesPage && forceRedirect) {
        window.location.href = `${courseModulesPath}?scrapeModulesReturn=${pathname}`;
        return;
    }

    // Scrape & save modules to localStorage.
    const scrapedModules = scrapeCourseModules();
    saveModulesForCourse(courseId, scrapedModules);

    // Check if we were redirected, and if so, redirect back.
    const redirectedVal = url.searchParams.get("scrapeModulesReturn");
    if (redirectedVal) {
        url.searchParams.delete("scrapeModulesReturn");
        url.pathname = redirectedVal;
        window.location.href = url.href;
        return;
    }

    addToPage(scrapedModules);
}

initModules();