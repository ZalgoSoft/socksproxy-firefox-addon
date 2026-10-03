/**
 * @file Manages the configuration settings for the addon (per-tab mode).
 * @author Anthony Sabathier <sabathiera@gmail.com>
 * @author ZalgoSoft 
*/

(function () {
    "use strict";

    const debug = true;

    // HTML elements for settings
    let formElements = {
        host: document.querySelector("#host"),
        port: document.querySelector("#port"),
        version: document.querySelector("#version"),
        proxyDNS: document.querySelector("#proxydns"),
        reloadTab: document.querySelector("#reloadtab"),
        showIPV4: document.querySelector("#showipv4"),
        showIPV6: document.querySelector("#showipv6")
    };

    /** Handler for cleaner logging */
    function consoleLog(logLevel, logContent) {
        logLevel = logLevel.toUpperCase();
        switch (logLevel) {
            case 'DEBUG':
                debug && console.debug((new Date()).toISOString(), 'socksproxy', logContent);
                break;
            case 'WARNING':
                console.warn((new Date()).toISOString(), 'socksproxy', logContent);
                break;
            case 'ERROR':
                console.error((new Date()).toISOString(), 'socksproxy', logContent);
                break;
            default:
                debug && console.log((new Date()).toISOString(), 'socksproxy', logContent);
                break;
        }
    }

    /** Persist current form values. */
    function saveSettings() {
        consoleLog('DEBUG', 'Entering saveSettings.');

        const socksSettings = {
            socks: formElements.host.value + ':' + formElements.port.value,
            socksVersion: parseInt(formElements.version.value, 10),
            proxyDNS: formElements.proxyDNS.checked,
            reloadTab: formElements.reloadTab.checked,
            showIPV4: formElements.showIPV4.checked,
            showIPV6: formElements.showIPV6.checked
        };
        consoleLog('DEBUG', { msg: 'Settings to be stored:', socksSettings });
        browser.storage.local.set({ socksSettings }).then(
            () => consoleLog('DEBUG', 'Successfully stored socks settings.'),
            (e) => consoleLog('ERROR', 'Failed to store socks settings: ' + e)
        );
    }
    /** Fill the form from storage. */
    function loadSettings(storage) {
        consoleLog('DEBUG', { msg: 'Entering loadSettings.', storage });
        const data = storage.socksSettings;

        if (data && data.socks && data.socks.split(':').length === 2 && data.socksVersion) {
            formElements.host.value = data.socks.split(':')[0];
            formElements.port.value = data.socks.split(':')[1];
            formElements.version.value = data.socksVersion;
            formElements.proxyDNS.checked = !!data.proxyDNS;
            formElements.reloadTab.checked = !!data.reloadTab;
            formElements.showIPV4.checked = !!data.showIPV4;
            formElements.showIPV6.checked = !!data.showIPV6;
        } else {
            consoleLog('WARNING', 'Failed to load properties. Please save proxy settings.');
        }
    }

    /** Apply i18n strings to the form. */
    function loadOptionsI18n() {
        consoleLog('DEBUG', 'Entering loadOptionsI18n.');
        for (const eltName in formElements) {
            const cap = eltName.charAt(0).toUpperCase() + eltName.slice(1);
            const labelText = browser.i18n.getMessage("options" + cap + "Label");
            if (!labelText) continue;
            const elt = formElements[eltName];
            // Replace only the text node before the input (first child).
            if (elt && elt.previousSibling && elt.previousSibling.nodeType === Node.TEXT_NODE) {
                elt.previousSibling.data = labelText;
            }
        }
        const title = browser.i18n.getMessage("optionsTitle");
        if (title) document.querySelector("#title").textContent = title;
        // Hint about per-tab behaviour + version limitation
        const versionHint = browser.i18n.getMessage("optionsVersionHint");
        if (versionHint) {
            document.querySelector("#version-hint").textContent = versionHint;
        } else {
            document.querySelector("#version-hint").textContent =
                "Note: Firefox picks SOCKS4/SOCKS5 automatically for per-tab routing.";
        }
    }
    /** Wire up the Save button and load current values. */
    function initOptions() {
        consoleLog('DEBUG', 'Entering Options initialization.');
        // Update UI on options page opening (language + values)
        loadOptionsI18n();
        browser.storage.local.get().then(loadSettings, console.error);
        const saveBtn = document.querySelector("#save");
        saveBtn.addEventListener("click", saveSettings);
        // Let debug guy know we initialized options
        consoleLog('DEBUG', 'Options script initialized.');
    }

    // Run initialization
    initOptions();
})();
