/**
 * @file Main controller file for the addon
 * @author Anthony Sabathier <sabathiera@gmail.com>
 */

(function() {
    "use strict";
    
    const debug = true;
    
    var currentState = 'disabled';
    
    const states = {
        enabled: {
            title: 'SOCKS - Enabled',
            icon: 'icons/socks-enabled.svg',
            storageName: 'socksSettings'
        },
        disabled: {
            title: 'SOCKS - Disabled',
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
        currentState = (currentState != 'enabled') ? 'enabled' : 'disabled';
        setProxy(currentState);
    }

    /** Sets relevant browser proxy settings based on enablement */
    function setProxy(currentState) {
        consoleLog('DEBUG', { msg: 'Entering setProxy. Parameters in subsequent objects.', currentState: currentState });
        browser.storage.local.get().then((storageData) => {
            consoleLog('DEBUG', { msg: 'Local storage content:', storageData: storageData });
            let proxySettings = storageData[states[currentState].storageName];
            consoleLog('DEBUG', { msg: 'Proxy settings to be applied:', proxySettings: proxySettings });
            if (proxySettings && (currentState === 'disabled' || (proxySettings.socks && proxySettings.socksVersion))) {
                browser.proxy.settings.set({value: proxySettings}).then(() => { 
                    setStateView(currentState); 
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
    
    /** Init the browser action button & stores original proxy settings */
    function initAddon() {
        consoleLog('DEBUG', 'Entering add-on initialization.');
        browser.browserAction.onClicked.addListener(toggleSocksProxy);
        browser.proxy.settings.get({}).then((proxySettings) => {
            browser.storage.local.set({originalProxySettings: proxySettings.value});
        });        
        consoleLog('DEBUG', 'Add-on initialization completed.');
    }
    
    // Run initialization
    initAddon();
})();
