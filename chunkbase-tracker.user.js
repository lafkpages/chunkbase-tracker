// ==UserScript==
// @name         ChunkBase Tracker
// @namespace    https://luisafk.dev
// @version      v1.0.0
// @description  Have the ChunkBase map update automatically to follow you in-game
// @author       LuisAFK
// @match        https://www.chunkbase.com/apps/seed-map
// @icon         https://www.google.com/s2/favicons?sz=64&domain=chunkbase.com
// @grant        none
// ==/UserScript==

(() => {
  const sse = new EventSource("http://localhost:25566/pos/sse");

  sse.addEventListener("message", (e) => {
    const [, x, y, z] = e.data.match(
      /\(\s*(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)\s*\)/
    );

    console.log("Received pos:", x, y, z);

    const X = appHelpers.toLong(Math.round(parseFloat(x)).toString());
    const Z = appHelpers.toLong(Math.round(parseFloat(z)).toString());

    CB3FinderApp.triggerHandler("goto", [X, Z]);
  });

  sse.addEventListener("changeworld", (e) => {
    if (!e.data.startsWith("minecraft:")) {
      console.warn("Received invalid world:", e.data);
      return;
    }

    const dimension = e.data.toLowerCase().replace(/^minecraft:(the_)?/, "");

    console.log("Received world:", e.data, dimension);

    CB3FinderApp.triggerHandler("dimensionchanged", [dimension]);
  });
})();
