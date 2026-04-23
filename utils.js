/**
 * Shared helpers for FocusTube (content + inline patterns).
 * Loaded before content.js; lives on global `FocusTubeUtils`.
 */
(function () {
  "use strict";

  var DEFAULTS = {
    enabled: true,
    blockedDate: "",
    blockedCountToday: 0,
  };

  /**
   * @param {function(): void} fn
   * @param {number} waitMs
   * @returns {function(): void}
   */
  function debounce(fn, waitMs) {
    var t = null;
    return function () {
      var self = this;
      var args = arguments;
      if (t) clearTimeout(t);
      t = setTimeout(function () {
        t = null;
        fn.apply(self, args);
      }, waitMs);
    };
  }

  /**
   * @param {string} path
   * @returns {boolean}
   */
  function isShortsPath(path) {
    if (!path) return false;
    var p = path;
    if (p.indexOf("/") !== 0) p = "/" + p;
    return p === "/shorts" || p.indexOf("/shorts/") === 0 || p.indexOf("/feed/shorts") === 0;
  }

  /**
   * Extract 11-char video id from /shorts/ID if present.
   * @param {string} path
   * @returns {string | null}
   */
  function getShortsVideoId(path) {
    var m = (path || "").match(/\/shorts\/([a-zA-Z0-9_-]{11})(?:[/?#]|$)/);
    return m ? m[1] : null;
  }

  /**
   * @param {string} ymd
   * @returns {string}
   */
  function nextLocalDayKey(ymd) {
    var p = (ymd || "").split("-");
    if (p.length !== 3) return ymd;
    var y = parseInt(p[0], 10);
    var m = parseInt(p[1], 10) - 1;
    var d = parseInt(p[2], 10);
    var date = new Date(y, m, d);
    date.setDate(date.getDate() + 1);
    var mm = (date.getMonth() + 1).toString().padStart(2, "0");
    var dd = date.getDate().toString().padStart(2, "0");
    return date.getFullYear() + "-" + mm + "-" + dd;
  }

  function todayKey() {
    var n = new Date();
    return (
      n.getFullYear() + "-" + String(n.getMonth() + 1).padStart(2, "0") + "-" + String(n.getDate()).padStart(2, "0")
    );
  }

  window.FocusTubeUtils = {
    debounce: debounce,
    isShortsPath: isShortsPath,
    getShortsVideoId: getShortsVideoId,
    todayKey: todayKey,
    nextLocalDayKey: nextLocalDayKey,
    DEFAULTS: DEFAULTS,
  };
})();
