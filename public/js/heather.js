const LYRICS = [
  "I still remember, third of December, me in your sweater",
  "You said it looked better on me than it did you",
  "Only if you knew how much I liked you",
  "But I watch your eyes as she",
  "Walks by",
  "What a sight for sore eyes",
  "Brighter than the blue sky",
  "She's got you mesmerized while I die",
  "Why would you ever kiss me?",
  "I'm not even half as pretty",
  "You gave her your sweater, it's just polyester",
  "But you like her better",
  "Wish I were Heather",
  "Watch as she stands with her, holding your hand",
  "Put your arm 'round her shoulder, now I'm getting colder",
  "But how could I hate her? She's such an angel",
  "But then again, kinda wish she were dead as she",
  "Walks by",
  "What a sight for sore eyes",
  "Brighter than the blue sky",
  "She's got you mesmerized while I die",
  "Why would you ever kiss me?",
  "I'm not even half as pretty",
  "You gave her your sweater, it's just polyester",
  "But you like her better",
  "I wish I were Heather",
  "I wish I were Heather",
  "(Oh, oh)",
  "Wish I were Heather",
  "Why would you ever kiss me?",
  "I'm not even half as pretty",
  "You gave her your sweater, it's just polyester",
  "But you like her better",
  "Wish I were-"
];

const YARN_COLORS = ["#899cb8", "#6f80aa", "#b15d3b", "#9b7bb8", "#4e6494", "#c87d63"];
const START_SECONDS = 270;
const Y_MIN = 72;
const Y_MAX = 328;

const lyricsEl = document.getElementById("lyrics");
const startBtn = document.getElementById("start-button");
const restartBtn = document.getElementById("restart-button");
const playAgainBtn = document.getElementById("play-again-button");
const timerEl = document.getElementById("timer");
const feedbackEl = document.getElementById("feedback");
const progressLabelEl = document.getElementById("progress-label");
const mistakeLabelEl = document.getElementById("mistake-label");
const lineCounterLabelEl = document.getElementById("line-counter-label");
const progressFillEl = document.getElementById("progress-fill");
const sweaterSvgEl = document.getElementById("sweater");
const stitchLayerEl = document.getElementById("stitch-layer");
const yarnTexRectEl = document.getElementById("yarn-tex-rect");
const errorLayerEl = document.getElementById("error-layer");
const looseYarnEl = document.getElementById("loose-yarn");
const sweaterBoxEl = document.getElementById("sweater-box");
const overlayEl = document.getElementById("overlay");
const resultTitleEl = document.getElementById("result-title");
const resultSweaterEl = document.getElementById("result-sweater");
const resultCopyEl = document.getElementById("result-copy");

let charStates = LYRICS.map(line => new Array(line.length).fill(null));
let errorDotsByPos = new Map();

let lineIndex = 0;
let charIndex = 0;
let mistakes = 0;
let typedCharsCount = 0;
const totalChars = LYRICS.reduce((sum, line) => sum + line.length, 0);

let secondsLeft = START_SECONDS;
let timerId = null;
let running = false;
let paused = false;
let finished = false;
let unraveling = false;

function formatTime(sec) {
  const m = Math.floor(sec / 60).toString().padStart(2, "0");
  const s = (sec % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

function renderLyrics() {
  lyricsEl.innerHTML = "";
  const startLine = Math.max(0, Math.min(lineIndex - 1, LYRICS.length - 5));
  const endLine = Math.min(LYRICS.length, startLine + 5);

  for (let i = startLine; i < endLine; i++) {
    const lineDiv = document.createElement("div");
    lineDiv.className = "lyric-line";
    if (i < lineIndex) lineDiv.classList.add("past");
    else if (i === lineIndex) lineDiv.classList.add("current");
    else lineDiv.classList.add("upcoming");

    const text = LYRICS[i];
    for (let c = 0; c < text.length; c++) {
      const span = document.createElement("span");
      span.className = "char";
      span.textContent = text[c];

      const st = charStates[i][c];
      if (st === "correct") span.classList.add("correct");
      else if (st === "error") span.classList.add("error");

      if (i === lineIndex && c === charIndex && !finished) {
        span.classList.add("cursor");
      }
      lineDiv.appendChild(span);
    }
    lyricsEl.appendChild(lineDiv);
  }
}

function syncSweaterFill() {
  const ratio = Math.min(1, typedCharsCount / totalChars);
  const span = Y_MAX - Y_MIN;
  const currentTopY = Y_MAX - ratio * span;

  const targetBands = Math.floor(ratio * 90);
  while (stitchLayerEl.children.length < targetBands) {
    const idx = stitchLayerEl.children.length;
    const bandRatio = (idx + 1) / 90;
    const bandH = (span / 90) + 2;
    const y = Y_MAX - bandRatio * span;
    const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    rect.setAttribute("x", "15");
    rect.setAttribute("y", String(y));
    rect.setAttribute("width", "370");
    rect.setAttribute("height", String(bandH));
    rect.setAttribute("fill", YARN_COLORS[idx % YARN_COLORS.length]);
    rect.setAttribute("opacity", "0.78");
    stitchLayerEl.appendChild(rect);
  }
  while (stitchLayerEl.children.length > targetBands && stitchLayerEl.lastChild) {
    stitchLayerEl.removeChild(stitchLayerEl.lastChild);
  }

  yarnTexRectEl.setAttribute("y", String(currentTopY));
  yarnTexRectEl.setAttribute("height", String(Math.max(0, Y_MAX - currentTopY + 8)));
}

function addRedStitchDot(key) {
  const ratio = Math.min(1, typedCharsCount / totalChars);
  const span = Y_MAX - Y_MIN;
  const cy = Y_MAX - (0.1 + ratio * 0.82) * span;
  const cx = 115 + Math.random() * 170;

  const dot = document.createElementNS("http://www.w3.org/2000/svg", "circle");
  dot.setAttribute("cx", String(cx));
  dot.setAttribute("cy", String(cy));
  dot.setAttribute("r", "8.5");
  dot.setAttribute("fill", "#d83a3a");
  dot.setAttribute("stroke", "#fffaf4");
  dot.setAttribute("stroke-width", "1.8");
  errorLayerEl.appendChild(dot);
  errorDotsByPos.set(key, dot);
}

function removeRedStitchDot(key) {
  const dot = errorDotsByPos.get(key);
  if (dot && dot.parentNode) {
    dot.parentNode.removeChild(dot);
  }
  errorDotsByPos.delete(key);
}

function updateStats() {
  const pct = Math.min(100, Math.round((typedCharsCount / totalChars) * 100));
  progressLabelEl.textContent = `${pct}%`;
  progressFillEl.style.width = `${pct}%`;
  mistakeLabelEl.textContent = `${mistakes} ${mistakes === 1 ? "red stitch" : "red stitches"}`;
  lineCounterLabelEl.textContent = `Line ${Math.min(lineIndex + 1, LYRICS.length)} / ${LYRICS.length}`;
  timerEl.textContent = formatTime(secondsLeft);
  timerEl.classList.toggle("urgent", secondsLeft <= 30);
}

function startOrToggleGame() {
  if (finished || unraveling) return;
  if (!running) {
    running = true;
    paused = false;
    startBtn.textContent = "Pause";
    feedbackEl.textContent = "Type the highlighted letter directly on your keyboard...";
    feedbackEl.classList.remove("error-msg");

    clearInterval(timerId);
    timerId = setInterval(() => {
      if (!paused && running && !finished && !unraveling) {
        secondsLeft--;
        updateStats();
        if (secondsLeft <= 0) {
          triggerEndOfSong(true);
        }
      }
    }, 1000);
  } else {
    paused = !paused;
    startBtn.textContent = paused ? "Resume" : "Pause";
    feedbackEl.textContent = paused ? "Paused — catch your breath." : "Keep knitting the lyrics...";
  }
}

function playUnravelAnimation(doneCallback) {
  unraveling = true;
  sweaterBoxEl.classList.add("unravel-shake");
  looseYarnEl.setAttribute("opacity", "1");
  feedbackEl.textContent = "A red stitch is unraveling the whole sweater!";
  feedbackEl.classList.add("error-msg");

  const bands = Array.from(stitchLayerEl.children);
  const total = bands.length;
  if (total === 0) {
    setTimeout(() => {
      sweaterBoxEl.classList.remove("unravel-shake");
      doneCallback();
    }, 650);
    return;
  }

  const stepMs = Math.max(14, Math.floor(1400 / total));
  let idx = total - 1;
  const timer = setInterval(() => {
    for (let k = 0; k < 2 && idx >= 0; k++, idx--) {
      bands[idx].remove();
    }
    if (idx < 0) {
      clearInterval(timer);
      yarnTexRectEl.setAttribute("y", "400");
      setTimeout(() => {
        sweaterBoxEl.classList.remove("unravel-shake");
        doneCallback();
      }, 380);
    }
  }, stepMs);
}

function showFinishedSweaterInPopup() {
  const clone = sweaterSvgEl.cloneNode(true);
  clone.removeAttribute("id");
  resultSweaterEl.innerHTML = "";
  resultSweaterEl.appendChild(clone);
  resultSweaterEl.hidden = false;
}

function triggerEndOfSong(timedOut) {
  finished = true;
  running = false;
  clearInterval(timerId);
  renderLyrics();

  if (timedOut) {
    playUnravelAnimation(() => {
      resultSweaterEl.hidden = true;
      resultTitleEl.textContent = "Time Froze Over.";
      resultCopyEl.textContent = "December came and went before the last line was knitted.";
      overlayEl.hidden = false;
    });
    return;
  }

  if (mistakes > 0) {
    playUnravelAnimation(() => {
      resultSweaterEl.hidden = true;
      resultTitleEl.textContent = "You've Unraveled It.";
      resultCopyEl.textContent = `You typed the entire song, but ${mistakes} red ${mistakes === 1 ? "stitch" : "stitches"} pulled the whole sweater apart at the end.`;
      overlayEl.hidden = false;
    });
  } else {
    showFinishedSweaterInPopup();
    resultTitleEl.textContent = "A Sweater, At Last.";
    resultCopyEl.textContent = "You go give them that sweater right now!! (preferably on 3rd of dec)";
    overlayEl.hidden = false;
  }
}

function resetGame() {
  clearInterval(timerId);
  charStates = LYRICS.map(line => new Array(line.length).fill(null));
  errorDotsByPos.clear();
  lineIndex = 0;
  charIndex = 0;
  mistakes = 0;
  typedCharsCount = 0;
  secondsLeft = START_SECONDS;
  running = false;
  paused = false;
  finished = false;
  unraveling = false;

  resultSweaterEl.innerHTML = "";
  resultSweaterEl.hidden = true;
  stitchLayerEl.innerHTML = "";
  errorLayerEl.innerHTML = "";
  yarnTexRectEl.setAttribute("y", "400");
  looseYarnEl.setAttribute("opacity", "0");
  sweaterBoxEl.classList.remove("unravel-shake");
  overlayEl.hidden = true;
  startBtn.textContent = "Start Knitting";
  feedbackEl.textContent = "Press any letter to start — Backspace fixes a slip on the current line.";
  feedbackEl.classList.remove("error-msg");

  updateStats();
  renderLyrics();
}

function charsMatch(pressed, expected) {
  if (pressed === expected) return true;
  if ((expected === "’" || expected === "'") && (pressed === "'" || pressed === "’")) return true;
  if (expected.toLowerCase() === pressed.toLowerCase()) return true;
  return false;
}

document.addEventListener("keydown", (e) => {
  if (finished || unraveling) return;
  if (e.ctrlKey || e.altKey || e.metaKey) return;

  if (e.key === "Escape") {
    if (running) startOrToggleGame();
    return;
  }

  if (e.key === "Backspace") {
    if (!running || paused) return;
    e.preventDefault();
    if (charIndex > 0) {
      charIndex--;
      const posKey = `${lineIndex}:${charIndex}`;
      if (charStates[lineIndex][charIndex] === "error") {
        mistakes = Math.max(0, mistakes - 1);
        removeRedStitchDot(posKey);
      }
      charStates[lineIndex][charIndex] = null;
      typedCharsCount = Math.max(0, typedCharsCount - 1);
      syncSweaterFill();
      updateStats();
      renderLyrics();
      feedbackEl.textContent = "Undid last stitch on this line.";
      feedbackEl.classList.remove("error-msg");
    }
    return;
  }

  if (e.key.length !== 1) return;

  const currentLine = LYRICS[lineIndex];
  const expectedChar = currentLine[charIndex];
  if (e.key === " " && charIndex === 0 && lineIndex > 0 && expectedChar !== " ") {
    e.preventDefault();
    return;
  }

  if (!running) {
    startOrToggleGame();
  }
  if (paused) return;

  if (e.key === " ") {
    e.preventDefault();
  }

  const posKey = `${lineIndex}:${charIndex}`;
  if (charsMatch(e.key, expectedChar)) {
    charStates[lineIndex][charIndex] = "correct";
    feedbackEl.textContent = "Weaving steady...";
    feedbackEl.classList.remove("error-msg");
  } else {
    charStates[lineIndex][charIndex] = "error";
    mistakes++;
    addRedStitchDot(posKey);
    feedbackEl.textContent = `Red stitch dropped (${mistakes} total) — keep typing to the end, or Backspace to fix!`;
    feedbackEl.classList.add("error-msg");
  }

  typedCharsCount++;
  charIndex++;

  if (charIndex >= currentLine.length) {
    lineIndex++;
    charIndex = 0;
  }

  syncSweaterFill();
  updateStats();

  if (lineIndex >= LYRICS.length) {
    triggerEndOfSong(false);
    return;
  }

  renderLyrics();
});

startBtn.addEventListener("click", startOrToggleGame);
restartBtn.addEventListener("click", resetGame);
playAgainBtn.addEventListener("click", resetGame);

updateStats();
renderLyrics();
