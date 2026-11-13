/**
 * Send message to extension script.
 * 
 * @param { String } subject - Message title / subject.
 * @param { Object } data - Message data. 
 * @returns { Promise<Object> }
 */
async function askExtension(subject, data) {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) return;

    if (!data) data = {};
    data.subject = subject;

    const resp = await chrome.tabs.sendMessage(tab.id, data);
    return resp;
}

/**
 * @param { "good" | "bad" } status 
 * @returns { HTMLSpanElement } 
 */
function statusIcon(status) {
    const el = document.createElement("span");
    el.className = `statusIcon ${status}`;

    switch(status) {
        case "bad":
            el.innerHTML = `<i class="fa fa-xmark fa-sm"></i>`;
            break;

        case "good":
            el.innerHTML = `<i class="fa fa-check fa-sm"></i>`;
            break;
    }

    return el;
}

/**
 * Check if the site is detected as Canvas or not by the extension (or if it is in the inclusion/exclusion list).
 * 
 * @returns { Promise<Boolean> }
 */
async function checkSiteStatus() {
    const resp = await askExtension("checkCanvasDetection");
    return resp?.canvasDetected ?? false;
}

const canvasStatus = {
    detected: () => {
        const el = document.querySelector(".canvasDetection");
        el.innerHTML = `
            <h4>${statusIcon("good").outerHTML} Canvas Detected</h4>

            <p>Not actually Canvas? Add it to the <a class="link exclusionListBtn">exclusion list</a></p>
        `;

        const exclusionListBtn = el.querySelector(".exclusionListBtn");
        exclusionListBtn.addEventListener("click", async() => {
            await askExtension("addToCanvasExclusion");

            el.innerHTML = `
                <h4>${statusIcon("good").outerHTML} Now Excluding Website</h4>

                <p><a class="link">Refresh the page to see changes</a></p>
            `;
            el.querySelector(".link").onclick = reloadPage;
        });
    },

    undetected: () => {
        const el = document.querySelector(".canvasDetection");
        el.innerHTML = `
            <h4>${statusIcon("bad").outerHTML} Canvas Not Detected</h4>
    
            <p>Is this detection incorrect, and the website is Canvas? Add it to the <a class="link inclusionListBtn">inclusion list</a></p>
        `;
    
        const inclusionListBtn = el.querySelector(".inclusionListBtn");
        inclusionListBtn.addEventListener("click", async() => {
            await askExtension("addToCanvasInclusion");

            el.innerHTML = `
                <h4>${statusIcon("good").outerHTML} Now Including Website</h4>

                <p><a class="link">Refresh the page to see changes</a></p>
            `;
            el.querySelector(".link").onclick = reloadPage;
        });
    }
}

function reloadPage() {
    askExtension("reloadPage");
    showCanvasDetection();
}

const configSection = document.querySelector(".config");

/**
 * Shows canvas detection status and give options.
 */
async function showCanvasDetection() {
    const detected = await checkSiteStatus();

    const func = (detected) ? "detected" : "undetected";
    canvasStatus[func]();

    // Only show configuration if on canvas site.
    if (detected) configSection.classList.remove("hidden");
    else configSection.classList.add("hidden");
}
showCanvasDetection();


/**
 * Configuration section
 */

/**
 * @param { Object } opts 
 * @param { "text"|"checkbox" } opts.type 
 * @param { String } opts.label 
 * @param { String } opts.id 
 * @param { String } opts.description
 * @param { String } opts.localStorageKey - Key to read & save value in localStorage.
 */
function addConfigInput(opts = {}) {
    const inp = document.createElement("input");
    if (opts.id) inp.id = opts.id;
    inp.className = "configInput";
    inp.type = opts.type ?? "text";

    const existingVal = localStorage.getItem(opts.localStorageKey);
    if (existingVal && opts.type !== "checkbox") inp.value = existingVal;
    else inp.checked = (existingVal == "true");

    inp.addEventListener("input", () => {
        localStorage.setItem(opts.localStorageKey, (opts.type === "checkbox" ? inp.checked : inp.value)); 
    });
 
    const lbl = document.createElement("label");
    lbl.setAttribute("for", opts.id);
    if (opts.label) lbl.textContent = opts.label;

    const description = document.createElement("p");
    description.className = "description";
    description.textContent = opts.description ?? "";

    const container = document.createElement("div");
    container.className = "configOption";

    container.appendChild(lbl);
    container.appendChild(inp);
    container.appendChild(description);

    configSection.append(container);
}

addConfigInput({ id: "useSharedState", label: "Use Shared State", type: "checkbox", localStorageKey: "cml:usingSharedModuleState", description: "Sync expanded status between side list and modules page?" });