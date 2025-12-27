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
    const submitBtn = document.getElementById('submit-review');
    if (submitBtn) submitBtn.onclick = submitReview;

    document.querySelectorAll('.toggle-btn').forEach(btn => {
        btn.onclick = function() {
            this.classList.toggle('active');
            this.innerText = this.classList.contains('active') ? "Yes" : "No";
        };
    });

    navigator.serviceWorker.addEventListener('controllerchange', () => {
        window.location.reload();
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
    container.innerHTML = '<div class="loading">Curating your mix...</div>';
    
    const masterKeywords = ["Masterpiece", "Classic", "Oscar", "Noir", "Detective", "Future", "Secret", "Legend", "Mystery", "Empire"];
    const shuffledKeywords = masterKeywords.sort(() => Math.random() - 0.5);
    let foundMovies = [];

    try {
        for (const query of shuffledKeywords) {
            if (foundMovies.length >= 5) break;

            const res = await fetch(`${BASE_URL}?s=${query}&type=movie&apikey=${OMDB_API_KEY}`);
            const data = await res.json();
            
            if (data.Response === "True") {
                const moviePromises = data.Search.slice(0, 8).map(m => 
                    fetch(`${BASE_URL}?i=${m.imdbID}&apikey=${OMDB_API_KEY}`).then(r => r.json())
                );

                const detailed = await Promise.all(moviePromises);

                const filtered = detailed.filter(m => {
                    const rating = parseFloat(m.imdbRating);
                    const isNew = !state.history.some(h => h.id === m.imdbID);
                    return !isNaN(rating) && rating >= 7.0 && isNew;
                });

                filtered.forEach(m => {
                    if (foundMovies.length < 5 && !foundMovies.some(existing => existing.imdbID === m.imdbID)) {
                        foundMovies.push(m);
                    }
                });
            }
        }

        if (foundMovies.length === 0) throw new Error("No high-rated movies found.");

        state.dailyQueue = foundMovies;
        state.queueDate = new Date().toDateString();
        localStorage.setItem('flixmix_queue', JSON.stringify(state.dailyQueue));
        localStorage.setItem('flixmix_date', state.queueDate);

        renderStack();

    } catch (err) {
        console.error(err);
        container.innerHTML = `
            <div class="error">
                <p>No new 7.0+ movies found.</p>
                <button onclick="localStorage.clear(); location.reload();" class="gold-btn" style="width:auto; padding:10px 20px;">Reset History</button>
            </div>`;
    }
}

// --- UI RENDERING ---
function renderStack() {
    const container = document.getElementById('card-container');
    container.innerHTML = '';

    if (state.dailyQueue.length === 0) {
        container.innerHTML = `<div class="loading"><h3>All caught up!</h3></div>`;
        return;
    }

    state.dailyQueue.forEach((movie, index) => {
        const card = document.createElement('div');
        card.className = 'movie-card';
        card.style.zIndex = index; 
        
        const poster = movie.Poster !== "N/A" ? movie.Poster : "https://via.placeholder.com/500x750?text=No+Poster";

        // UPDATED: Added movie-footer wrapper to fix button overflow
        card.innerHTML = `
            <img src="${poster}" alt="${movie.Title}" class="movie-poster">
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

// --- INTERACTION LOGIC ---
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
    document.querySelectorAll('.toggle-btn').forEach(btn => {
        btn.classList.remove('active');
        btn.innerText = "No";
    });
}

function submitReview() {
    const ratingInput = document.querySelector('input[name="star"]:checked');
    if (!ratingInput) return alert("Please select a star rating!");

    const reviewData = {
        id: state.pickedMovie.imdbID,
        title: state.pickedMovie.Title,
        userRating: parseInt(ratingInput.value),
        familyFriendly: document.getElementById('btn-family').classList.contains('active'),
        repeatWatch: document.getElementById('btn-repeat').classList.contains('active'),
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
    if (show) { renderHistory(); historySection.classList.remove('hidden'); }
    else { historySection.classList.add('hidden'); }
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
            <div class="history-info"><h4>${item.title}</h4><p>${item.date}</p></div>
            <div class="history-badge">${'★'.repeat(item.userRating)}</div>
        `;
        list.appendChild(div);
    });
}
