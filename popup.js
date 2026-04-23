(function () {
  "use strict";

  var toggle = document.getElementById("enabledToggle");
  var statusText = document.getElementById("statusText");
  var countToday = document.getElementById("countToday");
  if (!toggle || !statusText || !countToday) {
    return;
  }

  function setLabel(enabled) {
    if (enabled) {
      statusText.textContent = "On — Shorts are hidden and redirected";
    } else {
      statusText.textContent = "Off — YouTube is unchanged (Shorts visible)";
    }
  }

  function setCount(n) {
    if (typeof n === "number" && n >= 0) {
      countToday.textContent = String(n);
    } else {
      countToday.textContent = "0";
    }
  }

  function applyData(data) {
    if (!data) {
      return;
    }
    toggle.checked = data.enabled !== false;
    setLabel(toggle.checked);
    setCount(typeof data.blockedCountToday === "number" ? data.blockedCountToday : 0);
  }

  function getState() {
    return new Promise(function (resolve) {
      try {
        if (!chrome.runtime || !chrome.runtime.id) {
          setLabel(false);
          setCount(0);
          resolve();
          return;
        }
        chrome.runtime.sendMessage({ type: "FOCUSTUBE_GET" }, function (r) {
          if (chrome.runtime && chrome.runtime.lastError) {
            setLabel(!!(toggle && toggle.checked));
            setCount(0);
            resolve();
            return;
          }
          if (r && r.ok && r.data) {
            applyData(r.data);
          }
          resolve();
        });
      } catch (_e) {
        resolve();
      }
    });
  }

  function sendEnabled(v) {
    return new Promise(function (resolve) {
      try {
        if (!chrome.runtime || !chrome.runtime.id) {
          resolve(false);
          return;
        }
        chrome.runtime.sendMessage({ type: "FOCUSTUBE_SET_ENABLED", enabled: !!v }, function (r) {
          if (chrome.runtime && chrome.runtime.lastError) {
            resolve(false);
            return;
          }
          if (r && r.ok && r.data) {
            setLabel(r.data.enabled !== false);
            setCount(
              typeof r.data.blockedCountToday === "number" ? r.data.blockedCountToday : 0
            );
            resolve(true);
            return;
          }
          resolve(false);
        });
      } catch (_e) {
        resolve(false);
      }
    });
  }

  toggle.addEventListener("change", function () {
    var v = toggle.checked;
    sendEnabled(v);
  });

  try {
    if (chrome.storage && chrome.storage.onChanged) {
      chrome.storage.onChanged.addListener(function (ch, area) {
        if (area !== "local" || !ch.focusTube) {
          return;
        }
        var n = ch.focusTube.newValue;
        if (n) {
          applyData(n);
        } else {
          getState();
        }
      });
    }
  } catch (_e) {}

  getState();
})();
