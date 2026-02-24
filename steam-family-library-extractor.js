(async () => {
  "use strict";

  console.log("Loading your Steam Family library...");

  const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const libraryData = new Map();

  // Ensure we start at the top
  window.scrollTo(0, 0);
  await delay(1000);

  // --- NEW: Automatically click all "Show All" buttons ---
  console.log("Looking for 'Show All' buttons to expand your lists...");
  let clickedCount = 0;
  
  // We check every element on the page. If its exact text is "Show All" 
  // and it's the deepest element (no children), we click it.
  for (const el of document.querySelectorAll('*')) {
    if (el.textContent.trim() === "Show All" && el.children.length === 0) {
      el.click();
      clickedCount++;
    }
  }

  if (clickedCount > 0) {
    console.log(`Successfully clicked ${clickedCount} "Show All" buttons! Waiting a moment for the games to load...`);
    await delay(3000); // Give the page 3 seconds to fetch and render the expanded lists
  } else {
    console.log("No 'Show All' buttons found. They might already be expanded!");
  }

  console.log("Scrolling through the page. Just hang tight and keep this tab open.");

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

        if (!categoryData.games.has(name)) {
            categoryData.games.set(name, {
                name,
                ...(isUnavailable && { unavailable: true }),
                ...(owners && { familyOwners: owners }),
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
          "Couldn't find any games. Are you sure you're on the right page?\n" +
          "Head to: https://store.steampowered.com/account/familymanagement?tab=library"
        );
        return;
    }

    let currentTotal = 0;
    for (const data of libraryData.values()) {
        currentTotal += data.games.size;
    }

    if (currentTotal > previousTotal) {
        console.log(`Found ${currentTotal} games so far, still scrolling...`);
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
  
  console.log("Hit the bottom! Putting together your list...");
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
  const cleanAccountName = accountName.replace(/[^a-zA-Z0-9 ]/g, '').trim();

  const d = new Date();
  const displayDate = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
  const fileDate = `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;

  let textOutput = `Steam Library: ${cleanAccountName}\n`;
  textOutput += `Date: ${displayDate}\n`;
  textOutput += `Total Games: ${totalFound}\n\n`;

  for (const s of sections) {
    textOutput += `--- ${s.category.toUpperCase()} (${s.found} games) ---\n`;
    for (const g of s.games) {
      const tags = [];
      if (g.unavailable) tags.push("Unavailable");
      if (g.familyOwners) tags.push(`Owners: ${g.familyOwners}`);
      
      const tagString = tags.length > 0 ? ` [${tags.join(" | ")}]` : "";
      textOutput += `• ${g.name}${tagString}\n`;
    }
    textOutput += `\n`;
  }

  console.log("\nAll done!");
  console.log(`Account: ${cleanAccountName}`);
  console.log(`Total games found: ${totalFound}\n`);

  try {
    await navigator.clipboard.writeText(textOutput);
    console.log("Copied the formatted list to your clipboard!");
  } catch (e) {
    console.log("Couldn't copy to clipboard, but the file download should work.");
  }

  const blob = new Blob([textOutput], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement("a"), {
    href: url,
    download: `Library ${cleanAccountName} ${fileDate}.txt`,
  });
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);

  console.log("Downloaded your library text file.");
})();
