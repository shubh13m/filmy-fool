// --- CONFIGURATION ---
const OMDB_API_KEY = "4a4effd2"; 
const BASE_URL = "https://www.omdbapi.com/";

// --- STATE MANAGEMENT ---
let state = {
    dailyQueue: JSON.parse(localStorage.getItem('flixmix_queue')) || [],
    queueDate: localStorage.getItem('flixmix_date') || "",
    history: JSON.parse(localStorage.getItem('flixmix_history')) || [],
    pickedMovie: JSON.parse(localStorage.getItem('flixmix_picked')) || null
};

// Global timer variable to allow cancellation
let splashTimer;

// --- INITIALIZE APP ---
window.addEventListener('load', () => {
    const submitBtn = document.getElementById('submit-review');
    if (submitBtn) submitBtn.onclick = submitReview;

    // Start splash timer, but store it in a variable
    splashTimer = setTimeout(hideSplash, 6000);

    // --- SERVICE WORKER REGISTRATION ---
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('sw.js').then(reg => {
            reg.onupdatefound = () => {
                const installingWorker = reg.installing;
                installingWorker.onstatechange = () => {
                    if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
                        // NEW VERSION DETECTED:
                        // 1. Clear the timer so the splash screen doesn't hide the banner
                        clearTimeout(splashTimer);
                        
                        // 2. Show the banner
                        const banner = document.getElementById('update-banner');
                        if (banner) {
                            banner.classList.remove('hidden');
                            banner.style.display = 'flex'; // Force visibility
                        }
                    }
                };
            };
        });

        navigator.serviceWorker.addEventListener('controllerchange', () => {
            window.location.reload();
        });
    }

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

// --- HELPER FUNCTIONS ---
function hideSplash() {
    const splash = document.getElementById('splash-screen');
    const banner = document.getElementById('update-banner');
    
    // IF the update banner is visible, DO NOT hide the splash yet 
    // or the banner might flicker away
    if (banner && !banner.classList.contains('hidden')) {
        return; 
    }

    if (splash && !splash.classList.contains('splash-fade-out')) {
        splash.classList.add('splash-fade-out');
    }
}

// Fixed Update Handler
window.handleUpdate = function() {
    navigator.serviceWorker.getRegistration().then(reg => {
        if (reg && reg.waiting) {
            reg.waiting.postMessage({ action: 'skipWaiting' });
        } else {
            window.location.reload(true);
        }
    });
};

// --- FETCHING LOGIC ---
async function startDailyDiscovery() {
    const container = document.getElementById('card-container');
    container.innerHTML = '<div class="loading">Curating your mix...</div>';
    
    const masterKeywords = ["Masterpiece", "Classic", "Noir", "Mystery", "Empire"];
    const shuffledKeywords = masterKeywords.sort(() => Math.random() - 0.5).slice(0, 3);
    let foundMovies = [];

    try {
        const searchPromises = shuffledKeywords.map(query => 
            fetch(`${BASE_URL}?s=${query}&type=movie&apikey=${OMDB_API_KEY}`).then(r => {
                if (r.status === 401) throw new Error("UNAUTHORIZED");
                return r.json();
            })
        );
        
        const results = await Promise.all(searchPromises);
        let allPotentialIDs = [];

        results.forEach(data => {
            if (data.Response === "True") {
                data.Search.slice(0, 3).forEach(m => allPotentialIDs.push(m.imdbID));
            }
        });

        const uniqueIDs = [...new Set(allPotentialIDs)].filter(id => !state.history.some(h => h.id === id));

        const detailPromises = uniqueIDs.slice(0, 8).map(id => 
            fetch(`${BASE_URL}?i=${id}&apikey=${OMDB_API_KEY}`).then(r => r.json())
        );

        const detailedMovies = await Promise.all(detailPromises);

        foundMovies = detailedMovies.filter(m => {
            const rating = parseFloat(m.imdbRating);
            return !isNaN(rating) && rating >= 7.0;
        }).slice(0, 5);

        if (foundMovies.length === 0) throw new Error("EMPTY");

        state.dailyQueue = foundMovies;
        state.queueDate = new Date().toDateString();
        localStorage.setItem('flixmix_queue', JSON.stringify(state.dailyQueue));
        localStorage.setItem('flixmix_date', state.queueDate);

        renderStack();
        hideSplash();

    } catch (err) {
        console.error("Discovery Error:", err);
        hideSplash();
        
        let errorMsg = "Connection slow or no new movies found.";
        if (err.message === "UNAUTHORIZED") {
            errorMsg = "API Key error. Check activation email.";
        }

        container.innerHTML = `
            <div class="error">
                <p>${errorMsg}</p>
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
        container.innerHTML = `<div class="loading"><h3>All caught up!</h3><p>Check back tomorrow.</p></div>`;
        return;
    }

    state.dailyQueue.forEach((movie, index) => {
        const card = document.createElement('div');
        card.className = 'movie-card';
        card.style.zIndex = index; 
        
        const poster = movie.Poster !== "N/A" ? movie.Poster : "https://via.placeholder.com/500x750?text=No+Poster";

        card.innerHTML = `
            <img src="${poster}" alt="${movie.Title}" class="movie-poster" onerror="this.src='https://via.placeholder.com/500x750?text=Poster+Error'">
            <div class="movie-footer">
                <div class="movie-info">
                    <h3>${movie.Title}</h3>
                    <p>⭐ ${movie.imdbRating} | ${movie.Genre}</p>
                </div>
                <div class="card-actions">
                    <button class="cross-btn" onclick="handleSwipe(false)">✖</button>
                    <button class="check-btn" onclick="handleSwipe(true)">✔</button>
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
        localStorage.setItem('flixmix_queue', JSON.stringify(state.dailyQueue));

        if (isMatch) {
            state.pickedMovie = movie;
            localStorage.setItem('flixmix_picked', JSON.stringify(movie));
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
    
    document.querySelectorAll('input[name="star"]').forEach(input => input.checked = false);
    document.getElementById('btn-family').checked = false;
    document.getElementById('btn-repeat').checked = false;
}

function submitReview() {
    const ratingInput = document.querySelector('input[name="star"]:checked');
    if (!ratingInput) return alert("Please select a star rating!");

    const reviewData = {
        id: state.pickedMovie.imdbID,
        title: state.pickedMovie.Title,
        userRating: parseInt(ratingInput.value),
        familyFriendly: document.getElementById('btn-family').checked,
        repeatWatch: document.getElementById('btn-repeat').checked,
        date: new Date().toLocaleDateString()
    };

    updateHistory(state.pickedMovie.imdbID, reviewData);
    state.pickedMovie = null;
    localStorage.removeItem('flixmix_picked');

    document.getElementById('review-view').classList.add('hidden');
    document.getElementById('discovery-view').classList.remove('hidden');
    renderStack();
}

function updateHistory(id, data) {
    state.history = state.history.filter(h => h.id !== id);
    state.history.push(data);
    localStorage.setItem('flixmix_history', JSON.stringify(state.history));
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
