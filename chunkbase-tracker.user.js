// ==UserScript==
// @name         ChunkBase Tracker
// @namespace    https://luisafk.dev
// @version      v1.0.1
// @description  Have the ChunkBase map update automatically to follow you in-game
// @author       LuisAFK
// @match        https://www.chunkbase.com/apps/seed-map
// @icon         https://www.google.com/s2/favicons?sz=64&domain=chunkbase.com
// @grant        none
// @downloadURL  https://github.com/lafkpages/chunkbase-tracker/raw/refs/heads/main/chunkbase-tracker.user.js
// ==/UserScript==

(() => {
  // Add "Follow player" checkbox to the controls
  const controlsContainer = document.querySelector(
    "#seed-controls .fancy-box:first-of-type"
  );
  const followPlayerControls = document.createElement("div");
  followPlayerControls.className = "fancy-row";
  const followPlayerControlsLabel = document.createElement("label");
  followPlayerControlsLabel.className = "fancy-size";
  followPlayerControlsLabel.htmlFor = "cbt-follow-player";
  followPlayerControlsLabel.textContent = "Follow player:";
  const followPlayerControlsInputContainer = document.createElement("div");
  followPlayerControlsInputContainer.className = "fancy-inputs";
  const followPlayerControlsInput = document.createElement("input");
  followPlayerControlsInput.id = "cbt-follow-player";
  followPlayerControlsInput.type = "checkbox";
  followPlayerControlsInputContainer.appendChild(followPlayerControlsInput);
  followPlayerControls.appendChild(followPlayerControlsLabel);
  followPlayerControls.appendChild(followPlayerControlsInputContainer);
  controlsContainer.appendChild(followPlayerControls);

  // Element references
  /**
   * @type {HTMLButtonElement}
   */
  const goBtn = document.querySelector("#map-goto-go");

  // Inject styles
  const style = document.createElement("style");
  style.textContent = `
    
  `;
  document.head.appendChild(style);

  function log(...args) {
    console.log("[ChunkBase Tracker]", ...args);
  }

  function warn(...args) {
    console.warn("[ChunkBase Tracker]", ...args);
  }

  const mcLocalApiUrl = "http://localhost:25565";

  /**
   * @type {EventSource | null}
   */
  let posSse = null;

  followPlayerControlsInput.addEventListener("input", () => {
    if (followPlayerControlsInput.checked) {
      posSse = new EventSource(new URL("pos/sse", mcLocalApiUrl));

      followPlayerControlsInput.disabled = true;
      goBtn.disabled = true;

      const enable = () => {
        followPlayerControlsInput.disabled = false;

        if (posSse.readyState === posSse.CLOSED) {
          posSse = null;
          goBtn.disabled = false;
          return;
        }

        posSse.onopen = null;
        posSse.onerror = null;
      };
      posSse.onopen = enable;
      posSse.onerror = enable;

      initPosSse();
    } else {
      posSse.close();
      posSse = null;

      goBtn.disabled = false;
    }
  });

  function initPosSse() {
    posSse.addEventListener("open", () => {
      log("SSE connection established");
    });

    posSse.addEventListener("message", (e) => {
      const [, x, y, z] = e.data.match(
        /\(\s*(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)\s*\)/
      );

      log("Received pos:", x, y, z);

      const X = appHelpers.toLong(Math.round(parseFloat(x)).toString());
      const Z = appHelpers.toLong(Math.round(parseFloat(z)).toString());

      CB3FinderApp.triggerHandler("goto", [X, Z]);
    });

    posSse.addEventListener("changeworld", (e) => {
      if (!e.data.startsWith("minecraft:")) {
        warn("Received invalid world:", e.data);
        return;
      }

      const dimension = e.data.toLowerCase().replace(/^minecraft:(the_)?/, "");

      log("Received world:", e.data, dimension);

      CB3FinderApp.triggerHandler("dimensionchanged", [dimension]);
    });
  }
})();
