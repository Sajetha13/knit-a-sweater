const startScreen = document.getElementById("start-screen");
const startBtn = document.getElementById("start-btn");
const pauseBtn = document.getElementById("medium-pause-btn");
const restartBtn = document.getElementById("medium-restart-btn");
const retryBtn = document.getElementById("medium-retry-btn");
const timerDisplay = document.getElementById("timer-display");
const keys = document.querySelectorAll(".key");
const modeLabelEl = document.getElementById("medium-mode-label");
const rowDirEl = document.getElementById("medium-row-dir");
const keysWrapEl = document.getElementById("medium-keys-wrap");
const breakBoxEl = document.getElementById("medium-break-box");
const breakWordEl = document.getElementById("medium-break-word");
const sweaterSvg = document.getElementById("medium-svg");
const stitchLayer = document.getElementById("medium-stitch-layer");
const texOverlay = document.getElementById("medium-tex-overlay");
const errorLayer = document.getElementById("medium-error-layer");
const looseYarn = document.getElementById("medium-loose-yarn");
const sweaterBox = document.getElementById("medium-sweater-box");
const progressText = document.getElementById("medium-progress-text");
const mistakesText = document.getElementById("medium-mistakes-text");
const progressFill = document.getElementById("medium-progress-fill");
const feedbackEl = document.getElementById("medium-feedback");

const resultModal = document.getElementById("medium-result-modal");
const resultTitle = document.getElementById("medium-result-title");
const resultSweaterBox = document.getElementById("medium-result-sweater");
const resultCopy = document.getElementById("medium-result-copy");

const pattern = ['s', 'd', 'f', 'j', 'k', 'l', 'l', 'k', 'j', 'f', 'd', 's'];
const BREAK_PROMPTS = [
    "finger massage",
    "coffee break",
    "untangle yarn",
    "stretch wrists",
    "check gauge",
    "tea break",
    "purl stitch",
    "yarn over",
    "cast on",
    "bind off"
];
const CARDIGAN_BLUE = '#5a7db8';
const TOTAL_STITCHES = 60; // 5 full 12-stitch cycles; break prompt after stitches 12, 24, 36, 48
const ROUND_SECONDS = 65;
const Y_MIN = 44;
const Y_MAX = 377;

let currentIndex = 0;
let currentStitch = 0;
let mistakes = 0;
let timeLeft = ROUND_SECONDS;
let timerInterval = null;
let gameActive = false;
let isPaused = false;
let isUnraveling = false;

// Break-word state
let inBreakMode = false;
let breakTarget = "";
let breakCharIdx = 0;
let breakStates = [];
let usedBreaks = [];

function pickBreakPrompt() {
    const pool = BREAK_PROMPTS.filter(w => !usedBreaks.includes(w));
    const list = pool.length > 0 ? pool : BREAK_PROMPTS;
    const chosen = list[Math.floor(Math.random() * list.length)];
    usedBreaks.push(chosen);
    return chosen;
}

function renderBreakWord() {
    breakWordEl.innerHTML = "";
    for (let i = 0; i < breakTarget.length; i++) {
        const sp = document.createElement("span");
        sp.className = "break-char";
        sp.textContent = breakTarget[i];
        if (breakStates[i] === "done") sp.classList.add("done");
        else if (breakStates[i] === "err") sp.classList.add("err");
        if (i === breakCharIdx) sp.classList.add("cur");
        breakWordEl.appendChild(sp);
    }
}

function enterBreakMode() {
    inBreakMode = true;
    breakTarget = pickBreakPrompt();
    breakCharIdx = 0;
    breakStates = new Array(breakTarget.length).fill(null);

    keysWrapEl.hidden = true;
    breakBoxEl.hidden = false;
    modeLabelEl.textContent = "Quick Break Prompt!";
    rowDirEl.textContent = "Type the phrase to continue";
    feedbackEl.textContent = "Quick break—type the phrase on screen!";
    feedbackEl.classList.remove("error-text");
    renderBreakWord();
}

function exitBreakMode() {
    inBreakMode = false;
    breakBoxEl.hidden = true;
    keysWrapEl.hidden = false;
    modeLabelEl.textContent = "6-Key Ribbed Cardigan";
    feedbackEl.textContent = "Back on the needles!";
    feedbackEl.classList.remove("error-text");
    updateHud();
    highlightNextKey();
}

function formatClock(sec) {
    const m = Math.floor(sec / 60).toString().padStart(2, '0');
    const s = (sec % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
}

function updateHud() {
    progressText.textContent = `${currentStitch} / ${TOTAL_STITCHES} stitches`;
    mistakesText.textContent = `${mistakes} ${mistakes === 1 ? 'red dot' : 'red dots'}`;
    const pct = Math.min(100, Math.round((currentStitch / TOTAL_STITCHES) * 100));
    progressFill.style.width = `${pct}%`;
    timerDisplay.textContent = formatClock(timeLeft);
    timerDisplay.classList.toggle('urgent', timeLeft <= 10);
    if (!inBreakMode) {
        rowDirEl.textContent = currentIndex < 6 ? "Knit Row → (S D F J K L)" : "Purl Return ← (L K J F D S)";
    }
}

function highlightNextKey() {
    keys.forEach(k => k.classList.remove("active"));
    if (!gameActive || isPaused || inBreakMode) return;
    const expected = pattern[currentIndex];
    const keyEl = document.querySelector(`.key[data-key="${expected}"]`);
    if (keyEl) keyEl.classList.add("active");
}

function addYarnBand(stitchIndex) {
    const span = Y_MAX - Y_MIN;
    const bandH = (span / TOTAL_STITCHES) + 2.5;
    const y = Y_MAX - (stitchIndex / TOTAL_STITCHES) * span;

    const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    rect.setAttribute("x", "20");
    rect.setAttribute("y", String(y));
    rect.setAttribute("width", "360");
    rect.setAttribute("height", String(bandH));
    rect.setAttribute("fill", CARDIGAN_BLUE);
    stitchLayer.appendChild(rect);

    texOverlay.setAttribute("y", String(y));
    texOverlay.setAttribute("height", String(Y_MAX - y + 10));
}

function addRedDot(stitchIndex) {
    const span = Y_MAX - Y_MIN;
    const y = Y_MAX - ((stitchIndex + 0.5) / TOTAL_STITCHES) * span;
    const x = 110 + Math.random() * 140;

    const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    circle.setAttribute("cx", String(x));
    circle.setAttribute("cy", String(y));
    circle.setAttribute("r", "9");
    circle.setAttribute("fill", "#d83a3a");
    circle.setAttribute("stroke", "#fffaf4");
    circle.setAttribute("stroke-width", "2");
    errorLayer.appendChild(circle);
}

function startTimer() {
    clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        if (!gameActive || isPaused || isUnraveling) return;
        timeLeft--;
        updateHud();
        if (timeLeft <= 0) {
            finishRound(true);
        }
    }, 1000);
}

function startGame() {
    startScreen.style.display = "none";
    resultModal.style.display = "none";
    resultSweaterBox.innerHTML = "";
    resultSweaterBox.hidden = true;
    stitchLayer.innerHTML = "";
    errorLayer.innerHTML = "";
    texOverlay.setAttribute("y", "400");
    looseYarn.setAttribute("opacity", "0");
    sweaterBox.classList.remove("unravel-shake");

    currentIndex = 0;
    currentStitch = 0;
    mistakes = 0;
    timeLeft = ROUND_SECONDS;
    gameActive = true;
    isPaused = false;
    isUnraveling = false;
    inBreakMode = false;
    usedBreaks = [];
    breakBoxEl.hidden = true;
    keysWrapEl.hidden = false;
    modeLabelEl.textContent = "6-Key Ribbed Cardigan";
    pauseBtn.textContent = "Pause";
    feedbackEl.textContent = "Sweep left-to-right, then purl back!";
    feedbackEl.classList.remove("error-text");

    updateHud();
    highlightNextKey();
    startTimer();
}

function togglePause() {
    if (!gameActive || isUnraveling) return;
    isPaused = !isPaused;
    pauseBtn.textContent = isPaused ? "Resume" : "Pause";
    feedbackEl.textContent = isPaused ? "Paused—catch your breath." : "Back on the needles!";
    highlightNextKey();
}

function playUnravelAnimation(callback) {
    isUnraveling = true;
    sweaterBox.classList.add("unravel-shake");
    looseYarn.setAttribute("opacity", "1");
    feedbackEl.textContent = "A red stitch pulled the blue wool loose!";
    feedbackEl.classList.add("error-text");

    const bands = Array.from(stitchLayer.children);
    const total = bands.length;
    if (total === 0) {
        setTimeout(() => {
            sweaterBox.classList.remove("unravel-shake");
            callback();
        }, 700);
        return;
    }

    const stepMs = Math.max(14, Math.floor(1300 / total));
    let idx = total - 1;
    const unravelTimer = setInterval(() => {
        for (let k = 0; k < 2 && idx >= 0; k++, idx--) {
            bands[idx].remove();
        }
        if (idx < 0) {
            clearInterval(unravelTimer);
            texOverlay.setAttribute("y", "400");
            setTimeout(() => {
                sweaterBox.classList.remove("unravel-shake");
                callback();
            }, 350);
        }
    }, stepMs);
}

function showFinishedSweaterInPopup() {
    const clone = sweaterSvg.cloneNode(true);
    clone.removeAttribute("id");
    resultSweaterBox.innerHTML = "";
    resultSweaterBox.appendChild(clone);
    resultSweaterBox.hidden = false;
}

function finishRound(timedOut) {
    gameActive = false;
    clearInterval(timerInterval);
    keys.forEach(k => k.classList.remove("active"));

    if (timedOut) {
        playUnravelAnimation(() => {
            resultSweaterBox.hidden = true;
            resultTitle.textContent = "Out of Time!";
            resultCopy.textContent = `Clock hit zero at ${currentStitch} / ${TOTAL_STITCHES} stitches (${mistakes} red ${mistakes === 1 ? 'dot' : 'dots'}).`;
            resultModal.style.display = "flex";
        });
        return;
    }

    if (mistakes > 0) {
        playUnravelAnimation(() => {
            resultSweaterBox.hidden = true;
            resultTitle.textContent = "Cardigan Unraveled!";
            resultCopy.textContent = `You finished with ${timeLeft}s left, but ${mistakes} red ${mistakes === 1 ? 'dot' : 'dots'} pulled the blue cardigan apart.`;
            resultModal.style.display = "flex";
        });
    } else {
        showFinishedSweaterInPopup();
        resultTitle.textContent = "Cardigan Done!";
        resultCopy.textContent = `Zero red dots, ${timeLeft}s to spare. Crisp blue knit.`;
        resultModal.style.display = "flex";
    }
}

document.addEventListener("keydown", (e) => {
    if (!gameActive || isPaused || isUnraveling) return;
    if (e.ctrlKey || e.altKey || e.metaKey) return;

    if (inBreakMode) {
        if (e.key === " ") e.preventDefault();
        if (e.key.length !== 1) return;

        const expectedCh = breakTarget[breakCharIdx];
        if (e.key.toLowerCase() === expectedCh) {
            breakStates[breakCharIdx] = "done";
            feedbackEl.textContent = "Nice break rhythm...";
            feedbackEl.classList.remove("error-text");
        } else {
            breakStates[breakCharIdx] = "err";
            mistakes++;
            addRedDot(currentStitch);
            updateHud();
            feedbackEl.textContent = `Slipped on the break word! (${mistakes} red ${mistakes === 1 ? 'dot' : 'dots'})`;
            feedbackEl.classList.add("error-text");
        }

        breakCharIdx++;
        if (breakCharIdx >= breakTarget.length) {
            exitBreakMode();
        } else {
            renderBreakWord();
        }
        return;
    }

    const pressed = e.key.toLowerCase();
    if (pressed.length !== 1) return;

    const expected = pattern[currentIndex];

    if (pressed === expected) {
        currentStitch++;
        addYarnBand(currentStitch);
        currentIndex = (currentIndex + 1) % pattern.length;
        feedbackEl.textContent = `Smooth stitch! Next: ${pattern[currentIndex].toUpperCase()}`;
        feedbackEl.classList.remove("error-text");
    } else {
        mistakes++;
        currentStitch++;
        addYarnBand(currentStitch);
        addRedDot(currentStitch);

        const pressedEl = document.querySelector(`.key[data-key="${pressed}"]`) || document.querySelector(`.key[data-key="${expected}"]`);
        if (pressedEl) {
            pressedEl.classList.add("wrong-flash");
            setTimeout(() => pressedEl.classList.remove("wrong-flash"), 180);
        }

        currentIndex = (currentIndex + 1) % pattern.length;
        feedbackEl.textContent = `Dropped a red dot! Next is ${pattern[currentIndex].toUpperCase()}`;
        feedbackEl.classList.add("error-text");
    }

    updateHud();
    highlightNextKey();

    if (currentStitch >= TOTAL_STITCHES) {
        finishRound(false);
        return;
    }

    // Trigger a knitting break prompt after every full 12-stitch to-and-fro cycle
    if (currentStitch % 12 === 0) {
        enterBreakMode();
    }
});

startBtn.addEventListener("click", startGame);
pauseBtn.addEventListener("click", togglePause);
restartBtn.addEventListener("click", startGame);
retryBtn.addEventListener("click", startGame);
