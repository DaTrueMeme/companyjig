// DEV RESET CMD: localStorage.removeItem("wordle-progress");

let dailyItem;

async function loadItems() {
    const response = await fetch("items.json");
    const data = await response.json();

    ITEMS = Object.entries(data).map(([name, stats]) => ({
        name: name,
        avgCost: stats.average_value,
        weight: stats.weight,
        twoHanded: stats.two_handed,
        conductive: stats.conductivity,
        interactable: stats.interactable,
        moon: stats.most_common
    }));

    dailyItem = getDailyItem();
    initGame();
}

function getDailyItem() {
    const startDate = new Date("2026-01-07");
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const daysSinceStart = Math.floor((today - startDate) / (1000 * 60 * 60 * 24));
    const index = daysSinceStart % ITEMS.length;

    return ITEMS[index];
}


let guessesRemaining = 5;
let gameOver = false;
let guessHistory = [];

function initGame() {
    const datalist = document.getElementById("itemList");
    ITEMS.forEach(item => {
        const option = document.createElement("option");
        option.value = item.name;
        datalist.appendChild(option);
    });

    document.getElementById("guessButton").addEventListener("click", handleGuess);

    restoreProgress();
    startCountdown();
}

function startCountdown() {
    updateCountdown(); // run once immediately so it's not blank for a second
    setInterval(updateCountdown, 1000);
}

function updateCountdown() {
    if (!gameOver) return;
    const now = new Date();

    const nextReset = new Date();
    nextReset.setHours(24, 0, 0, 0);

    const msRemaining = nextReset - now;

    const hours = Math.floor(msRemaining / (1000 * 60 * 60));
    const minutes = Math.floor((msRemaining / (1000 * 60)) % 60);
    const seconds = Math.floor((msRemaining / 1000) % 60);

    const pad = n => String(n).padStart(2, "0");

    document.getElementById("nextReset").textContent =
        `Next item in ${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
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

loadItems();

function compareGuess(guess) {
    return {
        name: guess.name,
        avgCost: compareNumber(guess.avgCost, dailyItem.avgCost),
        weight: compareNumber(guess.weight, dailyItem.weight),
        twoHanded: compareBoolean(guess.twoHanded, dailyItem.twoHanded),
        conductive: compareBoolean(guess.conductive, dailyItem.conductive),
        interactable: compareBoolean(guess.interactable, dailyItem.interactable),
        moon: compareMoon(guess.moon, dailyItem.moon),
        isCorrect: guess.name === dailyItem.name
    }
}

function compareNumber(guessVal, answerVal) {
    if (guessVal === answerVal) return "correct";
    return guessVal > answerVal ? "lower" : "higher";
}

function compareBoolean(guessVal, answerVal) {
    return guessVal === answerVal ? "correct" : "incorrect";
}

function compareMoon(guessVal, answerVal) {
    return guessVal === answerVal ? "correct" : "incorrect";
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

    saveProgress(guessHistory);

    input.value = "";
    input.focus();
}

function renderGuessRow(result, guess) {
  const row = document.createElement("tr");

  row.innerHTML = `
    <td>${result.name}</td>
    <td class="${result.avgCost}">${arrowFor(result.avgCost)} ${guess.avgCost}▮</td>
    <td class="${result.weight}">${arrowFor(result.weight)} ${guess.weight}lb</td>
    <td class="${result.twoHanded}">${result.twoHanded === "correct" ? "✓" : "✗"} ${guess.twoHanded}</td>
    <td class="${result.conductive}">${result.conductive === "correct" ? "✓" : "✗"} ${guess.conductive}</td>
    <td class="${result.interactable}">${result.interactable === "correct" ? "✓" : "✗"} ${guess.interactable}</td>
    <td class="${result.moon}">${result.moon === "correct" ? "✓" : "✗"} ${guess.moon}</td>
  `;

  document.getElementById("resultsBody").prepend(row);
}

function arrowFor(status) {
  if (status === "correct") return "✓";
  if (status === "higher") return "▲";
  if (status === "lower") return "▼";
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

function saveProgress(guessResults) {
  const todayKey = new Date().toDateString();
  localStorage.setItem("wordle-progress", JSON.stringify({
    date: todayKey,
    guesses: guessResults,
    guessesRemaining: guessesRemaining,
    gameOver: gameOver
  }));
}

function loadProgress() {
  const saved = JSON.parse(localStorage.getItem("wordle-progress"));
  if (saved && saved.date === new Date().toDateString()) {
    return saved;
  }
  return null;
}