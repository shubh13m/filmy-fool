// --- CONFIGURATION ---
const OMDB_API_KEY = "7ee6529c"; 

// --- STATE MANAGEMENT ---
let state = {
    dailyQueue: [],
    history: JSON.parse(localStorage.getItem('flixmix_history')) || [],
    pickedMovie: JSON.parse(localStorage.getItem('flixmix_picked')) || null
};

// --- INITIALIZE APP ---
window.addEventListener('load', () => {
    // Setup Review Button Listener
    const submitBtn = document.getElementById('submit-review');
    if (submitBtn) submitBtn.onclick = submitReview;

    if (state.pickedMovie) {
        showReviewScreen();
    } else {
        startDailyDiscovery();
    }
});

// --- FETCHING LOGIC ---
async function startDailyDiscovery() {
    const container = document.getElementById('card-container');
    const keywords = ["Man", "Love", "Space", "Dark", "World", "Time", "Life", "Action", "Night"];
    const randomKeyword = keywords[Math.floor(Math.random() * keywords.length)];

    try {
        const searchResponse = await fetch(`https://www.omdbapi.com/?s=${randomKeyword}&type=movie&apikey=${OMDB_API_KEY}`);
        const searchData = await searchResponse.json();

        if (searchData.Response === "False") throw new Error(searchData.Error);

        // Fetch full details for ratings
        const moviePromises = searchData.Search.slice(0, 8).map(m => 
            fetch(`https://www.omdbapi.com/?i=${m.imdbID}&apikey=${OMDB_API_KEY}`).then(res => res.json())
        );

        const detailedMovies = await Promise.all(moviePromises);

        // Filter for high ratings and exclude history
        state.dailyQueue = detailedMovies
            .filter(m => parseFloat(m.imdbRating) >= 7.0 && !state.history.includes(m.imdbID))
            .slice(0, 5);

        renderStack();

    } catch (error) {
        console.error("OMDb Error:", error);
        container.innerHTML = `<div class="error">Error: ${error.message}. Try refreshing.</div>`;
    }
}

// --- UI RENDERING ---
function renderStack() {
    const container = document.getElementById('card-container');
    container.innerHTML = '';

    if (state.dailyQueue.length === 0) {
        container.innerHTML = '<div class="error">Finding more movies...</div>';
        setTimeout(startDailyDiscovery, 1500);
        return;
    }

    state.dailyQueue.forEach((movie, index) => {
        const card = document.createElement('div');
        card.className = 'movie-card';
        card.style.zIndex = state.dailyQueue.length - index;
        
        const poster = movie.Poster !== "N/A" ? movie.Poster : "https://via.placeholder.com/500x750?text=No+Poster";

        card.innerHTML = `
            <img src="${poster}" alt="${movie.Title}" class="movie-poster">
            <div class="movie-info">
                <h3 class="movie-title">${movie.Title} (${movie.Year})</h3>
                <p>⭐ IMDb: ${movie.imdbRating} | ${movie.Genre}</p>
            </div>
            <div class="card-actions">
                <button onclick="handleSwipe(false)">✖</button>
                <button onclick="handleSwipe(true)">✔</button>
            </div>
        `;
        container.appendChild(card);
    });
}

// --- INTERACTION LOGIC ---
function handleSwipe(isMatch) {
    const cards = document.getElementsByClassName('movie-card');
    if (cards.length === 0) return;

    const topCard = cards[cards.length - 1];
    
    // Trigger CSS Animations
    topCard.classList.add(isMatch ? 'swipe-right-anim' : 'swipe-left-anim');

    // Wait for animation to finish (0.5s)
    topCard.addEventListener('animationend', () => {
        const movie = state.dailyQueue.pop(); 

        if (isMatch) {
            state.pickedMovie = movie;
            localStorage.setItem('flixmix_picked', JSON.stringify(movie));
            showReviewScreen();
        } else {
            // Save ID to history to avoid seeing it again
            state.history.push(movie.imdbID);
            localStorage.setItem('flixmix_history', JSON.stringify(state.history));
            
            if (state.dailyQueue.length === 0) {
                startDailyDiscovery(); // Get more if queue is empty
            } else {
                renderStack(); 
            }
        }
    }, { once: true });
}

function showReviewScreen() {
    document.getElementById('discovery-view').classList.add('hidden');
    document.getElementById('review-view').classList.remove('hidden');
    document.getElementById('review-title').innerText = `How was ${state.pickedMovie.Title}?`;
}

function submitReview() {
    // Here we clear the picked movie so the user can discover again
    state.history.push(state.pickedMovie.imdbID);
    localStorage.setItem('flixmix_history', JSON.stringify(state.history));
    
    state.pickedMovie = null;
    localStorage.removeItem('flixmix_picked');

    // Reset UI
    document.getElementById('review-view').classList.add('hidden');
    document.getElementById('discovery-view').classList.remove('hidden');
    
    startDailyDiscovery();
}

// --- PWA UPDATES ---
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').then(reg => {
        reg.onupdatefound = () => {
            const installingWorker = reg.installing;
            installingWorker.onstatechange = () => {
                if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
                    document.getElementById('update-banner').classList.add('show');
                }
            };
        };
    });
}

function handleUpdate() {
    navigator.serviceWorker.getRegistration().then(reg => {
        if (reg.waiting) reg.waiting.postMessage({ action: 'skipWaiting' });
    });
}
