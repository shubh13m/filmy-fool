# Filmy Fool (v1.0.0)

**Filmy Fool** is a lightweight, high-performance web application designed for daily movie discovery. It eliminates "choice paralysis" by curating a small, high-quality queue of movies every day, allowing users to swipe, rate, and track their cinematic journey.

---

## 🚀 Overview

Filmy Fool is built with a **Mobile-First** philosophy, utilizing a Material Dark "Night Owl" aesthetic. It leverages the OMDb API to pull real-time data and uses a custom recursive fetching strategy to ensure users always receive high-rated recommendations.

### Key Pillars:

1. **Daily Curation:** 5 movies per day, no more, no less.
2. **Swipe-to-Decide:** An intuitive interface for quick decision-making.
3. **Privacy First:** All data (history, ratings, queue) is stored locally on the user's device.
4. **Offline Ready:** Progressive Web App (PWA) capabilities ensure the app works even without a stable connection.

---

## ✨ Features

### 🧠 Smart Discovery Engine

Unlike basic search tools, Filmy Fool uses **Multi-Lane Strategy**. It categorizes movies into four distinct "moods":

* **Pulse:** Action, Thriller, Noir, Heist.
* **Wonder:** Sci-Fi, Fantasy, Space, Cyberpunk.
* **Thought:** Mystery, Psychological, Documentary, Historical.
* **Heart:** Comedy, Animation, Drama, Romance.

### 🏗 "Bottom-Up" UI Architecture

The app features a robust Flexbox layout where action buttons are anchored at the bottom. This prevents "Layout Shift" during image loading, ensuring a stable experience even on slower 3G/4G connections.

### 📊 Review & History

* **Star Ratings:** 1-5 star local tracking.
* **Contextual Tags:** Mark movies as "Family Friendly" or "Repeat Watch."
* **Persistent History:** A dedicated view to scroll through everything you've rated.

---

## 🛠 Technical Stack

* **Frontend:** Vanilla JavaScript (ES6+), HTML5, CSS3.
* **API:** OMDb API (Open Movie Database).
* **Storage:** `localStorage` for state persistence.
* **PWA:** Service Workers (`sw.js`) and Web Manifest (`manifest.json`) for installability and offline caching.
* **Deployment:** GitHub Pages.

---

## 📂 Project Structure

```bash
Filmy-Fool/
├── index.html      # Main entry point and UI structure
├── style.css       # Material Dark (Night Owl) theme and animations
├── app.js          # Core logic, API fetching, and state management
├── sw.js           # Service Worker for caching and updates
├── manifest.json   # PWA configuration and icons
└── README.md       # Project documentation

```

---

## 🔧 Installation & Setup

1. **Clone the Repository:**
```bash
git clone https://github.com/YOUR_USERNAME/Filmy-Fool.git

```


2. **Add your API Key:**
Open `app.js` and replace the `OMDB_API_KEY` with your own key from [omdbapi.com](http://www.omdbapi.com/apikey.aspx).
```javascript
const OMDB_API_KEY = "your_key_here";

```


3. **Local Development:**
Simply open `index.html` in your browser, or use a Live Server (VS Code extension).

---

## 📡 API & Fetching Strategy

Filmy Fool uses a **Recursive Fallback Logic**:

1. **Attempt 1:** Search for movies with an IMDb rating of **7.0+**.
2. **Fallback:** If fewer than 5 movies are found, it automatically drops the threshold to **6.0+** and retries.
3. **Filtering:** Automatically removes duplicates and movies already present in your `filmyfool_history`.

---

## 🎨 Styling Guide

The app uses a custom CSS variable system for easy skinning:
| Variable | Color | Usage |
| :--- | :--- | :--- |
| `--primary` | `#6200ee` | Buttons and Branding |
| `--background`| `#0a0f1e` | Deep Night Background |
| `--surface` | `#161b2c` | Cards and Modals |
| `--secondary` | `#03dac6` | Accents and Success |

---

## 📈 Roadmap

* [x] v1.0.0: Core Swipe and Discovery Logic.
* [ ] v1.1.0: Integration for personal GitHub Gist backup.
* [ ] v1.2.0: Genre-specific lane selection in settings.
* [ ] v2.0.0: Social sharing for "Filmy" movie cards.

---

## 📄 License

This project is open-source and available under the MIT License.

---

**Would you like me to add a "Troubleshooting" section to this README to help with GitHub Pages deployment issues?**
