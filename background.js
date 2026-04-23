/**
 * Service worker: storage defaults, daily counter, message hub.
 */
(function () {
  "use strict";

  var STORAGE_KEY = "focusTube";

  function mergeDefaults(data) {
    if (!data || typeof data !== "object") {
      return {
        enabled: true,
        blockedDate: "",
        blockedCountToday: 0,
      };
    }
    return {
      enabled: data.enabled !== false,
      blockedDate: typeof data.blockedDate === "string" ? data.blockedDate : "",
      blockedCountToday:
        typeof data.blockedCountToday === "number" && data.blockedCountToday >= 0
          ? data.blockedCountToday
          : 0,
    };
  }

  function getTodayKey() {
    var n = new Date();
    return n.getFullYear() + "-" + String(n.getMonth() + 1).padStart(2, "0") + "-" + String(n.getDate()).padStart(2, "0");
  }

  function normalizeForToday(raw) {
    var m = mergeDefaults(raw);
    var today = getTodayKey();
    if (m.blockedDate !== today) {
      m.blockedCountToday = 0;
      m.blockedDate = today;
    }
    return m;
  }

  function load() {
    return new Promise(function (resolve) {
      try {
        chrome.storage.local.get(STORAGE_KEY, function (o) {
          if (chrome.runtime && chrome.runtime.lastError) {
            resolve(mergeDefaults({}));
            return;
          }
          var raw = o && o[STORAGE_KEY];
          resolve(normalizeForToday(raw));
        });
      } catch (_e) {
        resolve(mergeDefaults({}));
      }
    });
  }

  function save(data) {
    return new Promise(function (resolve) {
      var normalized = normalizeForToday(mergeDefaults(data));
      var payload = {};
      payload[STORAGE_KEY] = normalized;
      try {
        chrome.storage.local.set(payload, function () {
          if (chrome.runtime && chrome.runtime.lastError) {
            resolve(false);
            return;
          }
          resolve(true);
        });
      } catch (_e) {
        resolve(false);
      }
    });
  }

  function incrementBlocked() {
    return load().then(function (data) {
      var m = mergeDefaults(data);
      var today = getTodayKey();
      if (m.blockedDate !== today) {
        m.blockedCountToday = 0;
        m.blockedDate = today;
      }
      m.blockedCountToday += 1;
      return save(m).then(function (ok) {
        return { ok: ok, data: m };
      });
    });
  }

  function setEnabledFlag(v) {
    return load().then(function (data) {
      var n = mergeDefaults(data);
      n.enabled = !!v;
      return save(n);
    });
  }

  chrome.runtime.onInstalled.addListener(function () {
    load().then(function (data) {
      return save(data);
    });
  });

  chrome.runtime.onMessage.addListener(function (msg, _sender, sendResponse) {
    if (!msg || typeof msg !== "object") {
      sendResponse({ ok: false });
      return false;
    }

    if (msg.type === "FOCUSTUBE_GET") {
      load()
        .then(function (data) {
          sendResponse({ ok: true, data: data });
        })
        .catch(function () {
          sendResponse({ ok: true, data: mergeDefaults({}) });
        });
      return true;
    }

    if (msg.type === "FOCUSTUBE_SET_ENABLED") {
      setEnabledFlag(!!msg.enabled)
        .then(function (ok) {
          return load().then(function (data) {
            sendResponse({ ok: ok, data: data });
          });
        })
        .catch(function () {
          sendResponse({ ok: false });
        });
      return true;
    }

    if (msg.type === "FOCUSTUBE_INCREMENT") {
      incrementBlocked()
        .then(function (r) {
          sendResponse({ ok: r.ok, data: r.data });
        })
        .catch(function () {
          sendResponse({ ok: false });
        });
      return true;
    }

    sendResponse({ ok: false });
    return false;
  });
})();
