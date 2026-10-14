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
        exclusionListBtn.addEventListener("click", () => {
        });
    },

    undetected: () => {
        const el = document.querySelector(".canvasDetection");
        el.innerHTML = `
            <h4>${statusIcon("bad").outerHTML} Canvas Not Detected</h4>
    
            <p>Is this detection incorrect, and the website is Canvas? Add it to the <a class="link inclusionListBtn">inclusion list</a></p>
        `;
    
        const inclusionListBtn = el.querySelector(".inclusionListBtn");
        inclusionListBtn.addEventListener("click", () => {
        });
    }
}

/**
 * Shows canvas detection status and give options.
 */
async function showCanvasDetection() {
    const detected = await checkSiteStatus();

    const func = (detected) ? "detected" : "undetected";
    canvasStatus[func]();
}
showCanvasDetection();
