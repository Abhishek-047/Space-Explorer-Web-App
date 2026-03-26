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
// FETCH RESULTS — DUAL API (parallel)
//   NASA Image Library → LEFT featured + some RIGHT cards
//   NASA APOD (api_key) → mixed into RIGHT cards
// ============================================================
function fetchResults(query, signal) {

  // API 1: NASA Image Library (no key needed)
  const imageUrl = SEARCH_BASE
    + "?q="         + encodeURIComponent(query)
    + "&media_type=image"
    + "&page_size=40";

  // API 2: NASA APOD — uses your API_KEY, fetches 6 random APODs
  const apodUrl = "https://api.nasa.gov/planetary/apod"
    + "?api_key=" + API_KEY
    + "&count=6";

  // Fire both in parallel
  Promise.all([
    fetch(imageUrl, { signal: signal })
      .then(function (res) {
        if (!res.ok) throw new Error("Image API error " + res.status);
        return res.json();
      }),
    fetch(apodUrl, { signal: signal })
      .then(function (res) { return res.ok ? res.json() : []; })
      .catch(function () { return []; }) // APOD failure never kills whole search
  ])
  .then(function (results) {
    var imageData = results[0];
    var apodData  = results[1];

    searchLoadingEl.style.display = "none";

    var raw = imageData.collection.items;

    // Filter → only items with a valid thumbnail
    var withImages = raw.filter(function (item) {
      return item.links && item.links.length > 0 && item.links[0].href;
    });

    // Sort A → Z by title
    var sorted = withImages.sort(function (a, b) {
      var tA = (a.data[0].title || "").toLowerCase();
      var tB = (b.data[0].title || "").toLowerCase();
      return tA < tB ? -1 : tA > tB ? 1 : 0;
    });

    // Cap total & take first for featured
    var capped = sorted.slice(0, MAX_RESULTS);

    if (capped.length === 0) {
      heroTitleSearchEl.textContent = "No results found";
      heroDescSearchEl.textContent  = 'Try a different keyword instead of "' + query + '".';
      return;
    }

    // results[0] → LEFT featured panel
    showFeatured(query, capped[0]);

    // RIGHT panel: interleave Image Library cards + APOD cards
    var imgCards  = capped.slice(1);                                          // remaining image library
    var apodCards = Array.isArray(apodData)
      ? apodData.filter(function (a) { return a.media_type === "image" && a.url; })
      : [];

    var imgIdx = 0, apodIdx = 0, count = 0, MAX_RIGHT = 12;

    while (count < MAX_RIGHT && (imgIdx < imgCards.length || apodIdx < apodCards.length)) {
      // Add one Image Library card
      if (imgIdx < imgCards.length && count < MAX_RIGHT) {
        var c1 = buildCard(imgCards[imgIdx++]);
        if (c1) { searchResultsEl.appendChild(c1); count++; }
      }
      // Add one APOD card
      if (apodIdx < apodCards.length && count < MAX_RIGHT) {
        var c2 = buildApodCard(apodCards[apodIdx++]);
        if (c2) { searchResultsEl.appendChild(c2); count++; }
      }
    }
  })
  .catch(function (err) {
    if (err.name === "AbortError") return;
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
// BUILD CARD — NASA Image Library card
// ============================================================
function buildCard(item) {
  var meta  = item.data[0];
  var thumb = item.links[0];

  var title = meta.title       || "Untitled";
  var desc  = meta.description || "";

  var card = document.createElement("div");
  card.className = "result-card";

  var img = document.createElement("img");
  img.src     = thumb.href;
  img.alt     = title;
  img.loading = "lazy";

  var body = document.createElement("div");
  body.className = "result-copy";

  var badge = document.createElement("span");
  badge.className   = "result-badge";
  badge.textContent = "NASA";

  var h3 = document.createElement("h3");
  h3.textContent = title;

  var p = document.createElement("p");
  p.textContent = desc;

  body.appendChild(badge);
  body.appendChild(h3);
  body.appendChild(p);
  card.appendChild(img);
  card.appendChild(body);

  return card;
}


// ============================================================
// BUILD APOD CARD — NASA APOD API card (uses your API_KEY)
// ============================================================
function buildApodCard(apod) {
  if (!apod || !apod.url) return null;

  var card = document.createElement("div");
  card.className = "result-card";

  var img = document.createElement("img");
  img.src     = apod.hdurl || apod.url;
  img.alt     = apod.title || "APOD";
  img.loading = "lazy";
  img.onerror = function () { this.src = apod.url; }; // fallback to SD

  var body = document.createElement("div");
  body.className = "result-copy";

  var badge = document.createElement("span");
  badge.className   = "result-badge apod-badge";
  badge.textContent = "APOD";

  var h3 = document.createElement("h3");
  h3.textContent = apod.title || "Astronomy Picture";

  var p = document.createElement("p");
  p.textContent = apod.explanation || "";

  body.appendChild(badge);
  body.appendChild(h3);
  body.appendChild(p);
  card.appendChild(img);
  card.appendChild(body);

  return card;
}


// ============================================================
// RESET TO DEFAULT — ← Back → goes back to landing hero
// ============================================================
function resetToDefault() {
  // Cancel any in-flight request
  if (activeController) {
    activeController.abort();
    activeController = null;
  }

  // Restore left panel state (for next time app is shown)
  heroCopyEl.classList.remove("hero-copy--searching");
  featuredBlockEl.style.display = "none";
  defaultBlockEl.style.display  = "block";
  featuredImgEl.src             = "";
  resetBtnEl.style.display      = "none";

  // Restore right panel state
  resultsViewEl.style.display = "none";
  planetViewEl.style.display  = "flex";

  // Clear input
  searchInputEl.value = "";

  // ── Return to landing hero ──
  var appWrapperEl  = document.getElementById("app-wrapper");
  var landingHeroEl = document.getElementById("landing-hero");

  if (appWrapperEl && landingHeroEl) {
    // Fade out the app
    appWrapperEl.style.animation = "heroExit 0.4s ease forwards";

    setTimeout(function () {
      appWrapperEl.style.display    = "none";
      appWrapperEl.style.animation  = "";
      appWrapperEl.classList.remove("app-wrapper--enter");

      // Restore and fade in the landing hero
      landingHeroEl.style.display = "flex";
      landingHeroEl.classList.remove("landing-hero--exit");
      landingHeroEl.style.opacity = "0";
      landingHeroEl.style.animation = "appEnter 0.5s ease forwards";

      // Clean up inline style after animation
      setTimeout(function () {
        landingHeroEl.style.animation = "";
        landingHeroEl.style.opacity   = "";
      }, 520);
    }, 380);
  }
}


// ============================================================
// LANDING HERO — wires CTA to existing explore logic
// ============================================================
(function () {
  var landingHeroEl  = document.getElementById("landing-hero");
  var appWrapperEl   = document.getElementById("app-wrapper");
  var landingExplore = document.getElementById("landing-explore-btn");

  if (!landingExplore || !landingHeroEl || !appWrapperEl) return;

  function transitionToApp() {
    // Play exit animation on hero
    landingHeroEl.classList.add("landing-hero--exit");

    setTimeout(function () {
      // Hide hero, reveal app
      landingHeroEl.style.display = "none";
      appWrapperEl.style.display  = "block";
      appWrapperEl.classList.add("app-wrapper--enter");

      // Trigger the existing Explore function (random keyword)
      revealExplore();
    }, 580); // matches CSS animation duration
  }

  landingExplore.addEventListener("click", transitionToApp);
})();