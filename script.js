// ============================================================
// Space Explorer — script.js
//
// API SPLIT:
//  ONE call to SEARCH_BASE (NASA Image Library) per query.
//  results[0]    → LEFT  panel: featured image + details
//  results[1..N] → RIGHT panel: 2-col image cards (query-relevant)
//
// KEY BEHAVIOURS:
//  • AbortController cancels stale in-flight requests
//  • No auto-search-on-keystroke (only button + Enter trigger)
//  • All API data set via textContent — no innerHTML XSS risk
// ============================================================


// ---- CONFIG ----
const API_KEY     = "anTw6c7FrsLYGyOqEz9mzaly1aJefNGTphSVuvFy";
const SEARCH_BASE = "https://images-api.nasa.gov/search";
const MAX_RESULTS = 13; // 1 featured + 12 cards

const EXPLORE_KEYWORDS = [
  "galaxy", "nebula", "mars", "saturn", "jupiter", "moon",
  "aurora", "comet", "supernova", "asteroid",
  "milky way", "black hole", "solar system", "space station"
];

// Tracks the active fetch so we can cancel stale requests
let activeController = null;


// ---- ELEMENT REFERENCES ----

// Left panel blocks
const heroCopyEl      = document.getElementById("hero-copy");
const defaultBlockEl  = document.getElementById("default-block");
const featuredBlockEl = document.getElementById("featured-block");
const resetBtnEl      = document.getElementById("reset-btn");
const metaTopicEl     = document.getElementById("meta-topic");

// Left panel — featured state elements
const featuredImgEl       = document.getElementById("featured-img");
const heroEyebrowSearchEl = document.getElementById("hero-eyebrow-search");
const heroTitleSearchEl   = document.getElementById("hero-title-search");
const heroDescSearchEl    = document.getElementById("hero-desc-search");
const featTopicEl         = document.getElementById("feat-topic");
const featDateEl          = document.getElementById("feat-date");
const featCenterEl        = document.getElementById("feat-center");

// Right panel
const planetViewEl    = document.getElementById("planet-view");
const exploreBtnEl    = document.getElementById("explore-btn");
const exploreAgainEl  = document.getElementById("explore-again-btn");
const resultsViewEl   = document.getElementById("results-view");
const resultsLabelEl  = document.getElementById("results-label");
const searchLoadingEl = document.getElementById("search-loading");
const searchErrorEl   = document.getElementById("search-error");
const searchResultsEl = document.getElementById("search-results");

// Navbar
const searchInputEl = document.getElementById("search-input");
const searchBtnEl   = document.getElementById("search-btn");


// ============================================================
// EVENT LISTENERS
//   • Explore buttons → random topic
//   • Search button + Enter → query from input
//   • NO auto-search-on-input (avoids API spam)
//   • ← Back → restore default
// ============================================================
exploreBtnEl.addEventListener("click",  revealExplore);
exploreAgainEl.addEventListener("click", revealExplore);
searchBtnEl.addEventListener("click",   handleSearch);
resetBtnEl.addEventListener("click",    resetToDefault);

searchInputEl.addEventListener("keydown", function (e) {
  if (e.key === "Enter") handleSearch();
});


// ============================================================
// EXPLORE — picks a random keyword each click
// ============================================================
function revealExplore() {
  const keyword = EXPLORE_KEYWORDS[Math.floor(Math.random() * EXPLORE_KEYWORDS.length)];
  // Fill search box so user sees what was explored
  searchInputEl.value = keyword;
  startSearch(keyword);
}


// ============================================================
// HANDLE SEARCH — reads typed query
// ============================================================
function handleSearch() {
  const query = searchInputEl.value.trim();
  if (!query) { searchInputEl.focus(); return; }
  startSearch(query);
}


// ============================================================
// START SEARCH — single entry point
// ============================================================
function startSearch(query) {
  // Cancel any in-flight request from a previous search
  if (activeController) {
    activeController.abort();
  }
  activeController = new AbortController();

  // Right panel: switch to results + spinner
  planetViewEl.style.display    = "none";
  resultsViewEl.style.display   = "flex";
  resultsLabelEl.textContent    = query;
  searchLoadingEl.style.display = "flex";
  searchErrorEl.style.display   = "none";
  searchResultsEl.innerHTML     = "";

  // Left panel: show ← Back + featured block (loading state)
  resetBtnEl.style.display      = "inline-flex";
  heroCopyEl.classList.add("hero-copy--searching");   // removes top gap
  defaultBlockEl.style.display  = "none";
  featuredBlockEl.style.display = "flex";

  // Pre-fill with loading indicators
  featuredImgEl.src               = "";
  heroEyebrowSearchEl.textContent = query;
  heroTitleSearchEl.textContent   = "Loading…";
  heroDescSearchEl.textContent    = "";
  if (featTopicEl)  featTopicEl.textContent  = query;
  if (featDateEl)   featDateEl.textContent   = "—";
  if (featCenterEl) featCenterEl.textContent = "—";
  if (metaTopicEl)  metaTopicEl.textContent  = query;

  // Single API call — results split between left (featured) and right (cards)
  fetchResults(query, activeController.signal);
}


// ============================================================
// FETCH RESULTS — ONE call, query-relevant on both sides
//   HOF chain: .filter() → .sort() → .slice()
// ============================================================
function fetchResults(query, signal) {
  const url = SEARCH_BASE
    + "?q="         + encodeURIComponent(query)
    + "&media_type=image"
    + "&page_size=40";

  fetch(url, { signal: signal })
    .then(function (res) {
      if (!res.ok) throw new Error("API error " + res.status);
      return res.json();
    })
    .then(function (data) {
      searchLoadingEl.style.display = "none";

      const raw = data.collection.items;

      // STEP 1 — filter: only items with a valid thumbnail
      const withImages = raw.filter(function (item) {
        return item.links && item.links.length > 0 && item.links[0].href;
      });

      // STEP 2 — sort: A → Z by title
      const sorted = withImages.sort(function (a, b) {
        const tA = (a.data[0].title || "").toLowerCase();
        const tB = (b.data[0].title || "").toLowerCase();
        return tA < tB ? -1 : tA > tB ? 1 : 0;
      });

      // STEP 3 — slice: cap total
      const results = sorted.slice(0, MAX_RESULTS);

      if (results.length === 0) {
        heroTitleSearchEl.textContent = "No results found";
        heroDescSearchEl.textContent  = 'Try a different keyword instead of "' + query + '".';
        return;
      }

      // First → LEFT featured panel
      showFeatured(query, results[0]);

      // Rest → RIGHT cards (all query-relevant)
      results.slice(1).forEach(function (item) {
        const card = buildCard(item);
        if (card) searchResultsEl.appendChild(card);
      });
    })
    .catch(function (err) {
      if (err.name === "AbortError") return; // stale request cancelled — ignore
      console.error("Search failed:", err);
      searchLoadingEl.style.display = "none";
      searchErrorEl.style.display   = "block";
      searchErrorEl.textContent     = "⚠️ Search failed. Check your connection and try again.";
      heroTitleSearchEl.textContent = "⚠️ Could not load results.";
      heroDescSearchEl.textContent  = "";
    });
}


// ============================================================
// SHOW FEATURED — fills LEFT panel with first result
// ============================================================
function showFeatured(query, item) {
  const meta  = item.data[0];
  const thumb = item.links[0];

  // Image
  featuredImgEl.src = thumb.href;
  featuredImgEl.alt = meta.title || query;

  // Text
  heroEyebrowSearchEl.textContent = query;
  heroTitleSearchEl.textContent   = meta.title       || query;
  heroDescSearchEl.textContent    = meta.description || "";

  // Info cards
  if (featTopicEl) featTopicEl.textContent = query;

  if (featDateEl && meta.date_created) {
    try {
      var d = new Date(meta.date_created);
      featDateEl.textContent = d.toLocaleDateString("en-US", {
        year: "numeric", month: "long", day: "numeric"
      });
    } catch (e) {
      featDateEl.textContent = meta.date_created;
    }
  }

  if (featCenterEl) {
    featCenterEl.textContent = meta.center || meta.secondary_creator || "NASA";
  }
}


// ============================================================
// BUILD CARD — safe DOM construction (no innerHTML for API data)
// ============================================================
function buildCard(item) {
  const meta  = item.data[0];
  const thumb = item.links[0];

  const title = meta.title       || "Untitled";
  const desc  = meta.description || "";

  // Create elements manually — textContent for all API data (XSS-safe)
  const card = document.createElement("div");
  card.className = "result-card";

  const img = document.createElement("img");
  img.src     = thumb.href;
  img.alt     = title;
  img.loading = "lazy";

  const body = document.createElement("div");
  body.className = "result-copy";

  const badge = document.createElement("span");
  badge.className   = "result-badge";
  badge.textContent = "NASA";

  const h3 = document.createElement("h3");
  h3.textContent = title;

  const p = document.createElement("p");
  p.textContent = desc;

  body.appendChild(badge);
  body.appendChild(h3);
  body.appendChild(p);

  card.appendChild(img);
  card.appendChild(body);

  return card;
}


// ============================================================
// RESET TO DEFAULT — ← Back
// ============================================================
function resetToDefault() {
  // Cancel any in-flight request
  if (activeController) {
    activeController.abort();
    activeController = null;
  }

  // Restore left panel
  heroCopyEl.classList.remove("hero-copy--searching");
  featuredBlockEl.style.display = "none";
  defaultBlockEl.style.display  = "block";
  featuredImgEl.src             = "";
  resetBtnEl.style.display      = "none";

  // Restore right panel
  resultsViewEl.style.display = "none";
  planetViewEl.style.display  = "flex";

  // Clear input
  searchInputEl.value = "";
}