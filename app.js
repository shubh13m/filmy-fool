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

    // Setup Toggle Buttons (Fixed logic for Material Light)
    document.querySelectorAll('.toggle-btn').forEach(btn => {
        btn.onclick = function() {
            this.classList.toggle('active');
            this.innerText = this.classList.contains('active') ? "Yes" : "No";
        };
    });

    const today = new Date().toDateString();
    
    // Check state and route to correct view
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
    container.innerHTML = '<div class="loading">Curating your mix...</div>';
    
    const keywords = ["Man", "Love", "Space", "Dark", "World", "Time", "Life", "Action", "Night", "Story"];
    const query = keywords[Math.floor(Math.random() * keywords.length)];

    try {
        const res = await fetch(`${BASE_URL}?s=${query}&type=movie&apikey=${OMDB_API_KEY}`);
        const data = await res.json();
        
        if (data.Response === "False") throw new Error(data.Error);

        // Fetch details for the first 10 results to get ratings
        const moviePromises = data.Search.slice(0, 10).map(m => 
            fetch(`${BASE_URL}?i=${m.imdbID}&apikey=${OMDB_API_KEY}`).then(r => r.json())
        );

        const detailed = await Promise.all(moviePromises);

        // Filter: High ratings (>= 7.0) and not in history
        state.dailyQueue = detailed
            .filter(m => {
                const rating = parseFloat(m.imdbRating);
                const isNew = !state.history.some(h => h.id === m.imdbID);
                return !isNaN(rating) && rating >= 7.0 && isNew;
            })
            .slice(0, 5);
        
        // If query was too restrictive, grab any highly rated ones or fallback
        if (state.dailyQueue.length === 0) {
             state.dailyQueue = detailed.slice(0, 5);
        }
        
        state.queueDate = new Date().toDateString();
        
        localStorage.setItem('flixmix_queue', JSON.stringify(state.dailyQueue));
        localStorage.setItem('flixmix_date', state.queueDate);

        renderStack();
    } catch (err) {
        console.error(err);
        container.innerHTML = `
            <div class="error">
                <p>Connection Error</p>
                <button onclick="startDailyDiscovery()" class="gold-btn" style="width:auto; padding:10px 20px;">Retry</button>
            </div>`;
    }
}

// --- UI RENDERING ---
function renderStack() {
    const container = document.getElementById('card-container');
    container.innerHTML = '';

    if (state.dailyQueue.length === 0) {
        container.innerHTML = `
            <div class="loading">
                <h3>All caught up!</h3>
                <p>Check back tomorrow for a fresh mix.</p>
            </div>`;
        return;
    }

    state.dailyQueue.forEach((movie, index) => {
        const card = document.createElement('div');
        card.className = 'movie-card';
        // Material depth: higher cards have higher z-index
        card.style.zIndex = state.dailyQueue.length - index; 
        
        const poster = movie.Poster !== "N/A" ? movie.Poster : "https://via.placeholder.com/500x750?text=No+Poster";

        card.innerHTML = `
            <img src="${poster}" alt="${movie.Title}" class="movie-poster">
            <div class="movie-info">
                <h3>${movie.Title}</h3>
                <p>⭐ ${movie.imdbRating} | ${movie.Genre} | ${movie.Year}</p>
            </div>
            <div class="card-actions">
                <button class="cross-btn" aria-label="Skip">✖</button>
                <button class="check-btn" aria-label="Watch">✔</button>
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

    // The "top" card is the last one appended or the one with highest z-index
    // Our logic renders them all; the one at index length-1 is top visually
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
            updateHistory(movie.imdbID, { id: movie.imdbID, title: movie.Title, skipped: true });
            renderStack();
        }
    }, { once: true });
}

function showReviewScreen() {
    document.getElementById('discovery-view').classList.add('hidden');
    document.getElementById('review-view').classList.remove('hidden');
    document.getElementById('review-title').innerText = `How was ${state.pickedMovie.Title}?`;
    
    // Reset UI
    document.querySelectorAll('input[name="star"]').forEach(input => input.checked = false);
    document.querySelectorAll('.toggle-btn').forEach(btn => {
        btn.classList.remove('active');
        btn.innerText = "No";
    });
}

function submitReview() {
    const ratingInput = document.querySelector('input[name="star"]:checked');
    if (!ratingInput) {
        alert("Please select a star rating!");
        return;
    }

    const rating = ratingInput.value;
    const isFamily = document.getElementById('btn-family').classList.contains('active');
    const isRepeat = document.getElementById('btn-repeat').classList.contains('active');

    const reviewData = {
        id: state.pickedMovie.imdbID,
        title: state.pickedMovie.Title,
        userRating: parseInt(rating),
        familyFriendly: isFamily,
        repeatWatch: isRepeat,
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
    // Prevent duplicate history entries
    state.history = state.history.filter(h => h.id !== id);
    state.history.push(data);
    localStorage.setItem('flixmix_history', JSON.stringify(state.history));
}

// --- PWA LOGIC ---
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(err => console.error("SW error:", err));
}

function handleUpdate() {
    navigator.serviceWorker.getRegistration().then(reg => {
        if (reg && reg.waiting) reg.waiting.postMessage({ action: 'skipWaiting' });
        window.location.reload();
    });
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

    const reviews = state.history.filter(h => h.userRating);

    if (reviews.length === 0) {
        list.innerHTML = '<p style="text-align:center; color:#999; margin-top:20px;">No reviews yet.</p>';
        return;
    }

    [...reviews].reverse().forEach(item => {
        const div = document.createElement('div');
        div.className = 'history-item';
        div.innerHTML = `
            <div class="history-info">
                <h4>${item.title}</h4>
                <p>${item.date} ${item.familyFriendly ? '| 👨‍👩‍👧' : ''}</p>
            </div>
            <div class="history-badge">
                ${'★'.repeat(item.userRating)}${'☆'.repeat(5 - item.userRating)}
            </div>
        `;
        list.appendChild(div);
    });
}
