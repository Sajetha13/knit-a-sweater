const startScreen = document.getElementById("start-screen");
const startBtn = document.getElementById("start-btn");
const pauseBtn = document.getElementById("hard-pause-btn");
const restartBtn = document.getElementById("hard-restart-btn");
const retryBtn = document.getElementById("hard-retry-btn");
const timerDisplay = document.getElementById("timer-display");
const keys = document.querySelectorAll(".key");
const motifStripEl = document.getElementById("hard-motif-strip");
const sweaterSvg = document.getElementById("hard-svg");
const stitchLayer = document.getElementById("hard-stitch-layer");
const texOverlay = document.getElementById("hard-tex-overlay");
const errorLayer = document.getElementById("hard-error-layer");
const looseYarn = document.getElementById("hard-loose-yarn");
const sweaterBox = document.getElementById("hard-sweater-box");
const progressText = document.getElementById("hard-progress-text");
const mistakesText = document.getElementById("hard-mistakes-text");
const progressFill = document.getElementById("hard-progress-fill");
const feedbackEl = document.getElementById("hard-feedback");

const resultModal = document.getElementById("hard-result-modal");
const resultTitle = document.getElementById("hard-result-title");
const resultSweaterBox = document.getElementById("hard-result-sweater");
const resultCopy = document.getElementById("hard-result-copy");

// Alternating left-right hand motifs so it flows smoothly and is genuinely winnable
const LEFT_KEYS = ['e', 'r', 'd', 'f'];
const RIGHT_KEYS = ['u', 'i', 'j', 'k'];
const DEEP_BROWN = '#5c3317';
const MOTIFS_TO_WIN = 12;
const MOTIF_LEN = 4;
const TOTAL_STITCHES = MOTIFS_TO_WIN * MOTIF_LEN; // 48 stitches
const ROUND_SECONDS = 50;
const Y_MIN = 37;
const Y_MAX = 275;

let currentMotif = [];
let motifPos = 0;
let currentStitch = 0;
let mistakes = 0;
let timeLeft = ROUND_SECONDS;
let timerInterval = null;
let gameActive = false;
let isPaused = false;
let isUnraveling = false;

function nextMotif() {
    const l1 = LEFT_KEYS[Math.floor(Math.random() * LEFT_KEYS.length)];
    const r1 = RIGHT_KEYS[Math.floor(Math.random() * RIGHT_KEYS.length)];
    const l2 = LEFT_KEYS[Math.floor(Math.random() * LEFT_KEYS.length)];
    const r2 = RIGHT_KEYS[Math.floor(Math.random() * RIGHT_KEYS.length)];
    return [l1, r1, l2, r2];
}

function renderMotifStrip() {
    motifStripEl.innerHTML = "";
    currentMotif.forEach((ch, idx) => {
        const div = document.createElement("div");
        div.className = "motif-step";
        if (idx < motifPos) div.classList.add("done");
        else if (idx === motifPos) div.classList.add("current");
        div.textContent = ch.toUpperCase();
        motifStripEl.appendChild(div);
    });
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
}

function highlightNextKey() {
    keys.forEach(k => k.classList.remove("active"));
    if (!gameActive || isPaused) return;
    const expected = currentMotif[motifPos];
    const keyEl = document.querySelector(`.key[data-key="${expected}"]`);
    if (keyEl) keyEl.classList.add("active");
}

function addYarnBand(stitchIndex) {
    const span = Y_MAX - Y_MIN;
    const bandH = (span / TOTAL_STITCHES) + 2.8;
    const y = Y_MAX - (stitchIndex / TOTAL_STITCHES) * span;

    const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    rect.setAttribute("x", "15");
    rect.setAttribute("y", String(y));
    rect.setAttribute("width", "370");
    rect.setAttribute("height", String(bandH));
    rect.setAttribute("fill", DEEP_BROWN);
    stitchLayer.appendChild(rect);

    texOverlay.setAttribute("y", String(y));
    texOverlay.setAttribute("height", String(Y_MAX - y + 10));
}

function addRedDot(stitchIndex) {
    const span = Y_MAX - Y_MIN;
    const y = Y_MAX - ((stitchIndex + 0.5) / TOTAL_STITCHES) * span;
    const x = 130 + Math.random() * 145;

    const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    circle.setAttribute("cx", String(x));
    circle.setAttribute("cy", String(y));
    circle.setAttribute("r", "8.5");
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

    currentMotif = nextMotif();
    motifPos = 0;
    currentStitch = 0;
    mistakes = 0;
    timeLeft = ROUND_SECONDS;
    gameActive = true;
    isPaused = false;
    isUnraveling = false;
    pauseBtn.textContent = "Pause";
    feedbackEl.textContent = "Watch the cable motif—alternating hands!";
    feedbackEl.classList.remove("error-text");

    renderMotifStrip();
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
    feedbackEl.textContent = "A red stitch pulled the brown wool loose!";
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
            resultCopy.textContent = `You finished with ${timeLeft}s left, but ${mistakes} red ${mistakes === 1 ? 'dot' : 'dots'} pulled the cable knit apart.`;
            resultModal.style.display = "flex";
        });
    } else {
        showFinishedSweaterInPopup();
        resultTitle.textContent = "Cable Knit Done!";
        resultCopy.textContent = `Zero red dots, ${timeLeft}s left. Rich brown perfection.`;
        resultModal.style.display = "flex";
    }
}

document.addEventListener("keydown", (e) => {
    if (!gameActive || isPaused || isUnraveling) return;
    if (e.ctrlKey || e.altKey || e.metaKey) return;

    const pressed = e.key.toLowerCase();
    if (pressed.length !== 1) return;

    const expected = currentMotif[motifPos];

    if (pressed === expected) {
        currentStitch++;
        addYarnBand(currentStitch);
        motifPos++;
        if (motifPos >= MOTIF_LEN) {
            currentMotif = nextMotif();
            motifPos = 0;
        }
        feedbackEl.textContent = "Clean cable stitch!";
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

        motifPos++;
        if (motifPos >= MOTIF_LEN) {
            currentMotif = nextMotif();
            motifPos = 0;
        }
        feedbackEl.textContent = `Dropped a red dot! (${mistakes} total)`;
        feedbackEl.classList.add("error-text");
    }

    renderMotifStrip();
    updateHud();
    highlightNextKey();

    if (currentStitch >= TOTAL_STITCHES) {
        finishRound(false);
    }
});

startBtn.addEventListener("click", startGame);
pauseBtn.addEventListener("click", togglePause);
restartBtn.addEventListener("click", startGame);
retryBtn.addEventListener("click", startGame);
