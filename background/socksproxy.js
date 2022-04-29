/**
 * @file Main controller file for the addon
 * @author Anthony Sabathier <sabathiera@gmail.com>
 */

(function() {
    "use strict";
    
    const debug = true;
    
    const states = {
        enabled: {
            title: browser.i18n.getMessage('enabledTitle'),
            icon: 'icons/socks-enabled.svg',
            storageName: 'socksSettings'
        },
        disabled: {
            title: browser.i18n.getMessage('disabledTitle'),
            icon: 'icons/socks-disabled.svg',
            storageName: 'originalProxySettings'
        }
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

    /** Handler for a click on browser action button */
    function toggleSocksProxy() {
        consoleLog('DEBUG', 'Entering toggleSocksProxy.');
        browser.storage.local.get().then((localStorageData) => {
            if (localStorageData.socksProxyStatus && localStorageData.socksProxyStatus !== 'enabled') {
                setProxy('enabled');
            } else {
                setProxy('disabled');
            }
        });
    }

    /** Sets relevant browser proxy settings based on enablement */
    function setProxy(newState) {
        consoleLog('DEBUG', { msg: 'Entering setProxy. Parameters in subsequent objects.', newState: newState });
        browser.storage.local.get().then((storageData) => {
            consoleLog('DEBUG', { msg: 'Local storage content:', storageData: storageData });
            const newProxySettings = storageData[states[newState].storageName];
            consoleLog('DEBUG', { msg: 'Proxy settings to be applied:', newProxySettings: newProxySettings });
            if (newProxySettings && (newState === 'disabled' || (newProxySettings.socks && newProxySettings.socksVersion))) {
                // We set target proxy settings (socks or original)
                browser.proxy.settings.set({value: newProxySettings}).then(() => {
                    // We persist new state in case of shutdown
                    browser.storage.local.set({socksProxyStatus: newState}).then(() => {
                        setStateView(newState);
                    });
                });
            } else {
                consoleLog('WARNING', 'No socks settings stored or malformated data, please go & check preferences. (about:addons in address bar)');
            }
        });
    }
    
    /** Set style for browser action button */
    function setStateView(newState) {
        consoleLog('DEBUG', { msg: 'Entering setStateView. Parameters in subsequent objects.', newState: newState });
        browser.browserAction.setTitle({title: states[newState].title});
        browser.browserAction.setIcon({path: states[newState].icon});    
    }

    /** Checks "Run in Private Windows" is allowed for addon */
    function checkIncognitoAccess() {
        browser.extension.isAllowedIncognitoAccess().then((isAllowed) => {
            if (!isAllowed) {
                consoleLog('WARNING', '"Run in Private Windows" is set to "Don\'t Allow", please go to about:addons and allow it to enable us change proxy settings.');
            } else {
                consoleLog('DEBUG', 'OK. "Run in Private Windows" is set to "Allow", as it should be.');
            }
        })
    }
    
    /** Init the browser action button & stores original proxy settings */
    function initAddon() {
        consoleLog('DEBUG', 'Entering add-on initialization.');
        checkIncognitoAccess();
        browser.browserAction.onClicked.addListener(toggleSocksProxy);
        browser.storage.local.get().then((localStorageData) => {
            consoleLog('DEBUG', { msg: 'Local storage content:', localStorageData: localStorageData });
            // No need to override original proxy settings if already set.
            if (!localStorageData.originalProxySettings) {
                consoleLog('DEBUG','No default config for Disabled mode, storing current browser proxy settings.');
                browser.proxy.settings.get({}).then((proxySettings) => {
                    browser.storage.local.set({ originalProxySettings: proxySettings.value }).then(() => { consoleLog('DEBUG', 'Successfully stored originalProxySettings.'); }, console.error);
                });
            }
            if (localStorageData.socksProxyStatus) {
                setProxy(localStorageData.socksProxyStatus);
            } else {
                setProxy('disabled');
            }
        });  
        consoleLog('DEBUG', 'Add-on initialization completed.');
    }
    
    // Run initialization
    initAddon();
})();
