(async () => {
  "use strict";

  console.log("Starting Steam Family Library Extraction...");
  console.log("Scrolling the page to load all games. Please keep this tab focused and wait...");

  const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const libraryData = new Map();

  window.scrollTo(0, 0);
  await delay(1000);

  const parseCurrentDOM = () => {
    const sectionEls = document.querySelectorAll("._1o7lKXffOJjZ_CpH1bHfY-");
    if (!sectionEls.length) return false;

    for (const sectionEl of sectionEls) {
      const headerEl = sectionEl.querySelector(".LP9H7bBiPB8N8jFzCQumL");
      const category = headerEl?.querySelector("._1M5eDPxFjv1ByJEK38h5Tu")?.textContent.trim() ?? "Unknown";
      const countText = headerEl?.querySelector("._3x604kYqXRJbqWmeLWAHrj")?.textContent.trim() ?? "0 Titles";
      const declaredCount = parseInt(countText, 10) || 0;

      if (!libraryData.has(category)) {
        libraryData.set(category, { declaredCount, games: new Map() });
      }
      
      const categoryData = libraryData.get(category);
      if (declaredCount > categoryData.declaredCount) {
         categoryData.declaredCount = declaredCount;
      }

      const tileEls = sectionEl.querySelectorAll('[data-key="hover div"]');
      for (const tile of tileEls) {
        const img = tile.querySelector("img");
        if (!img) continue;

        const name = img.alt.trim();
        if (!name) continue;

        const isUnavailable = img.src.includes("defaultappimage") || !!tile.querySelector("._1tVCPhzTgmUpMpErm-4mHX");
        const badgeEl = tile.querySelector(".OchtG0jyJQXcr2o0t34q7");
        const owners = badgeEl ? parseInt(badgeEl.textContent, 10) || null : null;
        const linkEl = tile.querySelector("a[href*='store.steampowered.com/app/']");
        const storeUrl = linkEl?.href ?? null;

        if (!categoryData.games.has(name)) {
            categoryData.games.set(name, {
                name,
                ...(isUnavailable && { unavailable: true }),
                ...(owners && { familyOwners: owners }),
                ...(storeUrl && { storeUrl }),
            });
        }
      }
    }
    return true;
  };

  let previousTotal = 0;
  let unchangedScrolls = 0;
  const MAX_UNCHANGED_SCROLLS = 12; 

  while (unchangedScrolls < MAX_UNCHANGED_SCROLLS) {
    const foundSections = parseCurrentDOM();
    
    if (!foundSections && previousTotal === 0) {
        console.error(
          "No library sections found. Make sure you're on the Library tab:\n" +
          "https://store.steampowered.com/account/familymanagement?tab=library"
        );
        return;
    }

    let currentTotal = 0;
    for (const data of libraryData.values()) {
        currentTotal += data.games.size;
    }

    if (currentTotal > previousTotal) {
        console.log(`Found ${currentTotal} games so far... scrolling down.`);
        previousTotal = currentTotal;
        unchangedScrolls = 0;
    } else {
        unchangedScrolls++;
    }

    window.scrollBy(0, 1000);
    await delay(600);
    
    if (unchangedScrolls > 5) {
        window.scrollBy(0, -300);
        await delay(150);
        window.scrollBy(0, 300);
    }
  }
  
  console.log("Reached the bottom. Doing a final deep check to secure all games...");
  window.scrollTo(0, document.body.scrollHeight);
  await delay(2000);
  parseCurrentDOM();

  const sections = [];
  let totalFound = 0;

  for (const [category, data] of libraryData.entries()) {
      const gamesArray = Array.from(data.games.values());
      gamesArray.sort((a, b) => a.name.localeCompare(b.name));
      
      sections.push({
          category,
          declaredCount: data.declaredCount,
          found: gamesArray.length,
          games: gamesArray
      });
      totalFound += gamesArray.length;
  }

  const accountName = document.title.replace("'s Account", "").replace("Steam Family", "").trim() || "SteamFamily";

  const report = {
    account: accountName,
    extractedAt: new Date().toISOString(),
    totalGames: totalFound,
    sections,
  };

  console.log("\nSteam Family Library - Extraction Complete");
  console.log(`   Account:  ${report.account}`);
  console.log(`   Total:    ${totalFound} games\n`);

  for (const s of sections) {
    const mismatchWarning = s.found < s.declaredCount ? " (Some missing? Usually hidden or delisted games)" : "";
    console.log(`   ${s.category}  (${s.found} / ${s.declaredCount} declared)${mismatchWarning}`);
  }

  console.log("\n-- Full Game List --");
  for (const s of sections) {
    console.groupCollapsed(`${s.category} (${s.found})`);
    for (const g of s.games) {
      const tags = [
        g.unavailable ? "unavailable" : "",
        g.familyOwners ? `owners: ${g.familyOwners}` : "",
      ]
        .filter(Boolean)
        .join("  ");
      console.log(`  ${g.name}${tags ? "  " + tags : ""}`);
    }
    console.groupEnd();
  }

  const json = JSON.stringify(report, null, 2);

  try {
    await navigator.clipboard.writeText(json);
    console.log("\nFull JSON copied to clipboard!");
  } catch (e) {
    console.log("\nClipboard copy failed - rely on the file download instead.");
  }

  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const safeAccountName = report.account.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '');
  const a = Object.assign(document.createElement("a"), {
    href: url,
    download: `steam-family-library_${safeAccountName}_${Date.now()}.json`,
  });
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);

  console.log("JSON file downloaded.");
  console.log("\nTip: you can interactively explore the raw data object by typing __steamFamilyLibrary in the console.");

  globalThis.__steamFamilyLibrary = report;
})();