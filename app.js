/**
 * FlixMix - Movie Discovery App
 * Version: 2.0.0
 * Strategy: CSV-Based Local Discovery
 */

// --- INITIALIZE APP ---
window.addEventListener('load', () => {
    // Version log for debugging
    console.log("%c Filmy Fool Version: 23.0.0 ", "color: white; background: #6200ee; padding: 5px; border-radius: 5px; font-weight: bold;");
    console.log("%c 💡 Tip: Want to see the tutorial again? Type resetTutorial() in the console ", "color: #fbbc04; font-style: italic;");

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

    // --- APPLY THEME ---
    applyTheme();
    
    // --- LOAD CSV DATA FIRST ---
    loadAllData().then(() => {
        // --- VIEW ROUTING ---
        const today = new Date().toDateString();
        
        // Load both movies and shows on startup (5 each)
        const promises = [];
        
        // Initialize movies if needed
        if (!state.movies.pickedMovie && (state.movies.dailyQueue.length === 0 || state.movies.queueDate !== today)) {
            promises.push(startDailyDiscovery('movies'));
        }
        
        // Initialize shows if needed
        if (!state.shows.pickedMovie && (state.shows.dailyQueue.length === 0 || state.shows.queueDate !== today)) {
            promises.push(startDailyDiscovery('shows'));
        }
        
        // Wait for both to load
        Promise.all(promises).then(() => {
            // Show current tab
            if (state.currentTab === 'movies') {
                if (state.movies.pickedMovie) {
                    showReviewScreen('movies');
                } else {
                    renderStack('movies');
                }
            } else if (state.currentTab === 'shows') {
                if (state.shows.pickedMovie) {
                    showReviewScreen('shows');
                } else {
                    renderStack('shows');
                }
            }
            
            hideSplash();
            updateTabUI();
            
            // Check if this is first time user
            checkAndShowTutorial();
        });
    });
});

// --- STATE MANAGEMENT ---
let state = {
    currentTab: localStorage.getItem('filmyfool_currentTab') || 'movies',
    movies: {
        dailyQueue: JSON.parse(localStorage.getItem('filmyfool_movies_queue')) || [],
        queueDate: localStorage.getItem('filmyfool_movies_date') || "",
        pickedMovie: JSON.parse(localStorage.getItem('filmyfool_movies_picked')) || null
    },
    shows: {
        dailyQueue: JSON.parse(localStorage.getItem('filmyfool_shows_queue')) || [],
        queueDate: localStorage.getItem('filmyfool_shows_date') || "",
        pickedMovie: JSON.parse(localStorage.getItem('filmyfool_shows_picked')) || null
    },
    history: JSON.parse(localStorage.getItem('filmyfool_history')) || [],
    theme: localStorage.getItem('filmyfool_theme') || 'dark'
};

// --- TUTORIAL STATE ---
let tutorialState = {
    currentStep: 0,
    steps: [
        {
            icon: "🎬",
            title: "Welcome to FilmyFool!",
            description: "Discover 5 handpicked movies or shows daily. Swipe through your personalized mix and find your next watch."
        },
        {
            icon: "👆",
            title: "Simple Controls",
            description: "Tap <strong>✖ to skip</strong> or <strong>✔ to watch</strong>. It's that easy! Your choices help us understand your taste."
        },
        {
            icon: "📺",
            title: "Movies & Shows",
            description: "Switch between <strong>Movies</strong> and <strong>TV Shows</strong> tabs at the bottom. Each has its own daily curated mix!"
        },
        {
            icon: "🎲",
            title: "Fresh Mix Anytime",
            description: "Not feeling today's picks? Tap the <strong>🎲 New Mix</strong> button for 5 brand new recommendations instantly."
        },
        {
            icon: "✨",
            title: "You're All Set!",
            description: "Check your <strong>📜 History</strong> to see past watches and ratings. Happy discovering!"
        }
    ]
};

// --- CSV DATA STORAGE ---
let moviesDatabase = [];
let showsDatabase = [];

// --- KEYWORD LIBRARIES (Multi-Lane Strategy) ---
const genreLanes = {
    pulse: ["Action", "Thriller", "Noir", "Crime", "Heist", "Revenge", "Assassin", "Manhunt", "Warfare", "Espionage", "Vigilante", "Underworld"],
    wonder: ["Sci-Fi", "Cyberpunk", "Dystopian", "Space", "Multiverse", "Time Travel", "Alien", "Simulation", "Apocalypse", "Galaxy", "Fantasy", "Magic", "Mythology"],
    thought: ["Mystery", "Psychological", "Conspiracy", "Identity", "Memory", "Mind-bending", "Investigation", "Detective", "Secret", "Documentary", "Biographical", "Historical"],
    heart: ["Comedy", "Animation", "Family", "Satire", "Drama", "Coming-of-age", "Redemption", "Inspirational", "Romance", "Musical", "Western", "Classic"]
};

// --- CSV PARSING FUNCTIONS ---
async function loadMoviesFromCSV() {
    try {
        const [top250Response, popularResponse] = await Promise.all([
            fetch('imdb_top_250.csv'),
            fetch('popular_movies_not_in_top250_above_7.csv')
        ]);
        
        const top250Text = await top250Response.text();
        const popularText = await popularResponse.text();
        
        const top250Movies = parseCSV(top250Text, false, false);
        const popularMovies = parseCSV(popularText, true, false);
        
        moviesDatabase = [...top250Movies, ...popularMovies];
        console.log(`Loaded ${moviesDatabase.length} movies from CSV files`);
    } catch (error) {
        console.error('Error loading movie CSV files:', error);
    }
}

async function loadShowsFromCSV() {
    try {
        const [top250Response, popularResponse] = await Promise.all([
            fetch('imdb_top_250_tv.csv'),
            fetch('popular_tv_not_in_top250_above_7.csv')
        ]);
        
        const top250Text = await top250Response.text();
        const popularText = await popularResponse.text();
        
        const top250Shows = parseCSV(top250Text, false, true);
        const popularShows = parseCSV(popularText, true, true);
        
        showsDatabase = [...top250Shows, ...popularShows];
        console.log(`Loaded ${showsDatabase.length} shows from CSV files`);
    } catch (error) {
        console.error('Error loading TV show CSV files:', error);
    }
}

async function loadAllData() {
    await Promise.all([loadMoviesFromCSV(), loadShowsFromCSV()]);
}

function parseCSV(csvText, isPopular, isTVShow) {
    const lines = csvText.trim().split('\n');
    const items = [];
    
    // Skip header row
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        // Parse CSV line manually to handle edge cases
        const parts = [];
        let current = '';
        let inQuotes = false;
        
        for (let j = 0; j < line.length; j++) {
            const char = line[j];
            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                parts.push(current);
                current = '';
            } else {
                current += char;
            }
        }
        parts.push(current); // Add last part
        
        if (parts.length >= 6) {
            const title = parts[1].replace(/&apos;/g, "'").replace(/&amp;/g, "&").replace(/"/g, '');
            const year = parts[2] || 'N/A';
            const rating = parts[3];
            const imdbLink = parts[4];
            
            // Extract IMDb ID from link
            const match = imdbLink.match(/tt\d+/);
            if (!match) continue;
            
            const imdbID = match[0];
            
            // Assign genre based on title keywords or random
            const genre = assignGenre(title);
            
            // Determine image path
            let imagePath;
            if (isTVShow) {
                imagePath = isPopular ? `data/images/popular_tv_${imdbID}.jpg` : `data/images/tv_${imdbID}.jpg`;
            } else {
                imagePath = isPopular ? `data/images/popular_${imdbID}.jpg` : `data/images/${imdbID}.jpg`;
            }
            
            items.push({
                Title: title,
                Year: year,
                imdbRating: rating,
                imdbID: imdbID,
                Genre: genre,
                Poster: imagePath,
                RatingCount: parts[5] || '0',
                Type: isTVShow ? 'show' : 'movie'
            });
        }
    }
    
    return items;
}

function assignGenre(title) {
    const lowerTitle = title.toLowerCase();
    
    // Simple keyword-based genre assignment
    if (lowerTitle.match(/action|war|battle|fight|soldier|assassin|gun|mission|combat/)) {
        return genreLanes.pulse[Math.floor(Math.random() * genreLanes.pulse.length)];
    } else if (lowerTitle.match(/space|star|alien|future|time|galaxy|sci|matrix|blade/)) {
        return genreLanes.wonder[Math.floor(Math.random() * genreLanes.wonder.length)];
    } else if (lowerTitle.match(/mystery|detective|secret|mind|memory|investigation|conspiracy/)) {
        return genreLanes.thought[Math.floor(Math.random() * genreLanes.thought.length)];
    } else if (lowerTitle.match(/love|heart|family|comedy|life|beautiful|dream|story/)) {
        return genreLanes.heart[Math.floor(Math.random() * genreLanes.heart.length)];
    } else {
        // Random assignment for titles without clear keywords
        const allGenres = Object.values(genreLanes).flat();
        return allGenres[Math.floor(Math.random() * allGenres.length)];
    }
}

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

// --- FETCHING LOGIC WITH CSV DATA ---
async function startDailyDiscovery(type) {
    const container = document.getElementById('card-container');
    if (!container) return;
    
    container.innerHTML = '<div class="loading">Curating your daily mix...</div>';

    const database = type === 'movies' ? moviesDatabase : showsDatabase;
    const stateObj = state[type];
    
    // Wait for CSV data to load if not loaded yet
    if (database.length === 0) {
        if (type === 'movies') {
            await loadMoviesFromCSV();
        } else {
            await loadShowsFromCSV();
        }
    }

    try {
        // Filter out items already in history
        const availableItems = database.filter(item => 
            !state.history.some(h => h.id === item.imdbID)
        );

        if (availableItems.length < 5) {
            throw new Error(`Not enough new ${type} available`);
        }

        // Randomly select 5 items from available pool
        const shuffled = availableItems.sort(() => Math.random() - 0.5);
        stateObj.dailyQueue = shuffled.slice(0, 5);
        stateObj.queueDate = new Date().toDateString();
        
        localStorage.setItem(`filmyfool_${type}_queue`, JSON.stringify(stateObj.dailyQueue));
        localStorage.setItem(`filmyfool_${type}_date`, stateObj.queueDate);

        renderStack(type);
        hideSplash();

    } catch (err) {
        console.error("Discovery Error:", err);
        hideSplash();
        container.innerHTML = `
            <div class="error">
                <p>Could not find enough new ${type} right now.</p>
                <button onclick="location.reload();" class="gold-btn" style="width:auto; padding:10px 20px;">Try Again</button>
            </div>`;
    }
}

// --- UI RENDERING ---
function renderStack(type) {
    const container = document.getElementById('card-container');
    if (!container) return;
    container.innerHTML = '';

    const stateObj = state[type];
    const itemLabel = type === 'movies' ? 'movie' : 'show';

    if (stateObj.dailyQueue.length === 0) {
        container.innerHTML = `<div class="loading"><h3>All caught up!</h3><p>Check back tomorrow for a new batch.</p></div>`;
        return;
    }

    [...stateObj.dailyQueue].forEach((item, index) => {
        const card = document.createElement('div');
        card.className = 'movie-card';
        card.style.zIndex = index;
        card.setAttribute('data-card-index', index);
        
        const poster = item.Poster !== "N/A" ? item.Poster : "https://via.placeholder.com/500x750?text=No+Poster";

        // Structured for "Bottom-Up" layout to keep buttons visible
        card.innerHTML = `
            <img src="${poster}" alt="${item.Title}" class="movie-poster" onerror="this.src='https://via.placeholder.com/500x750?text=Poster+Error'">
            <div class="movie-footer">
                <div class="movie-info">
                    <h3 style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin: 0;">${item.Title}</h3>
                    <p style="margin: 4px 0 12px 0;">⭐ ${item.imdbRating} | ${item.Genre.split(',')[0]}</p>
                </div>
                <div class="card-actions">
                    <button class="cross-btn" onclick="handleSwipe(false, '${type}')" aria-label="Skip">✖</button>
                    <button class="check-btn" onclick="handleSwipe(true, '${type}')" aria-label="Watch">✔</button>
                </div>
            </div>
        `;
        
        container.appendChild(card);
    });
}

function handleSwipe(isMatch, type) {
    const cards = document.querySelectorAll('.movie-card');
    if (cards.length === 0) return;

    const topCard = cards[cards.length - 1];
    topCard.classList.add(isMatch ? 'swipe-right-anim' : 'swipe-left-anim');

    topCard.addEventListener('animationend', () => {
        const stateObj = state[type];
        const item = stateObj.dailyQueue.pop(); 
        localStorage.setItem(`filmyfool_${type}_queue`, JSON.stringify(stateObj.dailyQueue));

        if (isMatch) {
            stateObj.pickedMovie = item;
            localStorage.setItem(`filmyfool_${type}_picked`, JSON.stringify(item));
            showReviewScreen(type);
        } else {
            // Show rejected card peek on left
            showRejectedCardPeek(item);
            updateHistory(item.imdbID, { id: item.imdbID, title: item.Title, skipped: true, date: new Date().toLocaleDateString(), type: type });
            
            // Just remove the swiped card - remaining cards will smoothly transition up
            topCard.remove();
            
            // Check if queue is empty
            if (stateObj.dailyQueue.length === 0) {
                const container = document.getElementById('card-container');
                container.innerHTML = `<div class="loading"><h3>All caught up!</h3><p>Check back tomorrow for a new batch.</p></div>`;
            }
        }
    }, { once: true });
}

function showRejectedCardPeek(item) {
    const container = document.getElementById('card-container');
    if (!container) return;
    
    // Remove any existing peek cards
    const existingPeek = container.querySelector('.rejected-card-peek');
    if (existingPeek) existingPeek.remove();
    
    const peekCard = document.createElement('div');
    peekCard.className = 'rejected-card-peek';
    const poster = item.Poster !== "N/A" ? item.Poster : "https://via.placeholder.com/500x750?text=No+Poster";
    
    peekCard.innerHTML = `
        <img src="${poster}" alt="${item.Title}" class="movie-poster" style="width: 100%; height: 100%; object-fit: cover;">
    `;
    
    container.appendChild(peekCard);
    
    // Remove after animation completes
    setTimeout(() => {
        if (peekCard.parentNode) {
            peekCard.remove();
        }
    }, 2000);
}

function showReviewScreen(type) {
    document.getElementById('discovery-view').classList.add('hidden');
    document.getElementById('review-view').classList.remove('hidden');
    
    const stateObj = state[type];
    const itemLabel = type === 'movies' ? 'movie' : 'show';
    document.getElementById('review-title').innerText = `How was ${stateObj.pickedMovie.Title}?`;
    
    // Store current type in review screen
    document.getElementById('review-view').setAttribute('data-type', type);
    
    // Reset review form
    document.querySelectorAll('input[name="star"]').forEach(input => input.checked = false);
    updateStarDisplay(0);
    const familyBtn = document.getElementById('btn-family');
    const repeatBtn = document.getElementById('btn-repeat');
    if(familyBtn) familyBtn.checked = false;
    if(repeatBtn) repeatBtn.checked = false;
    
    // Add click handlers for half-star support
    document.querySelectorAll('.stars-rating label').forEach((label, index) => {
        label.onclick = (e) => {
            e.preventDefault();
            const rect = label.getBoundingClientRect();
            const clickX = e.clientX - rect.left;
            const isLeftHalf = clickX < rect.width / 2;
            const starValue = isLeftHalf ? label.dataset.half : label.dataset.value;
            const targetInput = document.getElementById(`star${starValue}`);
            if (targetInput) {
                targetInput.checked = true;
                updateStarDisplay(parseFloat(starValue));
            }
        };
    });
}

function updateStarDisplay(rating) {
    const labels = document.querySelectorAll('.stars-rating label');
    labels.forEach((label, index) => {
        // Labels are in reverse order (5, 4, 3, 2, 1)
        const starNumber = 5 - index;
        label.classList.remove('star-filled', 'star-half');
        
        if (starNumber <= Math.floor(rating)) {
            label.classList.add('star-filled');
        } else if (starNumber === Math.ceil(rating) && rating % 1 !== 0) {
            label.classList.add('star-half');
        }
    });
}

function submitReview() {
    const reviewView = document.getElementById('review-view');
    const type = reviewView.getAttribute('data-type');
    const stateObj = state[type];
    
    const ratingInput = document.querySelector('input[name="star"]:checked');
    if (!ratingInput) return alert("Please select a star rating!");

    const reviewData = {
        id: stateObj.pickedMovie.imdbID,
        title: stateObj.pickedMovie.Title,
        userRating: parseFloat(ratingInput.value),
        familyFriendly: document.getElementById('btn-family')?.checked || false,
        repeatWatch: document.getElementById('btn-repeat')?.checked || false,
        date: new Date().toLocaleDateString(),
        type: type
    };

    updateHistory(stateObj.pickedMovie.imdbID, reviewData);
    stateObj.pickedMovie = null;
    localStorage.removeItem(`filmyfool_${type}_picked`);

    document.getElementById('review-view').classList.add('hidden');
    document.getElementById('discovery-view').classList.remove('hidden');
    renderStack(type);
}

function updateHistory(id, data) {
    state.history = state.history.filter(h => h.id !== id);
    state.history.push(data);
    localStorage.setItem('filmyfool_history', JSON.stringify(state.history));
}

function renderStars(rating) {
    const fullStars = Math.floor(rating);
    const hasHalf = rating % 1 !== 0;
    let stars = '★'.repeat(fullStars);
    if (hasHalf) stars += '½';
    return stars;
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
        const typeTag = item.type ? `<span class="tag">${item.type === 'movies' ? '🎬' : '📺'}</span>` : '';
        
        div.innerHTML = `
            <div class="history-info">
                <h4>${item.title}</h4>
                <p>${item.date}</p>
                <div class="history-tags" style="display:flex; gap:5px; margin-top:5px;">
                    ${typeTag}${familyTag}${watchAgainTag}
                </div>
            </div>
            <div class="history-badge" style="font-weight:bold; color:var(--primary);">${renderStars(item.userRating)}</div>
        `;
        list.appendChild(div);
    });
}

// --- TAB SWITCHING ---
function switchTab(tab) {
    // Always hide review view when switching tabs
    document.getElementById('review-view').classList.add('hidden');
    document.getElementById('discovery-view').classList.remove('hidden');
    
    if (tab === 'releases') {
        const container = document.getElementById('card-container');
        container.innerHTML = `
            <div class="loading">
                <h3>🆕 Coming Soon!</h3>
                <p>New releases feature is under development.</p>
            </div>`;
        state.currentTab = tab;
        localStorage.setItem('filmyfool_currentTab', tab);
        updateTabUI();
        return;
    }
    
    state.currentTab = tab;
    localStorage.setItem('filmyfool_currentTab', tab);
    updateTabUI();
    
    const today = new Date().toDateString();
    const stateObj = state[tab];
    
    // Always show discovery view for tab switching
    if (stateObj.dailyQueue.length > 0 && stateObj.queueDate === today) {
        renderStack(tab);
    } else {
        startDailyDiscovery(tab);
    }
}

function updateTabUI() {
    document.querySelectorAll('.nav-tab').forEach(btn => {
        btn.classList.remove('active');
        if (btn.getAttribute('data-tab') === state.currentTab) {
            btn.classList.add('active');
        }
    });
}

function refreshCurrentTab() {
    if (state.currentTab === 'releases') {
        alert('New releases feature coming soon!');
        return;
    }
    startDailyDiscovery(state.currentTab);
}

// --- THEME FUNCTIONS ---
function toggleTheme() {
    state.theme = state.theme === 'dark' ? 'light' : 'dark';
    applyTheme();
    localStorage.setItem('filmyfool_theme', state.theme);
}

function applyTheme() {
    const root = document.documentElement;
    const themeIcon = document.querySelector('#theme-toggle-btn .icon');
    
    if (state.theme === 'light') {
        root.classList.add('light-theme');
        if (themeIcon) themeIcon.textContent = '☀️';
    } else {
        root.classList.remove('light-theme');
        if (themeIcon) themeIcon.textContent = '🌙';
    }
}

// --- TUTORIAL FUNCTIONS ---
function checkAndShowTutorial() {
    const hasSeenTutorial = localStorage.getItem('filmyfool_tutorial_completed');
    if (!hasSeenTutorial) {
        setTimeout(() => {
            startTutorial();
        }, 500); // Small delay after app loads
    }
}

function startTutorial() {
    tutorialState.currentStep = 0;
    const screen = document.getElementById('tutorial-screen');
    screen.classList.remove('hidden');
    showTutorialStep(0);
    
    // Add click handlers to dots
    document.querySelectorAll('.dot').forEach((dot, index) => {
        dot.onclick = () => {
            tutorialState.currentStep = index;
            showTutorialStep(index);
        };
    });
}

function showTutorialStep(stepIndex) {
    const step = tutorialState.steps[stepIndex];
    
    // Update content
    const iconEl = document.querySelector('.tutorial-icon');
    const titleEl = document.querySelector('.tutorial-title');
    const descEl = document.querySelector('.tutorial-description');
    
    iconEl.textContent = step.icon;
    titleEl.textContent = step.title;
    descEl.innerHTML = step.description;
    
    // Update dots
    document.querySelectorAll('.dot').forEach((dot, index) => {
        dot.classList.toggle('active', index === stepIndex);
    });
    
    // Update button text on last step
    const nextBtn = document.querySelector('.tutorial-next-btn');
    if (stepIndex === tutorialState.steps.length - 1) {
        nextBtn.textContent = 'Get Started';
    } else {
        nextBtn.textContent = 'Next';
    }
    
    // Trigger content animation
    const content = document.querySelector('.tutorial-content');
    content.style.animation = 'none';
    setTimeout(() => {
        content.style.animation = 'slideContent 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)';
    }, 10);
}

function nextTutorialStep() {
    tutorialState.currentStep++;
    
    if (tutorialState.currentStep >= tutorialState.steps.length) {
        completeTutorial();
    } else {
        showTutorialStep(tutorialState.currentStep);
    }
}

function skipTutorial() {
    completeTutorial();
}

function completeTutorial() {
    // Hide tutorial screen
    const screen = document.getElementById('tutorial-screen');
    screen.classList.add('hidden');
    
    // Mark tutorial as completed
    localStorage.setItem('filmyfool_tutorial_completed', 'true');
}

// Global function to reset tutorial (can be called from console)
window.resetTutorial = function() {
    localStorage.removeItem('filmyfool_tutorial_completed');
    console.log('%c ✅ Tutorial reset! Refresh the page to see it again.', 'color: #03dac6; font-weight: bold;');
};
