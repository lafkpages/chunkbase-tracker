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
  function log(...args) {
    console.log("[ChunkBase Tracker]", ...args);
  }

  function warn(...args) {
    console.warn("[ChunkBase Tracker]", ...args);
  }

  function error(...args) {
    console.error("[ChunkBase Tracker]", ...args);
  }

  const mcLocalApiUrl = "http://localhost:25566";

  // Icons
  const icons = {
    "map-pin-plus":
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-map-pin-plus-icon lucide-map-pin-plus"><path d="M19.914 11.105A7.298 7.298 0 0 0 20 10a8 8 0 0 0-16 0c0 4.993 5.539 10.193 7.399 11.799a1 1 0 0 0 1.202 0 32 32 0 0 0 .824-.738"/><circle cx="12" cy="10" r="3"/><path d="M16 18h6"/><path d="M19 15v6"/></svg>',
  };

  /**
   * @type {boolean}
   */
  let hasBaritone;
  /**
   * @type {boolean}
   */
  let hasXaerosMinimap;

  let didHookIntoCB3 = false;
  function hookIntoCB3() {
    if (didHookIntoCB3) {
      return;
    }

    if (typeof CB3TooltipManager === "undefined") {
      return;
    }

    const shouldHookIntoCB3TooltipManagerOnCanvasClick = hasBaritone;

    if (shouldHookIntoCB3TooltipManagerOnCanvasClick) {
      const _CB3TooltipManager_onCanvasClick = CB3TooltipManager.onCanvasClick;
      CB3TooltipManager.onCanvasClick = function (...args) {
        /**
         * @type {{
         *  hit: boolean;
         *  handled: boolean;
         * }}
         */
        const returnValue = _CB3TooltipManager_onCanvasClick.apply(this, args);

        if (returnValue.hit) {
          requestAnimationFrame(() => {
            const poiCopyBtn = document.querySelector(
              ".tippy-content button.poi-copy"
            );

            log("POI copy button found:", poiCopyBtn);

            const poiGoalBtn = document.createElement("button");
            poiGoalBtn.className = "poi-goal unstyled";
            poiGoalBtn.type = "button";
            poiGoalBtn.title = "Set as Baritone goal";
            poiGoalBtn.innerHTML = icons["map-pin-plus"];

            poiCopyBtn.insertAdjacentElement("beforebegin", poiGoalBtn);
          });
        }

        return returnValue;
      };

      log("Hooked into CB3TooltipManager.onCanvasClick");
    }

    didHookIntoCB3 = true;
  }

  (async () => {
    /**
     * @type {Record<string, string | undefined>}
     */
    const installedMods = await (
      await fetch(new URL("mods", mcLocalApiUrl))
    ).json();

    hasBaritone = !!installedMods.baritone;
    hasXaerosMinimap = !!installedMods.xaerominimap;

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
    style.textContent = /*css*/ `
      button.poi-goal {
        margin-left: 4px;
        width: 19px;
        height: 19px;
        padding: 2px;
        position: relative;
        top: 2px;
        color: #2a1fff;
      }

      button.poi-goal * {
        pointer-events: none;
      }

      button.poi-copy {
        margin-left: 0px !important;
      }
    `;
    document.head.appendChild(style);

    /**
     * @type {EventSource | null}
     */
    let playerPositionStream = null;

    followPlayerControlsInput.addEventListener("input", () => {
      if (followPlayerControlsInput.checked) {
        playerPositionStream = new EventSource(
          new URL("player/position/stream", mcLocalApiUrl)
        );

        followPlayerControlsInput.disabled = true;
        goBtn.disabled = true;

        const enable = () => {
          followPlayerControlsInput.disabled = false;

          if (playerPositionStream.readyState === playerPositionStream.CLOSED) {
            playerPositionStream = null;
            goBtn.disabled = false;
            return;
          }

          playerPositionStream.onopen = null;
          playerPositionStream.onerror = null;
        };
        playerPositionStream.onopen = enable;
        playerPositionStream.onerror = enable;

        initPosSse();
      } else {
        playerPositionStream.close();
        playerPositionStream = null;

        goBtn.disabled = false;
      }
    });

    function initPosSse() {
      playerPositionStream.addEventListener("open", () => {
        log("SSE connection established");
      });

      playerPositionStream.addEventListener("message", (e) => {
        const [, x, y, z] = e.data.match(
          /\(\s*(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)\s*\)/
        );

        log("Received pos:", x, y, z);

        const X = appHelpers.toLong(Math.round(parseFloat(x)).toString());
        const Z = appHelpers.toLong(Math.round(parseFloat(z)).toString());

        CB3FinderApp.triggerHandler("goto", [X, Z]);
      });

      playerPositionStream.addEventListener("changeworld", (e) => {
        if (!e.data.startsWith("minecraft:")) {
          warn("Received invalid world:", e.data);
          return;
        }

        const dimension = e.data
          .toLowerCase()
          .replace(/^minecraft:(the_)?/, "");

        log("Received world:", e.data, dimension);

        CB3FinderApp.triggerHandler("dimensionchanged", [dimension]);
      });
    }

    hookIntoCB3();
    window.addEventListener("load", hookIntoCB3);

    document.addEventListener("click", (e) => {
      if (e.target.matches("button.poi-goal")) {
        /**
         * @type {HTMLButtonElement}
         */
        const poiGoalBtn = e.target;

        const coordsText = poiGoalBtn.previousSibling.textContent;
        const coords = coordsText.match(/(-?\d+)/g);
        const baritoneCommand = `#goal ${coords.join(" ")}`;

        log("Sending Baritone command:", baritoneCommand);

        fetch(new URL("chat/messages", mcLocalApiUrl), {
          method: "POST",
          body: baritoneCommand,
        });
      }
    });
  })().catch((err) => {
    error(err);
    alert(
      "An error occurred while running Chunk Base Tracker. Please check the console for more details."
    );
  });
})();
