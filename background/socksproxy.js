/**
 * @file Main controller file for the addon
 * @author Anthony Sabathier <sabathiera@gmail.com>
 */

(function () {
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
                browser.proxy.settings.set({ value: newProxySettings }).then(() => {
                    // We persist new state in case of shutdown
                    browser.storage.local.set({ socksProxyStatus: newState }).then(() => {
                        setStateView(newState);
                        // Everything went fine, we can refresh current tab.
                        reloadActiveTab(storageData);
                        // We can also retrieve current IP.
                        getCurrentIP(storageData);
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
        browser.browserAction.setTitle({ title: states[newState].title });
        browser.browserAction.setIcon({ path: states[newState].icon });
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

    /** Refresh active tab if relevant option is true */
    function reloadActiveTab(localStorageData) {
        consoleLog('DEBUG', { msg: 'Entering reloadActiveTab. Parameters in subsequent objects.', localStorageData: localStorageData });
        if (localStorageData.socksSettings && localStorageData.socksSettings.reloadTab) {
            // Refreshing current tab.
            browser.tabs.reload().then(
                () => { consoleLog('DEBUG', 'Current tab reloaded successfuly'); }, 
                (errorMsg) => { consoleLog('ERROR', 'Could not reload tab. Error: ' + errorMsg); }
            );
        }
    }

    /** Refresh active tab if relevant option is true */
    function getCurrentIP(localStorageData) {
        consoleLog('DEBUG', { msg: 'Entering getCurrentIP. Parameters in subsequent objects.', localStorageData: localStorageData });
        if (!localStorageData.socksSettings || 
            (!localStorageData.socksSettings.showIPV4 
                && !localStorageData.socksSettings.showIPV6)) {
            return;
        }
        let ip4Promise = Promise.resolve();
        let ip6Promise = Promise.resolve();
        if (localStorageData.socksSettings.showIPV4) {
            ip4Promise = fetch(new Request('https://api.ipify.org/?format=json'))
                .then(response4 => response4.json())
                .then(data4 => {
                    if (data4 && data4.ip) {
                        console.log({msg: 'getCurrentIP - Retrieved IPV4.', ipv4: data4.ip});
                        return data4.ip
                    } else {
                        throw 'API responded but message is not valid: ' + JSON.stringify(data4);
                    }
                }).catch(errorMsg => consoleLog('ERROR', 'Could not retrieve IP4. Error: ' + errorMsg));
        }
        if (localStorageData.socksSettings.showIPV6) {
            ip6Promise = fetch(new Request('https://api64.ipify.org/?format=json'))
                .then(response6 => response6.json())
                .then(data6 => {
                    if (data6 && data6.ip) {
                        console.log({msg: 'getCurrentIP - Retrieved IPV4/IPV6.', ipv6: data6.ip});
                        return data6.ip
                    } else {
                        throw 'API responded but message is not valid: ' + JSON.stringify(data6);
                    }
                }).catch(errorMsg => consoleLog('ERROR', 'Could not retrieve IP4. Error: ' + errorMsg));
        }
        Promise.all([ip4Promise, ip6Promise]).then(ipPromises => {
            browser.browserAction.getTitle({})
            .then(currentTitle => {
                browser.browserAction.setTitle({ title: [currentTitle.split('\n')[0]].concat(ipPromises).join('\n') });
             });
        });
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
                consoleLog('DEBUG', 'No default config for Disabled mode, storing current browser proxy settings.');
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
