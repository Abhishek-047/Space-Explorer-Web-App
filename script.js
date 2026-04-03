/* Space Explorer Script */

// My config
let API_KEY = "anTw6c7FrsLYGyOqEz9mzaly1aJefNGTphSVuvFy";
let SEARCH_BASE = "https://images-api.nasa.gov/search";

let exploreKeywords = [
  "galaxy", "nebula", "mars", "saturn", "jupiter", "moon",
  "aurora", "comet", "supernova", "asteroid",
  "milky way", "black hole", "solar system", "space station"
];

// Get elements for left panel
let heroCopyEl = document.getElementById("hero-copy");
let defaultBlockEl = document.getElementById("default-block");
let featuredBlockEl = document.getElementById("featured-block");
let resetBtnEl = document.getElementById("reset-btn");
let metaTopicEl = document.getElementById("meta-topic");

let featuredImgEl = document.getElementById("featured-img");
let heroEyebrowSearchEl = document.getElementById("hero-eyebrow-search");
let heroTitleSearchEl = document.getElementById("hero-title-search");
let heroDescSearchEl = document.getElementById("hero-desc-search");
let featTopicEl = document.getElementById("feat-topic");
let featDateEl = document.getElementById("feat-date");
let featCenterEl = document.getElementById("feat-center");

// Get elements for right panel
let planetViewEl = document.getElementById("planet-view");
let exploreBtnEl = document.getElementById("explore-btn");
let exploreAgainEl = document.getElementById("explore-again-btn");
let resultsViewEl = document.getElementById("results-view");
let resultsLabelEl = document.getElementById("results-label");
let searchLoadingEl = document.getElementById("search-loading");
let searchErrorEl = document.getElementById("search-error");
let searchResultsEl = document.getElementById("search-results");

// Navbar elements
let searchInputEl = document.getElementById("search-input");
let searchBtnEl = document.getElementById("search-btn");

// Sort element
let sortOptionsEl = document.getElementById("sort-options");

// Main array to store my results
let myResults = [];

// Adding event listeners
exploreBtnEl.addEventListener("click", revealExplore);
exploreAgainEl.addEventListener("click", revealExplore);
searchBtnEl.addEventListener("click", handleSearch);
resetBtnEl.addEventListener("click", resetToDefault);

searchInputEl.addEventListener("keydown", function (e) {
  if (e.key == "Enter") {
    handleSearch();
  }
});

// When dropdown changes, I update the cards
sortOptionsEl.addEventListener("change", function() {
    renderCards(myResults);
});

// Explore random space items
function revealExplore() {
  let randomIndex = Math.floor(Math.random() * exploreKeywords.length);
  let keyword = exploreKeywords[randomIndex];
  searchInputEl.value = keyword;
  startSearch(keyword);
}

// User clicked enter or button
function handleSearch() {
  let query = searchInputEl.value;
  if (query == "") {
    searchInputEl.focus();
    return;
  }
  startSearch(query);
}

function startSearch(query) {
  // Show right panel loading
  planetViewEl.style.display = "none";
  resultsViewEl.style.display = "flex";
  resultsLabelEl.textContent = query;
  searchLoadingEl.style.display = "flex";
  searchErrorEl.style.display = "none";
  searchResultsEl.innerHTML = "";
  
  // Set default sorting option again
  sortOptionsEl.value = "default";

  // Show left panel loading
  resetBtnEl.style.display = "inline-flex";
  heroCopyEl.classList.add("hero-copy--searching");
  defaultBlockEl.style.display = "none";
  featuredBlockEl.style.display = "flex";

  // Clear data first
  featuredImgEl.src = "";
  heroEyebrowSearchEl.textContent = query;
  heroTitleSearchEl.textContent = "Loading...";
  heroDescSearchEl.textContent = "";
  
  if (featTopicEl) {
      featTopicEl.textContent = query;
  }
  if (featDateEl) {
      featDateEl.textContent = "-";
  }
  if (featCenterEl) {
      featCenterEl.textContent = "-";
  }
  if (metaTopicEl) {
      metaTopicEl.textContent = query;
  }

  // Go to fetch 
  fetchResults(query);
}

function fetchResults(query) {
  let imageUrl = SEARCH_BASE + "?q=" + encodeURIComponent(query) + "&media_type=image&page_size=40";
  let apodUrl = "https://api.nasa.gov/planetary/apod?api_key=" + API_KEY + "&count=6";

  // Using fetch to get data from NASA APIs
  let imagePromise = fetch(imageUrl).then(function(res) { return res.json(); });
  let apodPromise = fetch(apodUrl).then(function(res) { return res.json(); }).catch(function() { return []; });

  Promise.all([imagePromise, apodPromise]).then(function(results) {
    let imageData = results[0];
    let apodData = results[1];

    searchLoadingEl.style.display = "none";

    let raw = imageData.collection.items;
    let withImages = [];

    // Loop through images from NASA
    for (let i = 0; i < raw.length; i++) {
        if (raw[i].links && raw[i].links.length > 0 && raw[i].links[0].href) {
            withImages.push(raw[i]);
        }
    }

    // Sort by name like original code
    withImages.sort(function(a, b) {
        let nameA = (a.data[0].title || "").toLowerCase();
        let nameB = (b.data[0].title || "").toLowerCase();
        if (nameA < nameB) return -1;
        if (nameA > nameB) return 1;
        return 0;
    });

    if (withImages.length == 0) {
      heroTitleSearchEl.textContent = "No results found";
      heroDescSearchEl.textContent = "Try a different keyword instead of " + query;
      return;
    }

    // Pass the first one to featured left side
    showFeatured(query, withImages[0]);

    // Clear old results
    myResults = [];

    let imgCards = [];
    // Convert remaining API items to my friendly format
    for (let i = 1; i < withImages.length; i++) {
        let item = withImages[i];
        let meta = item.data[0];
        
        let dateVal = new Date(0);
        if (meta.date_created) {
            dateVal = new Date(meta.date_created);
        }
        
        imgCards.push({
            type: "NASA",
            title: meta.title || "Untitled",
            desc: meta.description || "",
            img: item.links[0].href,
            date: dateVal,
            year: dateVal.getFullYear(),
            defaultSortIndex: i
        });
    }

    let apodCards = [];
    if (apodData.length > 0) {
        for (let i = 0; i < apodData.length; i++) {
            let apod = apodData[i];
            if (apod.media_type == "image" && apod.url) {
                let dateVal = new Date();
                if (apod.date) {
                    dateVal = new Date(apod.date);
                }
                apodCards.push({
                    type: "APOD",
                    title: apod.title || "Astronomy Picture",
                    desc: apod.explanation || "",
                    img: apod.hdurl || apod.url,
                    date: dateVal,
                    year: dateVal.getFullYear()
                });
            }
        }
    }
    
    // Mix them up like the original
    let imgIdx = 0;
    let apodIdx = 0;
    while(imgIdx < imgCards.length || apodIdx < apodCards.length) {
        if (imgIdx < imgCards.length) {
            myResults.push(imgCards[imgIdx]);
            imgIdx++;
        }
        if (apodIdx < apodCards.length) {
            myResults.push(apodCards[apodIdx]);
            apodIdx++;
        }
    }

    renderCards(myResults);

  }).catch(function(err) {
    console.log(err);
    searchLoadingEl.style.display = "none";
    searchErrorEl.style.display = "block";
    searchErrorEl.textContent = "Error: Search failed.";
    heroTitleSearchEl.textContent = "Could not load results.";
    heroDescSearchEl.textContent = "";
  });
}

// Function to draw right side cards
function renderCards(dataArray) {
    // Empty the HTML first
    searchResultsEl.innerHTML = "";
    
    // Copy the array to preserve original order
    let cardsToRender = [];
    for(let i=0; i<dataArray.length; i++){
        cardsToRender.push(dataArray[i]);
    }
    
    let sortBy = sortOptionsEl.value;
    
    if (sortBy == "recent") {
        cardsToRender.sort(function(a, b) {
            return b.date - a.date;
        });
    } else if (sortBy == "date") {
        cardsToRender.sort(function(a, b) {
            return a.date - b.date; // oldest first
        });
    } else if (sortBy == "year") {
        cardsToRender.sort(function(a, b) {
            return a.year - b.year; // ascending year
        });
    }
    // "default" leaves it how it was
    
    // Draw in view
    for (let i=0; i < cardsToRender.length; i++) {
        // Stop after 12 cards max limit
        if (i >= 12) {
            break;
        }
        
        let item = cardsToRender[i];
        
        let card = document.createElement("div");
        card.className = "result-card";

        let img = document.createElement("img");
        img.src = item.img;
        img.alt = item.title;
        img.loading = "lazy";
        
        let body = document.createElement("div");
        body.className = "result-copy";
        
        let badge = document.createElement("span");
        if (item.type == "APOD") {
            badge.className = "result-badge apod-badge";
        } else {
            badge.className = "result-badge";
        }
        badge.textContent = item.type;
        
        let h3 = document.createElement("h3");
        h3.textContent = item.title;
        
        let p = document.createElement("p");
        p.textContent = item.desc;
        
        body.appendChild(badge);
        body.appendChild(h3);
        body.appendChild(p);
        card.appendChild(img);
        card.appendChild(body);
        
        searchResultsEl.appendChild(card);
    }
}

// Left side featured view update
function showFeatured(query, item) {
  let meta = item.data[0];
  let thumb = item.links[0];

  featuredImgEl.src = thumb.href;
  featuredImgEl.alt = meta.title;

  heroEyebrowSearchEl.textContent = query;
  heroTitleSearchEl.textContent = meta.title || query;
  heroDescSearchEl.textContent = meta.description || "";

  if (featTopicEl) {
    featTopicEl.textContent = query;
  }

  if (featDateEl && meta.date_created) {
    let d = new Date(meta.date_created);
    // basic date string
    featDateEl.textContent = d.toDateString(); 
  }

  if (featCenterEl) {
    featCenterEl.textContent = meta.center || "NASA";
  }
}

// Reset everything to original landing screen
function resetToDefault() {
  heroCopyEl.classList.remove("hero-copy--searching");
  featuredBlockEl.style.display = "none";
  defaultBlockEl.style.display = "block";
  featuredImgEl.src = "";
  resetBtnEl.style.display = "none";

  resultsViewEl.style.display = "none";
  planetViewEl.style.display = "flex";

  searchInputEl.value = "";

  // Go back manually with simple timeout delays
  let appWrapperEl = document.getElementById("app-wrapper");
  let landingHeroEl = document.getElementById("landing-hero");

  appWrapperEl.style.animation = "heroExit 0.4s ease forwards";

  setTimeout(function () {
    appWrapperEl.style.display = "none";
    appWrapperEl.style.animation = "";
    appWrapperEl.classList.remove("app-wrapper--enter");

    landingHeroEl.style.display = "flex";
    landingHeroEl.classList.remove("landing-hero--exit");
    landingHeroEl.style.opacity = "0";
    landingHeroEl.style.animation = "appEnter 0.5s ease forwards";

    setTimeout(function () {
      landingHeroEl.style.animation = "";
      landingHeroEl.style.opacity = "";
    }, 500);
  }, 400);
}

// Initial Landing setup functions
let landingHeroEl = document.getElementById("landing-hero");
let appWrapperEl = document.getElementById("app-wrapper");
let landingExplore = document.getElementById("landing-explore-btn");

landingExplore.addEventListener("click", function() {
  landingHeroEl.classList.add("landing-hero--exit");

  setTimeout(function () {
    landingHeroEl.style.display = "none";
    appWrapperEl.style.display = "block";
    appWrapperEl.classList.add("app-wrapper--enter");

    revealExplore();
  }, 500);
});