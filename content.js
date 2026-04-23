/**
 * YouTube: block Shorts URLs, hide UI, SPA-aware (MutationObserver + URL check).
 */
(function () {
  "use strict";

  var U = window.FocusTubeUtils;
  if (!U) return;

  var DEBUG = false;
  var log = function () {
    if (DEBUG) console.log.apply(console, ["[FocusTube]"].concat([].slice.call(arguments)));
  };

  var OBSERVER_MS = 180;
  var URL_POLL_MS = 450;
  var STORAGE_KEY = "focusTube";

  var state = {
    lastHref: location.href,
    settings: { enabled: true, blockedDate: "", blockedCountToday: 0 },
    observer: null,
    urlTimer: null,
  };

  function getMergeDefaults() {
    return { enabled: true, blockedDate: "", blockedCountToday: 0 };
  }

  function mergeStored(raw) {
    var d = getMergeDefaults();
    if (!raw || typeof raw !== "object") {
      d.blockedDate = U.todayKey();
      return d;
    }
    d.enabled = raw.enabled !== false;
    d.blockedCountToday = typeof raw.blockedCountToday === "number" && raw.blockedCountToday >= 0
      ? raw.blockedCountToday
      : 0;
    d.blockedDate = typeof raw.blockedDate === "string" && raw.blockedDate
      ? raw.blockedDate
      : U.todayKey();
    if (d.blockedDate !== U.todayKey()) {
      d.blockedCountToday = 0;
      d.blockedDate = U.todayKey();
    }
    return d;
  }

  /**
   * @returns {Promise<Object>}
   */
  function loadSettings() {
    return new Promise(function (resolve) {
      try {
        chrome.storage.local.get(STORAGE_KEY, function (o) {
          if (chrome.runtime && chrome.runtime.lastError) {
            resolve(mergeStored(null));
            return;
          }
          var v = o && o[STORAGE_KEY];
          resolve(mergeStored(v));
        });
      } catch (_e) {
        resolve(mergeStored(null));
      }
    });
  }

  function saveSettings(patch) {
    return loadSettings().then(function (cur) {
      var n = { enabled: cur.enabled, blockedDate: cur.blockedDate, blockedCountToday: cur.blockedCountToday };
      if (patch && typeof patch === "object") {
        if ("enabled" in patch) n.enabled = !!patch.enabled;
        if ("blockedDate" in patch) n.blockedDate = patch.blockedDate;
        if ("blockedCountToday" in patch) n.blockedCountToday = patch.blockedCountToday;
      }
      return new Promise(function (resolve) {
        var payload = {};
        payload[STORAGE_KEY] = n;
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
    });
  }

  function notifyBackgroundIncrement() {
    return new Promise(function (resolve) {
      try {
        if (!chrome.runtime || !chrome.runtime.id) {
          resolve(false);
          return;
        }
        chrome.runtime.sendMessage({ type: "FOCUSTUBE_INCREMENT" }, function (r) {
          if (chrome.runtime && chrome.runtime.lastError) {
            resolve(false);
            return;
          }
          resolve(!!(r && r.ok));
        });
      } catch (_e) {
        resolve(false);
      }
    });
  }

  function redirectShortsPage(settings) {
    if (!settings || !settings.enabled) return false;
    if (!U.isShortsPath(location.pathname)) return false;
    var id = U.getShortsVideoId(location.pathname);
    var dest = "https://www.youtube.com/";
    if (id) {
      var sp = new URLSearchParams();
      sp.set("v", id);
      dest = "https://www.youtube.com/watch?" + sp.toString();
    }
    if (location.href === dest) return false;
    notifyBackgroundIncrement();
    try {
      location.replace(dest);
    } catch (e) {
      log("redirect failed", e);
    }
    return true;
  }

  function setBodyClass(on) {
    var root = document.documentElement;
    if (on) root.classList.add("focustube-on");
    else root.classList.remove("focustube-on");
  }

  var SHELF_TITLE_HINTS = ["shorts", "short videos", "explore shorts", "短影片", "ショート"];

  function firstLine(s) {
    if (!s) return "";
    var m = s.split(/\r\n|\n|\r/);
    return (m[0] || s).replace(/\s+/g, " ").trim().toLowerCase();
  }

  /**
   * Only treat as a shelf *header* (not full description/comment text).
   * This avoids hiding ytd-structured-description when a paragraph starts with "Shorts…"
   */
  function textLooksLikeShortsHeader(t) {
    if (!t) return false;
    var s = t.replace(/\s+/g, " ").trim().toLowerCase();
    if (s.length > 80) {
      s = firstLine(s);
    }
    if (s.length > 80) {
      return false;
    }
    for (var i = 0; i < SHELF_TITLE_HINTS.length; i++) {
      if (s === SHELF_TITLE_HINTS[i] || s.indexOf("shorts") === 0) return true;
    }
    return s === "short" || s === "shorts";
  }

  var hiddenElements = new WeakSet();

  function hideByShelfTitle() {
    var q = "ytd-rich-shelf-renderer, ytd-rich-section-renderer, ytd-shelf-renderer";
    var list = document.querySelectorAll(q);
    for (var i = 0; i < list.length; i++) {
      var el = list[i];
      if (hiddenElements.has(el)) continue;
      if (el.closest("ytd-watch-flexy, ytd-structured-description, ytd-comments")) {
        continue;
      }
      var t = el.querySelector("#title, h2, ytd-rich-shelf-renderer h2, ytd-shelf-renderer h2, .title");
      if (!t) {
        continue;
      }
      var text = t.textContent;
      if (text && textLooksLikeShortsHeader(text) && t.closest("ytd-browse, ytd-two-column-browse-results-renderer, ytd-search, #primary")) {
        if (el.closest("ytd-watch-metadata")) continue;
        el.setAttribute("data-focustube", "1");
        el.style.setProperty("display", "none", "important");
        hiddenElements.add(el);
      }
    }
  }

  function hideShortsLinkCards() {
    var anchors = document.querySelectorAll(
      'a[href*="/shorts/"], a[href="/shorts"], a[href*="/feed/shorts"]'
    );
    for (var a = 0; a < anchors.length; a++) {
      var link = anchors[a];
      if (link.getAttribute("data-focustube-allow")) continue;
      if (link.closest("ytd-watch-flexy, ytd-engagement-panel-section-list-renderer")) continue;
      var item =
        link.closest("ytd-video-renderer, ytd-rich-item-renderer, ytd-compact-video-renderer, ytd-playlist-panel-renderer, ytd-playlist-thumbnail, ytd-rich-grid-media") || link.closest("li, ytd-reel-item-renderer");
      if (item) {
        item.setAttribute("data-focustube", "1");
        item.style.setProperty("display", "none", "important");
        hiddenElements.add(item);
      }
    }
  }

  function clearOurMarks() {
    var marked = document.querySelectorAll("[data-focustube='1']");
    for (var i = 0; i < marked.length; i++) {
      var el = marked[i];
      el.removeAttribute("data-focustube");
      if (el.style) el.style.removeProperty("display");
    }
  }

  function removeShortsShelves() {
    if (!state.settings || !state.settings.enabled) return;
    hideByShelfTitle();
    hideShortsLinkCards();
  }

  function hideShortsButtons() {
    if (!state.settings || !state.settings.enabled) return;
    var sels = [
      "ytd-guide-entry-renderer a#endpoint[href*='/shorts/']",
      "ytd-mini-guide-entry-renderer a#endpoint[href*='/shorts/']",
      "ytd-guide-entry-renderer a[href='/shorts']",
    ];
    for (var s = 0; s < sels.length; s++) {
      var set = document.querySelectorAll(sels[s]);
      for (var j = 0; j < set.length; j++) {
        var row = set[j].closest("ytd-guide-entry-renderer, ytd-mini-guide-entry-renderer, ytd-mweb-guide-renderer, ytd-mweb-mini-guide-renderer, tp-yt-paper-item");
        if (row) {
          row.setAttribute("data-focustube", "1");
          row.style.setProperty("display", "none", "important");
        }
      }
    }
  }

  function runHiddenPasses() {
    if (!state.settings || !state.settings.enabled) {
      return;
    }
    hideShortsButtons();
    removeShortsShelves();
  }

  var runHiddenPassesDebounced = U.debounce(runHiddenPasses, OBSERVER_MS);

  function applyEnabledUi() {
    if (!state.settings) return;
    if (state.settings.enabled) {
      setBodyClass(true);
      runHiddenPasses();
    } else {
      setBodyClass(false);
      clearOurMarks();
    }
  }

  function handleRouteChange() {
    if (state.lastHref === location.href) {
      return;
    }
    state.lastHref = location.href;
    loadSettings().then(function (s) {
      state.settings = s;
      if (redirectShortsPage(s)) return;
      applyEnabledUi();
    });
  }

  var pollUrl = U.debounce(function () {
    try {
      if (state.lastHref !== location.href) {
        handleRouteChange();
      }
    } catch (_e) {}
  }, 80);

  function startUrlObserver() {
    if (state.urlTimer) {
      return;
    }
    state.urlTimer = setInterval(pollUrl, URL_POLL_MS);
  }

  function onMutations() {
    runHiddenPassesDebounced();
  }

  function attachObserver() {
    if (state.observer) {
      return;
    }
    var target = document.documentElement;
    if (!target) {
      return;
    }
    try {
      var obs = new MutationObserver(function () {
        onMutations();
      });
      obs.observe(target, { childList: true, subtree: true });
      state.observer = obs;
    } catch (e) {
      log("observer", e);
    }
  }

  function detachObserver() {
    if (state.observer) {
      try {
        state.observer.disconnect();
      } catch (_e) {}
      state.observer = null;
    }
  }

  function stopObservers() {
    if (state.urlTimer) {
      try {
        clearInterval(state.urlTimer);
      } catch (_e) {}
      state.urlTimer = null;
    }
    detachObserver();
  }

  function onStorageChange(ch, area) {
    if (area !== "local" || !ch[STORAGE_KEY]) return;
    var nv = ch[STORAGE_KEY].newValue;
    if (!nv) return;
    state.settings = mergeStored(nv);
    if (state.settings.enabled) {
      if (redirectShortsPage(state.settings)) return;
      clearOurMarks();
      attachObserver();
      startUrlObserver();
    } else {
      stopObservers();
    }
    applyEnabledUi();
  }

  function init() {
    state.lastHref = location.href;
    loadSettings().then(function (s) {
      state.settings = s;
      if (redirectShortsPage(s)) {
        return;
      }
      if (s && s.enabled) {
        if (document.body) {
          applyEnabledUi();
        } else {
          document.addEventListener("DOMContentLoaded", applyEnabledUi, { once: true });
        }
        attachObserver();
        var boot = U.debounce(function () {
          runHiddenPasses();
        }, 200);
        boot();
        if (window.requestAnimationFrame) {
          requestAnimationFrame(boot);
        } else {
          setTimeout(boot, 0);
        }
        startUrlObserver();
      } else {
        setBodyClass(false);
      }
    });
    try {
      chrome.storage.onChanged.addListener(onStorageChange);
    } catch (_e) {}
  }

  init();
})();
