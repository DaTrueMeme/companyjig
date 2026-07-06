// DEV RESET CMD (clears every mode's saved progress):
// Object.keys(localStorage).filter(k => k.startsWith("wordle-progress-")).forEach(k => localStorage.removeItem(k));

const RESET_HOUR_UTC = 0;
const START_DATE_UTC = Date.UTC(2026, 0, 7, RESET_HOUR_UTC, 0, 0);

const GAME_MODES = {
    scrapItems: {
        label: "Scrap Items",
        dataFile: "data/scrap_items.json",
        imageFolder: "images/scrap_items/",
        maxGuesses: 5,
        categories: [
            {key: "avgCost", jsonKey: "average_value", label: "Avg Cost", type: "number", unit: "▮"},
            {key: "weight", jsonKey: "weight", label: "Weight", type: "number", unit: "lb"},
            {key: "twoHanded", jsonKey: "two_handed", label: "Two-Handed", type: "exact"},
            {key: "conductive", jsonKey: "conductivity", label: "Conductive", type: "exact"},
            {key: "interactable", jsonKey: "interactable", label: "Interactable", type: "exact"},
            {key: "moon", jsonKey: "most_common", label: "Moon", type: "exact"}
        ]
    },
    moons: {
        label: "Moons",
        dataFile: "data/moons.json",
        imageFolder: "images/moons/",
        maxGuesses: 3,
        categories: [
            {key: "price", jsonKey: "price", label: "Price", type: "number", unit: "▮"},
            {key: "riskLevel", jsonKey: "risk_level", label: "Risk Level", type: "exact"},
            {key: "maxIndoorPower", jsonKey: "max_indoor_power", label: "Max Indoor Power", type: "number", unit: ""},
            {key: "maxOutdoorPower", jsonKey: "max_outdoor_power", label: "Max Outdoor Power", type: "number", unit: ""},
        ]
    },
    monsters: {
        label: "Monsters",
        dataFile: "data/monsters.json",
        imageFolder: "images/monsters/",
        maxGuesses: 5,
        categories: [
            {key: "health", jsonKey: "health", label: "Health", type: "number", unit: "HP"},
            {key: "powerLevel", jsonKey: "power_level", label: "Power Level", type: "number"},
            {key: "maxSpawned", jsonKey: "max_spawned", label: "Max Spawned", type: "number"},
            {key: "hostile", jsonKey: "hostile", label: "Hostile", type: "exact"},
            {key: "canBeStunned", jsonKey: "stunnable", label: "Stunnable", type: "exact"},
            {key: "moon", jsonKey: "most_common", label: "Favorite Moon", type: "exact"}
        ]
    } 
};

let currentModeKey = null;
let currentMode = null;
let ITEMS = [];
let dailyItem;
let guessesRemaining = 0;
let gameOver = false;
let guessHistory = [];
let endlessMode = false;

function initApp() {
    populateModeSelect();

    document.getElementById("modeSelect").addEventListener("change", (e) => {
        startMode(e.target.value);
    });

    document.getElementById("endlessToggle").addEventListener("change", (e) => {
        endlessMode = e.target.checked;
        localStorage.setItem("endless-mode", endlessMode ? "true" : "false");
        startRound();
    });

    document.getElementById("newRoundButton").addEventListener("click", startRound);

    document.getElementById("guessButton").addEventListener("click", handleGuess);

    startCountdown();

    endlessMode = localStorage.getItem("endless-mode") === "true";
    document.getElementById("endlessToggle").checked = endlessMode;

    const savedMode = localStorage.getItem("selected-mode");
    const startingMode = (savedMode && GAME_MODES[savedMode]) ? savedMode : Object.keys(GAME_MODES)[0];
    document.getElementById("modeSelect").value = startingMode;
    startMode(startingMode);
}

function populateModeSelect() {
    const select = document.getElementById("modeSelect");
    Object.entries(GAME_MODES).forEach(([key, mode]) => {
        const option = document.createElement("option");
        option.value = key;
        option.textContent = mode.label;
        select.appendChild(option);
    });
}

async function startMode(modeKey) {
    currentModeKey = modeKey;
    currentMode = GAME_MODES[modeKey];
    localStorage.setItem("selected-mode", modeKey);

    renderTableHeader();
    await loadItems();
    populateDatalist();

    startRound();
}

function startRound() {
    guessesRemaining = currentMode.maxGuesses;
    gameOver = false;
    guessHistory = [];
    document.getElementById("resultsBody").innerHTML = "";
    document.getElementById("guessButton").disabled = false;
    document.getElementById("guessCount").textContent = `Guesses remaining: ${guessesRemaining}`;
    document.getElementById("newRoundButton").style.display = endlessMode ? "inline-block" : "none";
    showMessage("");

    dailyItem = pickItem();

    renderStreak(endlessMode ? loadEndlessStreak() : loadStreak().streak);

    if (!endlessMode) {
        restoreProgress();
    }
}

function pickItem() {
    if (endlessMode) {
        const randomIndex = Math.floor(Math.random() * ITEMS.length);
        return ITEMS[randomIndex];
    }
    return getDailyItem();
}

async function loadItems() {
    const response = await fetch(currentMode.dataFile);
    const data = await response.json();

    ITEMS = Object.entries(data).map(([name, stats]) => {
        const item = { name: name };
        currentMode.categories.forEach(cat => {
            item[cat.key] = stats[cat.jsonKey];
        });
        return item;
    });
}

function populateDatalist() {
    const datalist = document.getElementById("itemList");
    datalist.innerHTML = "";
    ITEMS.forEach(item => {
        const option = document.createElement("option");
        option.value = item.name;
        datalist.appendChild(option);
    });
}

function renderTableHeader() {
    const headerRow = document.getElementById("tableHeaderRow");
    const imageHeader = currentMode.imageFolder ? "<th>Entry</th>" : "";
    headerRow.innerHTML = "<th></th>" + imageHeader +
        currentMode.categories.map(cat => `<th>${cat.label}</th>`).join("");
}

function getGameDayKey() {
    const now = new Date();
    return Math.floor((now - START_DATE_UTC) / (1000 * 60 * 60 * 24));
}

function getDailyItem() {
    const index = getGameDayKey() % ITEMS.length;
    return ITEMS[index];
}

function startCountdown() {
    updateCountdown();
    setInterval(updateCountdown, 1000);
}

function updateCountdown() {
    if (endlessMode) {
        document.getElementById("nextReset").textContent = "Endless Mode; no daily limit";
        return;
    }

    const now = new Date();

    const nextReset = new Date(Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate(),
        RESET_HOUR_UTC, 0, 0
    ));

    if (nextReset <= now) {
        nextReset.setUTCDate(nextReset.getUTCDate() + 1);
    }

    const msRemaining = nextReset - now;

    const hours = Math.floor(msRemaining / (1000 * 60 * 60));
    const minutes = Math.floor((msRemaining / (1000 * 60)) % 60);
    const seconds = Math.floor((msRemaining / 1000) % 60);

    const pad = n => String(n).padStart(2, "0");

    document.getElementById("nextReset").textContent =
        `Next update in ${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

function compareValue(type, guessVal, answerVal) {
    if (type === "number") {
        if (guessVal === answerVal) return "correct";
        return guessVal > answerVal ? "lower" : "higher";
    }
    return guessVal === answerVal ? "correct" : "incorrect";
}

function compareGuess(guess) {
    const categories = {};
    currentMode.categories.forEach(cat => {
        categories[cat.key] = compareValue(cat.type, guess[cat.key], dailyItem[cat.key]);
    });

    return {
        name: guess.name,
        categories: categories,
        isCorrect: guess.name === dailyItem.name
    };
}

function handleGuess() {
    if (gameOver) return;

    document.getElementById("resultsTable").style.display = "table";

    const input = document.getElementById("guessInput");
    const guessName = input.value.trim();

    const guessedItem = ITEMS.find(
        item => item.name.toLowerCase() === guessName.toLowerCase()
    );

    if (!guessedItem) {
        showMessage("Not a valid item name.");
        return;
    }

    const result = compareGuess(guessedItem);
    renderGuessRow(result, guessedItem);

    guessesRemaining--;
    document.getElementById("guessCount").textContent = `Guesses remaining: ${guessesRemaining}`;

    guessHistory.push({ result: result, guess: guessedItem });

    if (result.isCorrect) {
        endGame(true);
    } else if (guessesRemaining === 0) {
        endGame(false);
    }

    saveProgress();

    input.value = "";
    input.focus();
}

function renderGuessRow(result, guess) {
    const row = document.createElement("tr");
    row.classList.add("fade-in");

    let html = imageCell(guess.name);
    html += `<td>${result.name}</td>`;

    currentMode.categories.forEach(cat => {
        const status = result.categories[cat.key];
        const value = guess[cat.key];
        html += `<td class="${status}">${formatCell(cat, status, value)}</td>`;
    });

    row.innerHTML = html;
    document.getElementById("resultsBody").prepend(row);
}

function imageCell(itemName) {
    if (!currentMode.imageFolder) return "";

    const src = `${currentMode.imageFolder}${encodeURIComponent(itemName)}.png`;
    const fallback = `${currentMode.imageFolder}missing.png`;

    return `<td><img src="${src}" alt="${itemName}" class="item-image"
        onerror="this.onerror=null; this.src='${fallback}';"></td>`;
}

function formatCell(category, status, value) {
    if (category.type === "number") {
        return `${arrowFor(status)} ${value}${category.unit || ""}`;
    }
    const icon = status === "correct" ? "✓" : "✗";
    return `${icon} ${value}`;
}

function arrowFor(status) {
    if (status === "correct") return "✓";
    if (status === "higher") return "▲";
    if (status === "lower") return "▼";
    return "";
}

function endGame(won) {
    gameOver = true;
    document.getElementById("guessButton").disabled = true;

    if (endlessMode) {
        updateEndlessStreakAfterGame(won);
    } else {
        updateStreakAfterGame(won);
    }

    const msg = won
        ? `Correct! The entry was ${dailyItem.name}.`
        : `Out of guesses. The entry was ${dailyItem.name}.`;

    showMessage(msg);
}

function showMessage(text) {
    document.getElementById("message").textContent = text;
}

function progressKey() {
    return `wordle-progress-${currentModeKey}`;
}

function streakKey() {
    return `streak-${currentModeKey}`;
}

function loadStreak() {
    const saved = JSON.parse(localStorage.getItem(streakKey()));
    return saved || { streak: 0, lastPlayedGameDay: null };
}

function saveStreak(streakData) {
    localStorage.setItem(streakKey(), JSON.stringify(streakData));
}

function renderStreak(streak) {
    document.getElementById("streakDisplay").textContent = endlessMode
        ? `🔥 Endless Streak: ${streak}`
        : `🔥 Daily Streak: ${streak}`;
}

function endlessStreakKey() {
    return `endless-streak-${currentModeKey}`;
}

function loadEndlessStreak() {
    const saved = parseInt(localStorage.getItem(endlessStreakKey()), 10);
    return isNaN(saved) ? 0 : saved;
}

function saveEndlessStreak(streak) {
    localStorage.setItem(endlessStreakKey(), streak);
}

function updateEndlessStreakAfterGame(won) {
    const updated = won ? loadEndlessStreak() + 1 : 0;
    saveEndlessStreak(updated);
    renderStreak(updated);
}

function updateStreakAfterGame(won) {
    if (endlessMode) return;

    const streakData = loadStreak();
    const today = getGameDayKey();

    if (won && streakData.lastPlayedGameDay === today - 1) {
        streakData.streak += 1;
    } else if (won) {
        streakData.streak = 1;
    } else {
        streakData.streak = 0;
    }

    streakData.lastPlayedGameDay = today;
    saveStreak(streakData);
    renderStreak(streakData.streak);
}

function saveProgress() {
    if (endlessMode) return;

    localStorage.setItem(progressKey(), JSON.stringify({
        gameDay: getGameDayKey(),
        guesses: guessHistory,
        guessesRemaining: guessesRemaining,
        gameOver: gameOver
    }));
}

function loadProgress() {
    const saved = JSON.parse(localStorage.getItem(progressKey()));
    if (saved && saved.gameDay === getGameDayKey()) {
        document.getElementById("resultsTable").style.display = "table";
        return saved;
    }
    return null;
}

function restoreProgress() {
    const saved = loadProgress();
    if (!saved) return;

    saved.guesses.forEach(entry => {
        renderGuessRow(entry.result, entry.guess);
    });

    guessesRemaining = saved.guessesRemaining;
    gameOver = saved.gameOver;
    guessHistory = saved.guesses;

    document.getElementById("guessCount").textContent = `Guesses remaining: ${guessesRemaining}`;

    if (gameOver) {
        document.getElementById("guessButton").disabled = true;
        const lastEntry = saved.guesses[saved.guesses.length - 1];
        const won = lastEntry && lastEntry.result.isCorrect;
        const msg = won
            ? `Correct! The entry was ${dailyItem.name}.`
            : `Out of guesses. The entry was ${dailyItem.name}.`;
        showMessage(msg);
    }
}

initApp();