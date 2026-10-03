/**
 * @file Main controller file for the addon (per-tab mode)
 * @author Anthony Sabathier <sabathiera@gmail.com>
 * @author wakeuteu
 * @author ZalgoSoft
 */

(function() {
    "use strict";

    const debug = true;

    /** tabId -> { type, host, port, proxyDNS, username?, password? } */
    const tabProxies = new Map();
    const icons = {
        enabled: 'icons/socks-enabled.svg',
        disabled: 'icons/socks-disabled.svg'
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
    async function loadTabState() {
        try {
            const stored = await browser.storage.session.get('tabProxies');
            const saved = stored.tabProxies || {};
            for (const [tabId, cfg] of Object.entries(saved)) {
                tabProxies.set(Number(tabId), cfg);
            }
            consoleLog('DEBUG', {
                msg: 'Loaded per-tab state.',
                size: tabProxies.size
            });
        } catch (e) {
            consoleLog('ERROR', 'Failed to load tab state: ' + e);
        }
    }
    async function saveTabState() {
        const obj = {};
        for (const [tabId, cfg] of tabProxies) obj[tabId] = cfg;
        try {
            await browser.storage.session.set({
                tabProxies: obj
            });
        } catch (e) {
            consoleLog('ERROR', 'Failed to save tab state: ' + e);
        }
    }
    browser.proxy.onRequest.addListener(
        (request) => {
            // Requests outside a tab (browser internals, updates, telemetry)
            if (request.tabId < 0) {
                return {
                    type: 'direct'
                };
            }
            const cfg = tabProxies.get(request.tabId);
            if (!cfg) {
                return {
                    type: 'direct'
                };
            }
            return cfg;
        }, {
            urls: ['<all_urls>']
        }
    );
    async function buildProxyConfigFromOptions() {
        const data = await browser.storage.local.get('socksSettings');
        const s = data.socksSettings;
        if (!s || !s.socks || s.socks.split(':').length !== 2 || !s.socksVersion) {
            consoleLog('WARNING', 'No socks settings stored or malformed data. Open the options page.');
            return null;
        }
        const [host, port] = s.socks.split(':');
        const cfg = {
            type: 'socks',
            host: host,
            port: parseInt(port, 10),
            proxyDNS: !!s.proxyDNS
            // socksVersion игнорируется proxy.onRequest — Firefox сам определяет
            // версию по возможности; для SOCKS5 достаточно type:'socks'.
        };
        return cfg;
    }
    async function setStateView(tabId, enabled) {
        const icon = enabled ? icons.enabled : icons.disabled;
        const titleKey = enabled ? 'enabledTitle' : 'disabledTitle';
        try {
            await browser.browserAction.setIcon({
                tabId: tabId,
                path: icon
            });
            await browser.browserAction.setTitle({
                tabId: tabId,
                title: browser.i18n.getMessage(titleKey)
            });
        } catch (e) {
            // Tab may have been closed in the meantime — ignore.
        }
    }

    async function refreshAllTabIcons() {
        const tabs = await browser.tabs.query({});
        for (const tab of tabs) {
            await setStateView(tab.id, tabProxies.has(tab.id));
        }
    }

    async function toggleSocksProxy() {
        const [tab] = await browser.tabs.query({
            active: true,
            currentWindow: true
        });
        if (!tab) return;

        if (tabProxies.has(tab.id)) {
            consoleLog('DEBUG', 'Disabling proxy for tab ' + tab.id);
            tabProxies.delete(tab.id);
            await saveTabState();
            await setStateView(tab.id, false);
            await maybeReloadTab(tab.id);
            return;
        }

        const cfg = await buildProxyConfigFromOptions();
        if (!cfg) {
            consoleLog('WARNING', 'Cannot enable: no valid socks settings.');
            return;
        }
        consoleLog('DEBUG', {
            msg: 'Enabling proxy for tab ' + tab.id,
            cfg: cfg
        });
        tabProxies.set(tab.id, cfg);
        await saveTabState();
        await setStateView(tab.id, true);
        await maybeReloadTab(tab.id);
    }
    async function maybeReloadTab(tabId) {
        const data = await browser.storage.local.get('socksSettings');
        if (data.socksSettings && data.socksSettings.reloadTab) {
            try {
                await browser.tabs.reload(tabId);
            } catch (e) {
                consoleLog('ERROR', 'Could not reload tab ' + tabId + ': ' + e);
            }
        }
    }
    async function getCurrentIP(tabId) {
        const data = await browser.storage.local.get('socksSettings');
        const s = data.socksSettings;
        if (!s || (!s.showIPV4 && !s.showIPV6)) return;

        const tasks = [];
        if (s.showIPV4) {
            tasks.push(
                fetch(new Request('https://api.ipify.org/?format=json'))
                .then(r => r.json())
                .then(d => d && d.ip ? d.ip : Promise.reject('Invalid IPv4 response'))
                .catch(err => {
                    consoleLog('ERROR', 'IPv4 fetch failed: ' + err);
                    return null;
                })
            );
        }
        if (s.showIPV6) {
            tasks.push(
                fetch(new Request('https://api64.ipify.org/?format=json'))
                .then(r => r.json())
                .then(d => d && d.ip ? d.ip : Promise.reject('Invalid IPv6 response'))
                .catch(err => {
                    consoleLog('ERROR', 'IPv6 fetch failed: ' + err);
                    return null;
                })
            );
        }
        const ips = (await Promise.all(tasks)).filter(Boolean);
        if (!ips.length) return;
        try {
            const currentTitle = await browser.browserAction.getTitle({
                tabId: tabId
            });
            const base = currentTitle.split('\n')[0];
            await browser.browserAction.setTitle({
                tabId: tabId,
                title: [base].concat(ips).join('\n')
            });
        } catch (e) {
            consoleLog('ERROR', 'Could not update title: ' + e);
        }
    }
    browser.tabs.onActivated.addListener(async ({
        tabId
    }) => {
        await setStateView(tabId, tabProxies.has(tabId));
    });

    browser.tabs.onUpdated.addListener(async (tabId, changeInfo) => {
        if (changeInfo.status === 'complete') {
            await setStateView(tabId, tabProxies.has(tabId));
            if (tabProxies.has(tabId)) getCurrentIP(tabId);
        }
    });
    browser.tabs.onRemoved.addListener(async (tabId) => {
        if (tabProxies.delete(tabId)) {
            await saveTabState();
        }
    });

    function checkIncognitoAccess() {
        browser.extension.isAllowedIncognitoAccess().then((isAllowed) => {
            if (!isAllowed) {
                consoleLog('WARNING', '"Run in Private Windows" is disabled; per-tab proxy will not apply in private windows.');
            } else {
                consoleLog('DEBUG', 'Incognito access OK.');
            }
        });
    }
    browser.proxy.onError.addListener((error) => {
        console.error("proxy.onError:", error.message);
        console.error("ProxyInfo, вызвавший ошибку:", error);
    });
    async function initAddon() {
        consoleLog('DEBUG', 'Entering add-on initialization.');
        checkIncognitoAccess();

        browser.browserAction.onClicked.addListener(toggleSocksProxy);
        await loadTabState();
        // Legacy cleanup: if an older version left global proxy settings,
        // clear them so proxy.onRequest takes over.
        try {
            await browser.proxy.settings.clear({});
        } catch (e) {
            /* ignore */
        }
        await refreshAllTabIcons();

        consoleLog('DEBUG', 'Add-on initialization completed.');
    }

    // Run initialization
    initAddon();
})();