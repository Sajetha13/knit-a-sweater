const startScreen = document.getElementById("start-screen");
const startBtn = document.getElementById("start-btn");
const pauseBtn = document.getElementById("easy-pause-btn");
const restartBtn = document.getElementById("easy-restart-btn");
const retryBtn = document.getElementById("easy-retry-btn");
const timerDisplay = document.getElementById("timer-display");
const keys = document.querySelectorAll(".key");
const rowDirEl = document.getElementById("easy-row-dir");
const sweaterSvg = document.getElementById("easy-svg");
const stitchLayer = document.getElementById("easy-stitch-layer");
const texOverlay = document.getElementById("easy-tex-overlay");
const errorLayer = document.getElementById("easy-error-layer");
const looseYarn = document.getElementById("easy-loose-yarn");
const sweaterBox = document.getElementById("easy-sweater-box");
const progressText = document.getElementById("easy-progress-text");
const mistakesText = document.getElementById("easy-mistakes-text");
const progressFill = document.getElementById("easy-progress-fill");
const feedbackEl = document.getElementById("easy-feedback");

const resultModal = document.getElementById("easy-result-modal");
const resultTitle = document.getElementById("easy-result-title");
const resultSweaterBox = document.getElementById("easy-result-sweater");
const resultCopy = document.getElementById("easy-result-copy");

const pattern = ['d', 'f', 'j', 'k', 'k', 'j', 'f', 'd'];
const YARN_PALETTE = ['#899cb8', '#6f80aa', '#9b7bb8', '#7b8ea8', '#5e7399'];
const TOTAL_STITCHES = 80;
const ROUND_SECONDS = 32;
const Y_MIN = 32;
const Y_MAX = 367;

let currentIndex = 0;
let currentStitch = 0;
let mistakes = 0;
let timeLeft = ROUND_SECONDS;
let timerInterval = null;
let gameActive = false;
let isPaused = false;
let isUnraveling = false;

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
    timerDisplay.classList.toggle('urgent', timeLeft <= 8);
    rowDirEl.textContent = currentIndex < 4 ? "Knit Row → (D F J K)" : "Purl Return ← (K J F D)";
}

function highlightNextKey() {
    keys.forEach(k => k.classList.remove("active"));
    if (!gameActive || isPaused) return;
    const expected = pattern[currentIndex];
    const keyEl = document.querySelector(`.key[data-key="${expected}"]`);
    if (keyEl) keyEl.classList.add("active");
}

function addYarnBand(stitchIndex) {
    const span = Y_MAX - Y_MIN;
    const bandH = (span / TOTAL_STITCHES) + 2.4;
    const y = Y_MAX - (stitchIndex / TOTAL_STITCHES) * span;
    const color = YARN_PALETTE[Math.floor((stitchIndex - 1) / 4) % YARN_PALETTE.length];

    const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    rect.setAttribute("x", "35");
    rect.setAttribute("y", String(y));
    rect.setAttribute("width", "330");
    rect.setAttribute("height", String(bandH));
    rect.setAttribute("fill", color);
    stitchLayer.appendChild(rect);

    texOverlay.setAttribute("y", String(y));
    texOverlay.setAttribute("height", String(Y_MAX - y + 10));
}

function addRedDot(stitchIndex) {
    const span = Y_MAX - Y_MIN;
    const y = Y_MAX - ((stitchIndex + 0.5) / TOTAL_STITCHES) * span;
    const x = 135 + Math.random() * 130;

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
    pauseBtn.textContent = "Pause";
    feedbackEl.textContent = "Forward then back—keep your rhythm tight!";
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
    feedbackEl.textContent = "A red stitch pulled the thread loose!";
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
            resultTitle.textContent = "Sweater Unraveled!";
            resultCopy.textContent = `You finished with ${timeLeft}s left, but ${mistakes} red ${mistakes === 1 ? 'dot' : 'dots'} pulled the whole knit apart.`;
            resultModal.style.display = "flex";
        });
    } else {
        showFinishedSweaterInPopup();
        resultTitle.textContent = "Sweater Done!";
        resultCopy.textContent = `Zero red dots, ${timeLeft}s left on the clock. Clean work.`;
        resultModal.style.display = "flex";
    }
}

document.addEventListener("keydown", (e) => {
    if (!gameActive || isPaused || isUnraveling) return;
    if (e.ctrlKey || e.altKey || e.metaKey) return;

    const pressed = e.key.toLowerCase();
    if (pressed.length !== 1) return;

    const expected = pattern[currentIndex];

    if (pressed === expected) {
        currentStitch++;
        addYarnBand(currentStitch);
        currentIndex = (currentIndex + 1) % pattern.length;
        feedbackEl.textContent = `Clean stitch! Next: ${pattern[currentIndex].toUpperCase()}`;
        feedbackEl.classList.remove("error-text");
        updateHud();
        highlightNextKey();

        if (currentStitch >= TOTAL_STITCHES) {
            finishRound(false);
        }
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
        feedbackEl.textContent = `Dropped a red dot! Keep going, next is ${pattern[currentIndex].toUpperCase()}`;
        feedbackEl.classList.add("error-text");
        updateHud();
        highlightNextKey();

        if (currentStitch >= TOTAL_STITCHES) {
            finishRound(false);
        }
    }
});

startBtn.addEventListener("click", startGame);
pauseBtn.addEventListener("click", togglePause);
restartBtn.addEventListener("click", startGame);
retryBtn.addEventListener("click", startGame);
