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
let guessesRemaining = 0; // set properly by startMode() based on the active mode's maxGuesses
let gameOver = false;
let guessHistory = [];

function initApp() {
    populateModeSelect();

    document.getElementById("modeSelect").addEventListener("change", (e) => {
        startMode(e.target.value);
    });

    document.getElementById("guessButton").addEventListener("click", handleGuess);

    startCountdown();

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

    guessesRemaining = currentMode.maxGuesses;
    gameOver = false;
    guessHistory = [];
    document.getElementById("resultsBody").innerHTML = "";
    document.getElementById("guessButton").disabled = false;
    document.getElementById("guessCount").textContent = `Guesses remaining: ${guessesRemaining}`;
    showMessage("");

    renderTableHeader();
    await loadItems();
    populateDatalist();
    dailyItem = getDailyItem();
    restoreProgress();
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
    const imageHeader = currentMode.imageFolder ? "<th>Item</th>" : "";
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
        `Next item in ${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
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

    const msg = won
        ? `Correct! The item was ${dailyItem.name}.`
        : `Out of guesses. The item was ${dailyItem.name}.`;

    showMessage(msg);
}

function showMessage(text) {
    document.getElementById("message").textContent = text;
}

function progressKey() {
    return `wordle-progress-${currentModeKey}`;
}

function saveProgress() {
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
            ? `Correct! The item was ${dailyItem.name}.`
            : `Out of guesses. The item was ${dailyItem.name}.`;
        showMessage(msg);
    }
}

initApp();