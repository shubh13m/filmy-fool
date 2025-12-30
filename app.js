/**
 * FlixMix - Movie Discovery App
 * Version: 1.0.17
 * Strategy: Multi-Lane Discovery with Recursive Fallback
 */

// --- INITIALIZE APP ---
window.addEventListener('load', () => {
    // Version log for debugging
    console.log("%c Filmy Fool Version: 1.0.17 ", "color: white; background: #6200ee; padding: 5px; border-radius: 5px; font-weight: bold;");

    const submitBtn = document.getElementById('submit-review');
    if (submitBtn) submitBtn.onclick = submitReview;

    // Start splash timer
    setTimeout(hideSplash, 4000);

    // --- SERVICE WORKER & SMART UPDATE LOGIC ---
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('sw.js').then(reg => {
            // Check for updates on every load
            reg.update(); 

            reg.onupdatefound = () => {
                const installingWorker = reg.installing;
                installingWorker.onstatechange = () => {
                    // Show pulse only if a new worker is successfully installed and waiting
                    if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
                        console.log("FlixMix: New update ready.");
                        showUpdatePulse();
                    }
                };
            };

            // If a worker is already waiting from a previous visit
            if (reg.waiting) showUpdatePulse();
        });

        // Trigger reload when the new Service Worker takes over
        let refreshing = false;
        navigator.serviceWorker.addEventListener('controllerchange', () => {
            if (refreshing) return;
            if (navigator.serviceWorker.controller) {
                refreshing = true;
                console.log("FlixMix: Activating new version...");
                window.location.reload(true); 
            }
        });
    }

    // --- VIEW ROUTING ---
    const today = new Date().toDateString();
    
    if (state.pickedMovie) {
        showReviewScreen();
        hideSplash();
    } else if (state.dailyQueue.length > 0 && state.queueDate === today) {
        renderStack();
        hideSplash();
    } else {
        startDailyDiscovery();
    }
});

// --- STATE MANAGEMENT ---
let state = {
    dailyQueue: JSON.parse(localStorage.getItem('filmyfool_queue')) || [],
    queueDate: localStorage.getItem('filmyfool_date') || "",
    history: JSON.parse(localStorage.getItem('filmyfool_history')) || [],
    pickedMovie: JSON.parse(localStorage.getItem('filmyfool_picked')) || null
};

const OMDB_API_KEY = "4a4effd2"; 
const BASE_URL = "https://www.omdbapi.com/";

// --- KEYWORD LIBRARIES (Multi-Lane Strategy) ---
const genreLanes = {
    pulse: ["Action", "Thriller", "Noir", "Crime", "Heist", "Revenge", "Assassin", "Manhunt", "Warfare", "Espionage", "Vigilante", "Underworld"],
    wonder: ["Sci-Fi", "Cyberpunk", "Dystopian", "Space", "Multiverse", "Time Travel", "Alien", "Simulation", "Apocalypse", "Galaxy", "Fantasy", "Magic", "Mythology"],
    thought: ["Mystery", "Psychological", "Conspiracy", "Identity", "Memory", "Mind-bending", "Investigation", "Detective", "Secret", "Documentary", "Biographical", "Historical"],
    heart: ["Comedy", "Animation", "Family", "Satire", "Drama", "Coming-of-age", "Redemption", "Inspirational", "Romance", "Musical", "Western", "Classic"]
};

// --- UPDATE HANDLERS ---
function showUpdatePulse() {
    const updateBtn = document.getElementById('update-btn');
    if (updateBtn) {
        updateBtn.classList.add('update-available');
        updateBtn.title = "Update available! Click to refresh.";
    }
}

window.handleUpdateClick = function() {
    const updateBtn = document.getElementById('update-btn');
    if (updateBtn && updateBtn.classList.contains('update-available')) {
        navigator.serviceWorker.getRegistration().then(reg => {
            if (reg && reg.waiting) {
                reg.waiting.postMessage({ action: 'skipWaiting' });
            } else if (reg && reg.installing) {
                alert("New version is still downloading. Please wait a few seconds...");
            } else {
                window.location.reload(true);
            }
        });
    } else {
        console.log("FlixMix is up to date!");
    }
};

// --- HELPER FUNCTIONS ---
function hideSplash() {
    const splash = document.getElementById('splash-screen');
    if (splash && !splash.classList.contains('splash-fade-out')) {
        splash.classList.add('splash-fade-out');
    }
}

// --- FETCHING LOGIC WITH RECURSIVE FALLBACK ---
async function startDailyDiscovery(retryCount = 0) {
    const container = document.getElementById('card-container');
    if (!container) return;
    
    if (retryCount === 0) {
        container.innerHTML = '<div class="loading">Curating your daily mix...</div>';
    }

    const ratingThreshold = retryCount === 0 ? 7.0 : 6.0;
    const lanes = Object.keys(genreLanes).sort(() => Math.random() - 0.5).slice(0, 3);
    const selectedKeywords = lanes.map(lane => {
        const keywords = genreLanes[lane];
        return keywords[Math.floor(Math.random() * keywords.length)];
    });

    try {
        const searchPromises = selectedKeywords.map(query => 
            fetch(`${BASE_URL}?s=${query}&type=movie&apikey=${OMDB_API_KEY}`).then(r => r.json())
        );
        
        const results = await Promise.all(searchPromises);
        let allPotentialIDs = [];

        results.forEach(data => {
            if (data.Response === "True") {
                data.Search.slice(0, 5).forEach(m => allPotentialIDs.push(m.imdbID));
            }
        });

        const uniqueIDs = [...new Set(allPotentialIDs)].filter(id => !state.history.some(h => h.id === id));
        const detailPromises = uniqueIDs.slice(0, 15).map(id => 
            fetch(`${BASE_URL}?i=${id}&apikey=${OMDB_API_KEY}`).then(r => r.json())
        );

        const detailedMovies = await Promise.all(detailPromises);

        let foundMovies = detailedMovies.filter(m => {
            const rating = parseFloat(m.imdbRating);
            return !isNaN(rating) && rating >= ratingThreshold && m.Poster !== "N/A";
        });

        if (foundMovies.length < 5 && retryCount < 1) {
            console.warn(`Only found ${foundMovies.length} high-rated movies. Retrying...`);
            return startDailyDiscovery(retryCount + 1);
        }

        if (foundMovies.length === 0) throw new Error("EMPTY");

        state.dailyQueue = foundMovies.sort(() => Math.random() - 0.5).slice(0, 5);
        state.queueDate = new Date().toDateString();
        
        localStorage.setItem('filmyfool_queue', JSON.stringify(state.dailyQueue));
        localStorage.setItem('filmyfool_date', state.queueDate);

        renderStack();
        hideSplash();

    } catch (err) {
        console.error("Discovery Error:", err);
        hideSplash();
        container.innerHTML = `
            <div class="error">
                <p>Could not find enough new movies right now.</p>
                <button onclick="location.reload();" class="gold-btn" style="width:auto; padding:10px 20px;">Try Again</button>
            </div>`;
    }
}

// --- UI RENDERING ---
function renderStack() {
    const container = document.getElementById('card-container');
    if (!container) return;
    container.innerHTML = '';

    if (state.dailyQueue.length === 0) {
        container.innerHTML = `<div class="loading"><h3>All caught up!</h3><p>Check back tomorrow for a new batch.</p></div>`;
        return;
    }

    [...state.dailyQueue].forEach((movie, index) => {
        const card = document.createElement('div');
        card.className = 'movie-card';
        card.style.zIndex = index; 
        
        const poster = movie.Poster !== "N/A" ? movie.Poster : "https://via.placeholder.com/500x750?text=No+Poster";

        // Structured for "Bottom-Up" layout to keep buttons visible
        card.innerHTML = `
            <img src="${poster}" alt="${movie.Title}" class="movie-poster" onerror="this.src='https://via.placeholder.com/500x750?text=Poster+Error'">
            <div class="movie-footer">
                <div class="movie-info">
                    <h3 style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin: 0;">${movie.Title}</h3>
                    <p style="margin: 4px 0 12px 0;">⭐ ${movie.imdbRating} | ${movie.Genre.split(',')[0]}</p>
                </div>
                <div class="card-actions">
                    <button class="cross-btn" onclick="handleSwipe(false)" aria-label="Skip">✖</button>
                    <button class="check-btn" onclick="handleSwipe(true)" aria-label="Watch">✔</button>
                </div>
            </div>
        `;
        container.appendChild(card);
    });
}

function handleSwipe(isMatch) {
    const cards = document.querySelectorAll('.movie-card');
    if (cards.length === 0) return;

    const topCard = cards[cards.length - 1];
    topCard.classList.add(isMatch ? 'swipe-right-anim' : 'swipe-left-anim');

    topCard.addEventListener('animationend', () => {
        const movie = state.dailyQueue.pop(); 
        localStorage.setItem('filmyfool_queue', JSON.stringify(state.dailyQueue));

        if (isMatch) {
            state.pickedMovie = movie;
            localStorage.setItem('filmyfool_picked', JSON.stringify(movie));
            showReviewScreen();
        } else {
            updateHistory(movie.imdbID, { id: movie.imdbID, title: movie.Title, skipped: true, date: new Date().toLocaleDateString() });
            renderStack(); 
        }
    }, { once: true });
}

function showReviewScreen() {
    document.getElementById('discovery-view').classList.add('hidden');
    document.getElementById('review-view').classList.remove('hidden');
    document.getElementById('review-title').innerText = `How was ${state.pickedMovie.Title}?`;
    
    // Reset review form
    document.querySelectorAll('input[name="star"]').forEach(input => input.checked = false);
    const familyBtn = document.getElementById('btn-family');
    const repeatBtn = document.getElementById('btn-repeat');
    if(familyBtn) familyBtn.checked = false;
    if(repeatBtn) repeatBtn.checked = false;
}

function submitReview() {
    const ratingInput = document.querySelector('input[name="star"]:checked');
    if (!ratingInput) return alert("Please select a star rating!");

    const reviewData = {
        id: state.pickedMovie.imdbID,
        title: state.pickedMovie.Title,
        userRating: parseInt(ratingInput.value),
        familyFriendly: document.getElementById('btn-family')?.checked || false,
        repeatWatch: document.getElementById('btn-repeat')?.checked || false,
        date: new Date().toLocaleDateString()
    };

    updateHistory(state.pickedMovie.imdbID, reviewData);
    state.pickedMovie = null;
    localStorage.removeItem('filmyfool_picked');

    document.getElementById('review-view').classList.add('hidden');
    document.getElementById('discovery-view').classList.remove('hidden');
    renderStack();
}

function updateHistory(id, data) {
    state.history = state.history.filter(h => h.id !== id);
    state.history.push(data);
    localStorage.setItem('filmyfool_history', JSON.stringify(state.history));
}

function toggleHistory(show) {
    const historySection = document.getElementById('history-view');
    if (show) { 
        renderHistory(); 
        historySection.classList.remove('hidden'); 
    } else { 
        historySection.classList.add('hidden'); 
    }
}

function renderHistory() {
    const list = document.getElementById('history-list');
    if (!list) return;
    list.innerHTML = '';
    
    const ratedMovies = state.history.filter(h => h.userRating !== undefined);
    
    if (ratedMovies.length === 0) {
        list.innerHTML = '<p style="text-align:center; color:#999; margin-top:40px;">No reviews yet.</p>';
        return;
    }

    [...ratedMovies].reverse().forEach(item => {
        const div = document.createElement('div');
        div.className = 'history-item';
        const familyTag = item.familyFriendly ? '<span class="tag">👨‍👩‍👧 Family</span>' : '';
        const watchAgainTag = item.repeatWatch ? '<span class="tag">🔁 Re-watch</span>' : '';
        
        div.innerHTML = `
            <div class="history-info">
                <h4>${item.title}</h4>
                <p>${item.date}</p>
                <div class="history-tags" style="display:flex; gap:5px; margin-top:5px;">
                    ${familyTag}${watchAgainTag}
                </div>
            </div>
            <div class="history-badge" style="font-weight:bold; color:var(--primary);">${'★'.repeat(item.userRating)}</div>
        `;
        list.appendChild(div);
    });
}
