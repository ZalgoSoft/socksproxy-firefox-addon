/**
 * @file Manages the configuration settings for the addon.
 * @author Anthony Sabathier <sabathiera@gmail.com>
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
        passthrough: document.querySelector("#passthrough"),
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

    /** Store the currently selected settings using browser.storage.local. */
    function saveSettings() {
        consoleLog('DEBUG', 'Entering saveSettings.');

        let socksSettings = {
            proxyType: 'manual',
            socks: formElements.host.value + ':' + formElements.port.value,
            socksVersion: parseInt(formElements.version.value),
            proxyDNS: formElements.proxyDNS.checked,
            passthrough: formElements.passthrough.value,
            reloadTab: formElements.reloadTab.checked,
            showIPV4: formElements.showIPV4.checked,
            showIPV6: formElements.showIPV6.checked,
        };
        consoleLog('DEBUG', { msg: 'Settings to be stored: ', socksSettings: socksSettings });
        browser.storage.local.set({ socksSettings }).then(() => { consoleLog('DEBUG', 'Successfully stored socks settings.'); }, console.error);
    }


    /** Load and check to display settings provided by browser.storage.local */
    function loadSettings(storage) {
        consoleLog('DEBUG', { msg: 'Entering loadSettings. Parameters in subsequent objects.', storage: storage });
        let data = storage.socksSettings;
        // Check if all values exist
        if (data && data.socks && data.socks.split(':').length == 2 && data.socksVersion) {
            formElements.host.value = data.socks.split(':')[0];
            formElements.port.value = data.socks.split(':')[1];
            formElements.version.value = data.socksVersion;
            formElements.proxyDNS.checked = data.proxyDNS || false;
            formElements.passthrough.value = data.passthrough || '';
            formElements.reloadTab.checked = data.reloadTab || false;
            formElements.showIPV4.checked = data.showIPV4 || false;
            formElements.showIPV6.checked = data.showIPV6 || false;
        } else {
            consoleLog('WARNING', 'Failed to load properties. Please Save proxy settings.');
        }
    }

    /** Load i18n for options UI */
    function loadOptionsI18n() {
        consoleLog('DEBUG', 'Entering loadOptionsI18n.');
        let capitalizedEltName = '';
        // Matching names for formElements keys and i18n messages does help
        for (var eltName in formElements) {
            capitalizedEltName = eltName.charAt(0).toUpperCase() + eltName.slice(1);
            formElements[eltName].previousSibling.data = browser.i18n.getMessage("options" + capitalizedEltName + "Label");
        }
        document.querySelector("#title").textContent = browser.i18n.getMessage("optionsTitle");
    }

    /** JS initialization for options UI */
    function initOptions() {
        consoleLog('DEBUG', 'Entering Options initialization.');
        // Update UI on options page opening (language + values)
        loadOptionsI18n();
        browser.storage.local.get().then(loadSettings, console.error);
        // Save button will actually save or dump error to console
        document.querySelector("#save").addEventListener("click", saveSettings);
        // Let debug guy know we initialized options
        consoleLog('DEBUG', 'Options script initialized.');
    }

    // Run initialization
    initOptions();
})();
