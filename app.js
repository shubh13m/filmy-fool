// --- CONFIGURATION ---
const OMDB_API_KEY = "7ee6529c"; 
const BASE_URL = "https://www.omdbapi.com/";

// --- STATE MANAGEMENT ---
let state = {
    dailyQueue: JSON.parse(localStorage.getItem('flixmix_queue')) || [],
    queueDate: localStorage.getItem('flixmix_date') || "",
    history: JSON.parse(localStorage.getItem('flixmix_history')) || [],
    pickedMovie: JSON.parse(localStorage.getItem('flixmix_picked')) || null
};

// --- INITIALIZE APP ---
window.addEventListener('load', () => {
    // Setup Review Button
    const submitBtn = document.getElementById('submit-review');
    if (submitBtn) submitBtn.onclick = submitReview;

    // Setup Toggle Buttons (Yes/No text swap)
    document.querySelectorAll('.toggle-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            this.innerText = this.classList.contains('active') ? "Yes" : "No";
        });
    });

    const today = new Date().toDateString();
    
    if (state.pickedMovie) {
        showReviewScreen();
    } else if (state.dailyQueue.length > 0 && state.queueDate === today) {
        renderStack();
    } else {
        startDailyDiscovery();
    }
});

// --- FETCHING LOGIC ---
async function startDailyDiscovery() {
    const container = document.getElementById('card-container');
    const keywords = ["Man", "Love", "Space", "Dark", "World", "Time", "Life", "Action", "Night"];
    const query = keywords[Math.floor(Math.random() * keywords.length)];

    try {
        const res = await fetch(`${BASE_URL}?s=${query}&type=movie&apikey=${OMDB_API_KEY}`);
        const data = await res.json();
        if (data.Response === "False") throw new Error(data.Error);

        const moviePromises = data.Search.slice(0, 10).map(m => 
            fetch(`${BASE_URL}?i=${m.imdbID}&apikey=${OMDB_API_KEY}`).then(r => r.json())
        );

        const detailed = await Promise.all(moviePromises);

        // Filter for high ratings and save
        state.dailyQueue = detailed
            .filter(m => parseFloat(m.imdbRating) >= 7.0 && !state.history.some(h => h.id === m.imdbID))
            .slice(0, 5);
        
        state.queueDate = new Date().toDateString();
        
        localStorage.setItem('flixmix_queue', JSON.stringify(state.dailyQueue));
        localStorage.setItem('flixmix_date', state.queueDate);

        renderStack();
    } catch (err) {
        container.innerHTML = `<div class="error">Connection Error. <br> <small>${err.message}</small></div>`;
    }
}

// --- UI RENDERING ---
function renderStack() {
    const container = document.getElementById('card-container');
    container.innerHTML = '';

    if (state.dailyQueue.length === 0) {
        container.innerHTML = '<div class="loading">Daily 5 complete! <br>Check back tomorrow for more.</div>';
        return;
    }

    state.dailyQueue.forEach((movie, index) => {
        const card = document.createElement('div');
        card.className = 'movie-card';
        card.style.zIndex = index; 
        
        const poster = movie.Poster !== "N/A" ? movie.Poster : "https://via.placeholder.com/500x750?text=No+Poster";

        card.innerHTML = `
            <img src="${poster}" alt="${movie.Title}" class="movie-poster">
            <div class="movie-info">
                <h3>${movie.Title} (${movie.Year})</h3>
                <p>⭐ IMDb: ${movie.imdbRating} | ${movie.Genre}</p>
            </div>
            <div class="card-actions">
                <button class="cross-btn">✖</button>
                <button class="check-btn">✔</button>
            </div>
        `;

        card.querySelector('.cross-btn').onclick = () => handleSwipe(false);
        card.querySelector('.check-btn').onclick = () => handleSwipe(true);
        
        container.appendChild(card);
    });
}

// --- INTERACTION LOGIC ---
function handleSwipe(isMatch) {
    const cards = document.getElementsByClassName('movie-card');
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
            updateHistory(movie.imdbID, null); // Log as skipped
            renderStack();
        }
    }, { once: true });
}

function showReviewScreen() {
    document.getElementById('discovery-view').classList.add('hidden');
    document.getElementById('review-view').classList.remove('hidden');
    document.getElementById('review-title').innerText = `How was ${state.pickedMovie.Title}?`;
    
    // Reset UI for fresh review
    document.querySelectorAll('input[name="star"]').forEach(input => input.checked = false);
    document.querySelectorAll('.toggle-btn').forEach(btn => {
        btn.classList.remove('active');
        btn.innerText = "No";
    });
}

function submitReview() {
    // Capture Data
    const rating = document.querySelector('input[name="star"]:checked')?.value || 0;
    const isFamily = document.getElementById('btn-family').classList.contains('active');
    const isRepeat = document.getElementById('btn-repeat').classList.contains('active');

    const reviewData = {
        id: state.pickedMovie.imdbID,
        title: state.pickedMovie.Title,
        userRating: rating,
        familyFriendly: isFamily,
        repeatWatch: isRepeat,
        date: new Date().toLocaleDateString()
    };

    updateHistory(state.pickedMovie.imdbID, reviewData);
    
    // Clear Picked Movie
    state.pickedMovie = null;
    localStorage.removeItem('flixmix_picked');

    // Return to Discovery
    document.getElementById('review-view').classList.add('hidden');
    document.getElementById('discovery-view').classList.remove('hidden');
    renderStack();
}

function updateHistory(id, fullData) {
    // Only add to history if not skipped (or if skipped, just the ID)
    state.history.push(fullData || { id: id, skipped: true });
    localStorage.setItem('flixmix_history', JSON.stringify(state.history));
}

// --- PWA LOGIC ---
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
}

function handleUpdate() {
    navigator.serviceWorker.getRegistration().then(reg => {
        if (reg && reg.waiting) reg.waiting.postMessage({ action: 'skipWaiting' });
        window.location.reload();
    });
}
