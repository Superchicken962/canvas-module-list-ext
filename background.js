const eventListeners = {};
chrome.runtime.onMessage.addListener((message, sender, respond) => {
    const listener = eventListeners[message.event || message.action];

    if (typeof listener === "function") {
        listener(message, sender, respond);        
    }

    return true;
});

/**
 * 
 * @param { String } event 
 * @param { (data: Object, sender: Object, reply: () => void) => void } callback 
 */
function listenForMessage(event, callback) {
    eventListeners[event] = callback;
}

listenForMessage("GET_WINDOW_VAR", (data, sender, reply) => {
    chrome.scripting.executeScript({
        target: { tabId: sender.tab.id },
        func: (varName) => {
            return window[varName];
        },
        args: [data.variable],
        // Allow script to access window variables of page.
        world: "MAIN"
    }).then((result) => reply({ [data.variable]: result[0]?.result }));
});

// Toggle collapse on a module on the modules page.
listenForMessage("toggleModuleCollapse", (data, sender, reply) => {
    chrome.scripting.executeScript({
        target: { tabId: sender.tab.id },
        func: (courseId, moduleId, state) => {
            // Use same method that canvas uses to set the state.
            $.ajaxJSON(`/courses/${courseId}/modules/${moduleId}/collapse`, "POST", { collapse: !!state ? 0 : 1 });
            return;
        },
        args: [data.courseId, data.moduleId, (data.state || data.expanded)],
        world: "MAIN"
    }).then(() => reply({ success: true }))
    .catch(() => reply({ success: false }));
});