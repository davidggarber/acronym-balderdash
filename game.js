const STORAGE_KEY = "acronym-balderdash-state-v1";
const REVEAL_SHOW_DELAY_MS = 620;

const state = {
	roundIndex: 0,
	revealedCount: 0,
	revealedCorrect: false,
	activeGuessIndex: -1,
	displayOrder: [],
	hintMode: "none",
	hallHiddenGuessIndices: [],
	lastVotedGuessIndex: null,
	roundValidationErrors: [],
	revealButtonVisible: false,
	revealShowTimer: null,
	currentRoundVotes: [],
	pendingRoundIndex: null,
	pendingRoundVotes: {},
	cumulativeVotes: {},
	roundPlayCounts: {},
};

const ui = {
	roundLabel: null,
	acronymLabel: null,
	guessGrid: null,
	statusLabel: null,
	prevRoundBtn: null,
	nextRoundBtn: null,
	prevGuessBtn: null,
	nextGuessBtn: null,
	revealBtn: null,
	fiftyFiftyBtn: null,
	montyHallBtn: null,
};

const experiments = {
	fiftyFifty: false,
	montyHall: true,
}

const runtime = {
	isMobileDevice: false,
};

function detectMobileDevice() {
	if (navigator.userAgentData && navigator.userAgentData.mobile) {
		return true;
	}

	const ua = navigator.userAgent || "";
	const mobileUa = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
	const coarsePointer = typeof window.matchMedia === "function" && window.matchMedia("(any-pointer: coarse)").matches;
	const narrowViewport = typeof window.matchMedia === "function" && window.matchMedia("(max-width: 820px)").matches;
	return mobileUa || (coarsePointer && narrowViewport);
}

function applyDefaultRoundReveal(round) {
	if (!round || !runtime.isMobileDevice) {
		return;
	}

	state.revealedCount = round.guesses.length;
	state.activeGuessIndex = -1;
}

function getRoundCount() {
	return Array.isArray(rounds) ? rounds.length : 0;
}

function getCurrentRound() {
	return rounds[state.roundIndex];
}

function loadState() {
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) {
			resetRoundVotes();
			return;
		}

		const parsed = JSON.parse(raw);
		if (Number.isInteger(parsed.roundIndex)) {
			state.roundIndex = Math.max(0, Math.min(getRoundCount() - 1, parsed.roundIndex));
		}
		if (parsed.cumulativeVotes && typeof parsed.cumulativeVotes === "object") {
			state.cumulativeVotes = parsed.cumulativeVotes;
		}
		if (parsed.roundPlayCounts && typeof parsed.roundPlayCounts === "object") {
			state.roundPlayCounts = parsed.roundPlayCounts;
		}
		if (Number.isInteger(parsed.pendingRoundIndex)) {
			state.pendingRoundIndex = parsed.pendingRoundIndex;
		}
		if (parsed.pendingRoundVotes && typeof parsed.pendingRoundVotes === "object") {
			state.pendingRoundVotes = parsed.pendingRoundVotes;
		}
		resetRoundVotes();
	} catch (err) {
		console.warn("Failed to load saved state.", err);
		resetRoundVotes();
	}
}

function saveState() {
	try {
		const round = getCurrentRound();
		const pendingRoundVotes = round ? currentRoundVotesToStoredObject(round, state.currentRoundVotes) : {};
		const hasPendingVotes =
			!!round &&
			isVotingOpen(round) &&
			!state.revealedCorrect &&
			Object.values(pendingRoundVotes).some((count) => (count || 0) > 0);
		state.pendingRoundIndex = hasPendingVotes ? state.roundIndex : null;
		state.pendingRoundVotes = hasPendingVotes ? pendingRoundVotes : {};

		localStorage.setItem(
			STORAGE_KEY,
			JSON.stringify({
				roundIndex: state.roundIndex,
				pendingRoundIndex: state.pendingRoundIndex,
				pendingRoundVotes: state.pendingRoundVotes,
				cumulativeVotes: state.cumulativeVotes,
				roundPlayCounts: state.roundPlayCounts,
			}),
		);
	} catch (err) {
		console.warn("Failed to save state.", err);
	}
}

function resetRoundVotes() {
	const round = getCurrentRound();
	state.currentRoundVotes = round ? new Array(round.guesses.length).fill(0) : [];
}

function clearPendingRoundState() {
	state.pendingRoundIndex = null;
	state.pendingRoundVotes = {};
}

function shuffleDisplayOrder() {
	const round = getCurrentRound();
	if (!round) {
		state.displayOrder = [];
		return;
	}

	const order = Array.from({ length: round.guesses.length }, (_, idx) => idx);
	for (let i = order.length - 1; i > 0; i -= 1) {
		const j = Math.floor(Math.random() * (i + 1));
		const tmp = order[i];
		order[i] = order[j];
		order[j] = tmp;
	}

	state.displayOrder = order;
}

function cacheUi() {
	ui.roundLabel = document.getElementById("roundLabel");
	ui.acronymLabel = document.getElementById("acronymLabel");
	ui.guessGrid = document.getElementById("guessGrid");
	ui.statusLabel = document.getElementById("statusLabel");
	ui.prevRoundBtn = document.getElementById("prevRoundBtn");
	ui.nextRoundBtn = document.getElementById("nextRoundBtn");
	ui.prevGuessBtn = document.getElementById("prevGuessBtn");
	ui.nextGuessBtn = document.getElementById("nextGuessBtn");
	ui.revealBtn = document.getElementById("revealBtn");
	if (experiments.fiftyFifty) {
		ui.fiftyFiftyBtn = document.getElementById("5050Btn");
	}
	else {
		document.getElementById("5050Btn").style.display = "none";
	}
	if (experiments.montyHall) {
		ui.montyHallBtn = document.getElementById("montyHallBtn");
	}
	else {
		document.getElementById("montyHallBtn").style.display = "none";
	}
}

function forEachRevealGroupButton(callback) {
	[ui.revealBtn, ui.fiftyFiftyBtn, ui.montyHallBtn].forEach((btn) => {
		if (btn) {
			callback(btn);
		}
	});
}

function setRevealGroupHidden() {
	forEachRevealGroupButton((btn) => {
		btn.style.visibility = "hidden";
		btn.classList.remove("reveal-visible");
	});
}

function setRevealGroupVisible() {
	forEachRevealGroupButton((btn) => {
		btn.style.visibility = "visible";
		btn.classList.add("reveal-visible");
	});
}

function bindEvents() {
	ui.prevRoundBtn.addEventListener("click", (event) => moveToPreviousRound(event));
	ui.nextRoundBtn.addEventListener("click", (event) => moveToNextRound(event));
	ui.prevGuessBtn.addEventListener("click", () => stepGuess(-1));
	ui.nextGuessBtn.addEventListener("click", () => stepGuess(1));
	ui.revealBtn.addEventListener("click", revealCorrect);
	if (ui.fiftyFiftyBtn) {
		ui.fiftyFiftyBtn.addEventListener("click", applyFiftyFifty);
	}
	if (ui.montyHallBtn) {
		ui.montyHallBtn.addEventListener("click", handleMontyHallClick);
	}
	ui.guessGrid.addEventListener("click", handleGuessClick);
	document.addEventListener("keydown", handleKeyDown);
}

function commitCurrentRoundVotes() {
	const round = getCurrentRound();
	if (!round) {
		return;
	}

	const hasVotes = state.currentRoundVotes.some((count) => count > 0);
	const playedRound = state.revealedCount > 0 || hasVotes;
	if (!playedRound) {
		return;
	}

	const roundKey = String(state.roundIndex);
	const existing = normalizeStoredRoundVotes(round, state.cumulativeVotes[roundKey]);
	const merged = { ...existing };
	for (let idx = 0; idx < round.guesses.length; idx += 1) {
		const key = getGuessVoteStorageKey(round, idx);
		merged[key] = (merged[key] || 0) + (state.currentRoundVotes[idx] || 0);
	}
	state.cumulativeVotes[roundKey] = merged;
	state.roundPlayCounts[roundKey] = (state.roundPlayCounts[roundKey] || 0) + 1;
}

function commitPendingRoundVotesToStatistics() {
	if (!Number.isInteger(state.pendingRoundIndex)) {
		return;
	}

	const round = rounds[state.pendingRoundIndex];
	if (!round) {
		return;
	}

	const pendingVotes = normalizeStoredRoundVotes(round, state.pendingRoundVotes);
	const hasVotes = Object.values(pendingVotes).some((count) => (count || 0) > 0);
	if (!hasVotes) {
		return;
	}

	const roundKey = String(state.pendingRoundIndex);
	const existing = normalizeStoredRoundVotes(round, state.cumulativeVotes[roundKey]);
	const merged = { ...existing };
	for (let idx = 0; idx < round.guesses.length; idx += 1) {
		const key = getGuessVoteStorageKey(round, idx);
		merged[key] = (merged[key] || 0) + (pendingVotes[key] || 0);
	}
	state.cumulativeVotes[roundKey] = merged;
	state.roundPlayCounts[roundKey] = (state.roundPlayCounts[roundKey] || 0) + 1;
}

function getGuessVoteStorageKey(round, guessIndex) {
	const raw = typeof round?.guesses?.[guessIndex]?.definition === "string" ? round.guesses[guessIndex].definition.trim() : "";
	const base = raw.length > 0 ? raw : `guess-${guessIndex + 1}`;
	let duplicateCount = 0;
	for (let i = 0; i < guessIndex; i += 1) {
		const prev =
			typeof round?.guesses?.[i]?.definition === "string"
				? round.guesses[i].definition.trim()
				: `guess-${i + 1}`;
		if (prev === base) {
			duplicateCount += 1;
		}
	}

	return duplicateCount === 0 ? base : `${base}#${duplicateCount + 1}`;
}

function normalizeStoredRoundVotes(round, stored) {
	if (Array.isArray(stored)) {
		// Backward compatibility for old index-based vote arrays.
		const converted = {};
		for (let idx = 0; idx < round.guesses.length; idx += 1) {
			const key = getGuessVoteStorageKey(round, idx);
			converted[key] = stored[idx] || 0;
		}
		return converted;
	}

	if (stored && typeof stored === "object") {
		return { ...stored };
	}

	return {};
}

function currentRoundVotesToStoredObject(round, voteArray) {
	const stored = {};
	for (let idx = 0; idx < round.guesses.length; idx += 1) {
		const key = getGuessVoteStorageKey(round, idx);
		stored[key] = voteArray[idx] || 0;
	}
	return stored;
}

function applyStoredVotesToCurrentRound(round, stored) {
	const normalized = normalizeStoredRoundVotes(round, stored);
	state.currentRoundVotes = new Array(round.guesses.length).fill(0);
	for (let idx = 0; idx < round.guesses.length; idx += 1) {
		const key = getGuessVoteStorageKey(round, idx);
		state.currentRoundVotes[idx] = normalized[key] || 0;
	}
}

function validateRound(round) {
	const errors = [];
	const title = typeof round?.acronym === "string" ? round.acronym.trim() : "";
	if (title.length === 0) {
		errors.push("Round title/acronym is empty.");
	}

	if (!Array.isArray(round?.guesses) || round.guesses.length < 4) {
		errors.push("Round must contain at least 4 guesses.");
	}
	if (round?.guesses && round.guesses.length > 6) {
		errors.push("Round must contain at most 6 guesses.");
	}

	if (Array.isArray(round?.guesses)) {
		for (let i = 0; i < round.guesses.length; i += 1) {
			const def = typeof round.guesses[i]?.definition === "string" ? round.guesses[i].definition.trim() : "";
			if (def.length === 0) {
				errors.push(`Guess ${i + 1} has an empty definition.`);
			}
		}

		const hasCorrect = round.guesses.some((guess) => !!guess?.correct);
		if (!hasCorrect) {
			errors.push("Round must have at least one guess flagged Correct.");
		}
	}

	return errors;
}

function setRound(nextIndex) {
	const count = getRoundCount();
	if (count === 0) {
		renderNoRounds();
		return;
	}

	commitCurrentRoundVotes();
	state.roundIndex = (nextIndex + count) % count;
	state.revealedCount = 0;
	state.revealedCorrect = false;
	state.activeGuessIndex = -1;
	state.hintMode = "none";
	state.hallHiddenGuessIndices = [];
	state.lastVotedGuessIndex = null;
	if (state.revealShowTimer !== null) {
		window.clearTimeout(state.revealShowTimer);
		state.revealShowTimer = null;
	}
	state.revealButtonVisible = false;
	resetRoundVotes();
	shuffleDisplayOrder();
	if (state.pendingRoundIndex === state.roundIndex) {
		applyStoredVotesToCurrentRound(getCurrentRound(), state.pendingRoundVotes);
	}
	state.roundValidationErrors = validateRound(getCurrentRound());
	if (state.roundValidationErrors.length > 0) {
		console.error(`Round ${state.roundIndex + 1} is invalid: ${state.roundValidationErrors.join(" ")}`);
	}
	applyDefaultRoundReveal(getCurrentRound());
	saveState();
	render();
}

function stepGuess(direction) {
	const round = getCurrentRound();
	if (!round) {
		return;
	}
	if (state.roundValidationErrors.length > 0) {
		return;
	}

	const maxGuesses = round.guesses.length;
	const nextCount = Math.max(0, Math.min(maxGuesses, state.revealedCount + direction));
	if (nextCount === state.revealedCount) {
		return;
	}

	state.revealedCount = nextCount;
	state.revealedCorrect = false;
	state.activeGuessIndex = direction > 0 && nextCount > 0 ? nextCount - 1 : -1;
	if (nextCount < maxGuesses) {
		state.hintMode = "none";
		state.hallHiddenGuessIndices = [];
	}
	render();
}

function applyFiftyFifty() {
	const round = getCurrentRound();
	if (!round || !isVotingOpen(round)) {
		return;
	}

	const bypassConfirm = !!triggerEvent && (triggerEvent.shiftKey || triggerEvent.ctrlKey);
	const ok = bypassConfirm ||window.confirm("Use 50/50 hint? Continue?");
	if (!ok) {
		return;
	}

	state.hintMode = "fifty";
	state.hallHiddenGuessIndices = [];
	render();
}

function getTotalVoteCount() {
	return state.currentRoundVotes.reduce((sum, count) => sum + count, 0);
}

function canShowMontyHallButton(round) {
	if (!round || !isVotingOpen(round) || state.hintMode === "hall") {
		return false;
	}

	const voteCount = getTotalVoteCount();
	return voteCount >= 1 && voteCount < round.guesses.length - 2;
}

function getCurrentVotedGuessIndex() {
	const round = getCurrentRound();
	if (!round) {
		return null;
	}

	if (
		Number.isInteger(state.lastVotedGuessIndex) &&
		state.lastVotedGuessIndex >= 0 &&
		state.lastVotedGuessIndex < round.guesses.length &&
		(state.currentRoundVotes[state.lastVotedGuessIndex] || 0) > 0
	) {
		return state.lastVotedGuessIndex;
	}

	const fallback = state.currentRoundVotes.findIndex((count) => count > 0);
	return fallback >= 0 ? fallback : null;
}

function pickRandomSample(values, count) {
	const pool = [...values];
	for (let i = pool.length - 1; i > 0; i -= 1) {
		const j = Math.floor(Math.random() * (i + 1));
		const tmp = pool[i];
		pool[i] = pool[j];
		pool[j] = tmp;
	}

	return pool.slice(0, Math.max(0, Math.min(count, pool.length)));
}

function computeHallHiddenGuessIndices(round) {
	const voteCount = getTotalVoteCount();
	const targetCount = Math.max(0, round.guesses.length - voteCount - 2);
	if (targetCount === 0) {
		return [];
	}

	const candidates = [];
	for (let idx = 0; idx < round.guesses.length; idx += 1) {
		const hasVotes = (state.currentRoundVotes[idx] || 0) > 0;
		const isCorrect = !!round.guesses[idx].correct;
		if (!hasVotes && !isCorrect) {
			candidates.push(idx);
		}
	}

	return pickRandomSample(candidates, targetCount);
}

function handleMontyHallClick() {
	const round = getCurrentRound();
	if (!round || !isVotingOpen(round)) {
		return;
	}
	if (!canShowMontyHallButton(round)) {
		return;
	}

	state.hintMode = "hall";
	state.hallHiddenGuessIndices = computeHallHiddenGuessIndices(round);
	render();
}

function getCorrectIndex(round) {
	return round.guesses.findIndex((guess) => guess.correct);
}

function revealCorrect() {
	const round = getCurrentRound();
	if (!round) {
		return;
	}

	const totalVotes = state.currentRoundVotes.reduce((sum, count) => sum + count, 0);
	if (totalVotes === 0) {
		const bypassConfirm = !!triggerEvent && (triggerEvent.shiftKey || triggerEvent.ctrlKey);
		const ok = bypassConfirm || window.confirm("No votes have been cast. Reveal anyway?");
		if (!ok) {
			return;
		}
	}

	const correctIndex = getCorrectIndex(round);
	if (correctIndex < 0) {
		ui.statusLabel.textContent = "No Correct-flagged guess found for this round.";
		return;
	}

	const displayIndex = state.displayOrder.indexOf(correctIndex);
	if (displayIndex < 0) {
		ui.statusLabel.textContent = "Correct guess could not be located in current display order.";
		return;
	}

	state.revealedCount = Math.max(state.revealedCount, displayIndex + 1);
	state.revealedCorrect = true;
	state.activeGuessIndex = displayIndex;
	saveState();
	render();
}

function moveToNextRound(triggerEvent) {
	const bypassConfirm = !!triggerEvent && (triggerEvent.shiftKey || triggerEvent.ctrlKey);
	if (state.revealedCount > 0 && !state.revealedCorrect && !bypassConfirm) {
		const ok = window.confirm("Continue to next round without revealing?");
		if (!ok) {
			return;
		}
	}

	setRound(state.roundIndex + 1);
}

function restartCurrentRound() {
	const round = getCurrentRound();
	if (!round) {
		return;
	}

	state.revealedCount = 0;
	state.revealedCorrect = false;
	state.activeGuessIndex = -1;
	state.hintMode = "none";
	state.hallHiddenGuessIndices = [];
	state.lastVotedGuessIndex = null;
	if (state.revealShowTimer !== null) {
		window.clearTimeout(state.revealShowTimer);
		state.revealShowTimer = null;
	}
	state.revealButtonVisible = false;
	resetRoundVotes();
	shuffleDisplayOrder();
	state.roundValidationErrors = validateRound(round);
	if (state.roundValidationErrors.length > 0) {
		console.error(`Round ${state.roundIndex + 1} is invalid: ${state.roundValidationErrors.join(" ")}`);
	}
	applyDefaultRoundReveal(round);
	saveState();
	render();
}

function moveToPreviousRound(triggerEvent) {
	const round = getCurrentRound();
	if (!round) {
		return;
	}

	// Restart only when the round has started but is not yet complete.
	const inProgress = state.revealedCount > 0 && !state.revealedCorrect;
	if (inProgress) {
		const bypassRestart = !!triggerEvent && (triggerEvent.shiftKey || triggerEvent.ctrlKey);
		if (!bypassRestart) {
			const ok = window.confirm("Abort this round?");
			if (!ok) {
				return;
			}
		}

		restartCurrentRound();
		return;
	}

	// Unstarted or completed rounds move to the previous round.
	setRound(state.roundIndex - 1);
}

function isVotingOpen(round) {
	return state.revealedCount >= round.guesses.length;
}

function isGuessDisabledByHint(guess) {
	if (state.hintMode === "fifty") {
		return !!guess.correct && !!guess.coinFlip;
	}

	return false;
}

function isGuessHallEliminated(guessIndex) {
	return state.hintMode === "hall" && state.hallHiddenGuessIndices.includes(guessIndex);
}

function handleGuessClick(event) {
	const round = getCurrentRound();
	if (!round || !isVotingOpen(round)) {
		return;
	}

	const card = event.target.closest(".guess-card");
	if (!card) {
		return;
	}

	const idx = Number.parseInt(card.dataset.guessIndex, 10);
	if (!Number.isInteger(idx) || idx < 0 || idx >= round.guesses.length) {
		return;
	}

	const delta = event.shiftKey ? -1 : 1;
	adjustVote(idx, delta);
	return;
}

function adjustVote(guessIndex, delta) {
	const round = getCurrentRound();
	if (!round || guessIndex < 0 || guessIndex >= round.guesses.length) {
		return;
	}

	if (isGuessDisabledByHint(round.guesses[guessIndex])) {
		return;
	}
	if (isGuessHallEliminated(guessIndex)) {
		return;
	}

	const nextValue = Math.max(0, (state.currentRoundVotes[guessIndex] || 0) + delta);
	state.currentRoundVotes[guessIndex] = nextValue;

	if (delta > 0 && nextValue > 0) {
		state.lastVotedGuessIndex = guessIndex;
	} else if (guessIndex === state.lastVotedGuessIndex && nextValue === 0) {
		state.lastVotedGuessIndex = getCurrentVotedGuessIndex();
	}
	saveState();
	render();
}

function isTextEntryTarget(target) {
	if (!target) {
		return false;
	}

	const tag = target.tagName;
	return target.isContentEditable || tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}

function isEnabled(btnId) {
	const btn = ui[btnId];
	return btn && btn.style.display != "none" && !btn.disabled && btn.style.visibility != "hidden";
}

function handleKeyDown(event) {
	if (isTextEntryTarget(event.target)) {
		return;
	}

	if (event.key === "ArrowRight") {
		event.preventDefault();
		stepGuess(1);
		return;
	}

	if (event.key === "ArrowLeft") {
		if (state.currentRoundVotes.some((count) => count > 0)) {
			return;
		}
		event.preventDefault();
		stepGuess(-1);
		return;
	}

	if (event.key === "ArrowDown" && isEnabled("prevRoundBtn")) {
		event.preventDefault();
		moveToPreviousRound(event);
		return;
	}

	if (event.key === "ArrowUp" && isEnabled("nextRoundBtn")) {
		event.preventDefault();
		moveToNextRound(event);
		return;
	}

	if (event.key === "r" && isEnabled("revealBtn")) {
		event.preventDefault();
		revealCorrect();
		return;
	}

	if (event.key === "m" && isEnabled("montyHallBtn")) {
		event.preventDefault();
		handleMontyHallClick();
		return;
	}

	if (event.key === "f" && isEnabled("5050Btn")) {
		event.preventDefault();
		applyFiftyFifty();
		return;
	}

	if (!event.code || !event.code.startsWith("Digit")) {
		return;
	}

	const digit = Number.parseInt(event.code.slice(5), 10);
	if (!Number.isInteger(digit) || digit < 1) {
		return;
	}

	const round = getCurrentRound();
	if (!round || !isVotingOpen(round)) {
		return;
	}
	if (digit > round.guesses.length) {
		return;
	}

	const idx = digit - 1;
	if (idx < 0 || idx >= round.guesses.length || idx >= state.displayOrder.length) {
		return;
	}

	const originalIndex = state.displayOrder[idx];
	if (!Number.isInteger(originalIndex)) {
		return;
	}

	event.preventDefault();
	adjustVote(originalIndex, event.shiftKey ? -1 : 1);
}

function renderNoRounds() {
	if (state.revealShowTimer !== null) {
		window.clearTimeout(state.revealShowTimer);
		state.revealShowTimer = null;
	}
	state.revealButtonVisible = false;
	setRevealGroupHidden();
	ui.roundLabel.textContent = "No rounds";
	ui.acronymLabel.textContent = "---";
	ui.guessGrid.innerHTML = "";
	ui.statusLabel.textContent = "No game data found in rounds.";
	ui.prevRoundBtn.disabled = true;
	ui.nextRoundBtn.disabled = true;
	ui.prevGuessBtn.disabled = true;
	ui.nextGuessBtn.disabled = true;
	ui.revealBtn.disabled = true;
	if (ui.fiftyFiftyBtn) {
		ui.fiftyFiftyBtn.disabled = true;
	}
	if (ui.montyHallBtn) {
		ui.montyHallBtn.disabled = true;
	}
}

function render() {
	const round = getCurrentRound();
	if (!round) {
		renderNoRounds();
		return;
	}

	ui.roundLabel.textContent = `Round ${state.roundIndex + 1} / ${getRoundCount()}`;
	const titlePrefix = state.roundValidationErrors.length > 0 ? "⚠️ " : "";
	const safeAcronym = typeof round.acronym === "string" ? round.acronym : "";
	ui.acronymLabel.textContent = `${titlePrefix}${safeAcronym}`;
	const allShown = isVotingOpen(round);
	const order =
		state.displayOrder.length === round.guesses.length
			? state.displayOrder
			: Array.from({ length: round.guesses.length }, (_, idx) => idx);

	const cards = order.map((guessIndex, idx) => {
		const guess = round.guesses[guessIndex];
		const classes = [`guess-card`, `guess-${idx + 1}`];
		if (order.length % 2 === 1 && idx === order.length - 1) {
			classes.push("odd-tail");
		}
		const hiddenByHint = isGuessDisabledByHint(guess);
		const hallEliminated = isGuessHallEliminated(guessIndex);
		if (idx >= state.revealedCount) {
			classes.push("hidden");
		}
		if (hiddenByHint) {
			classes.push("filtered-out");
		}
		if (hallEliminated) {
			classes.push("hall-eliminated");
		}
		if (allShown && !hiddenByHint && !hallEliminated) {
			classes.push("vote-enabled");
		}
		if (idx === state.activeGuessIndex) {
			classes.push("active");
		}
		if (state.revealedCorrect && guess.correct) {
			classes.push("correct");
		}
		if (state.revealedCorrect && !guess.correct) {
			classes.push("incorrect");
		}
		const voteCount = state.currentRoundVotes[guessIndex] || 0;
		const stars = voteCount > 0 ? "☆".repeat(voteCount) : "";  // ★
		const revealNotes =
			state.revealedCorrect &&
			guess.correct &&
			typeof guess.notes === "string" &&
			guess.notes.trim().length > 0
				? `
					<hr class="guess-notes-separator">
					<p class="guess-notes"><em>${guess.notes}</em></p>
				`
				: "";

		return `
			<article class="${classes.join(" ")}" data-guess-index="${guessIndex}">
				<div class="guess-index">${idx + 1}</div>
				<p class="guess-definition">${guess.definition}</p>
				${revealNotes}
				<p class="guess-votes">${stars}</p>
			</article>
		`;
	});

	ui.guessGrid.innerHTML = cards.join("");

	// Treat active guess animation as one-shot so non-navigation rerenders (like voting)
	// do not replay the last card animation.
	state.activeGuessIndex = -1;

	if (allShown) {
		ui.statusLabel.textContent = "Please vote! Click to add a star. Shift-click to remove one.";
		if (state.hintMode === "fifty") {
			ui.statusLabel.textContent = "50/50 active. Please vote! Click to add a star. Shift-click to remove one.";
		} else if (state.hintMode === "hall") {
			ui.statusLabel.textContent = "Hall active. You may change your vote.";
		}
		if (state.revealedCorrect) {
			ui.statusLabel.textContent += " Correct answer revealed.";
		}
	} else if (state.revealedCount === 0) {
		ui.statusLabel.textContent = "Press Next Guess to begin this round.";
	} else {
		ui.statusLabel.textContent = `Showing guess ${state.revealedCount} of ${round.guesses.length}.`;
	}

	if (state.roundValidationErrors.length > 0) {
		ui.statusLabel.textContent = `Round data issue: ${state.roundValidationErrors[0]}`;
	}

	ui.prevRoundBtn.disabled = false;
	ui.nextRoundBtn.disabled = false;
	const roundInvalid = state.roundValidationErrors.length > 0;
	const hasAnyVotes = state.currentRoundVotes.some((count) => count > 0);
	const canUseMontyHall = canShowMontyHallButton(round);
	ui.prevGuessBtn.disabled = roundInvalid || state.revealedCount === 0 || hasAnyVotes;
	ui.nextGuessBtn.disabled = roundInvalid || state.revealedCount >= round.guesses.length;
	const guessNavHidden = state.hintMode === "fifty" || state.hintMode === "hall";
	ui.prevGuessBtn.style.visibility = guessNavHidden ? "hidden" : "visible";
	ui.nextGuessBtn.style.visibility = guessNavHidden ? "hidden" : "visible";
	if (state.hintMode === "hall") {
		ui.prevGuessBtn.disabled = true;
	}

	if (ui.fiftyFiftyBtn) {
		ui.fiftyFiftyBtn.disabled = state.hintMode !== "none" || hasAnyVotes;
	}
	if (ui.montyHallBtn) {
		ui.montyHallBtn.textContent = "🚪";
		ui.montyHallBtn.disabled = state.hintMode === "hall" || !canUseMontyHall;
	}
	if (!allShown) {
		if (state.revealShowTimer !== null) {
			window.clearTimeout(state.revealShowTimer);
			state.revealShowTimer = null;
		}
		state.revealButtonVisible = false;
		setRevealGroupHidden();
	} else if (state.revealButtonVisible) {
		setRevealGroupVisible();
	} else if (state.revealShowTimer === null) {
		setRevealGroupHidden();
		state.revealShowTimer = window.setTimeout(() => {
			state.revealShowTimer = null;
			state.revealButtonVisible = true;
			render();
		}, REVEAL_SHOW_DELAY_MS);
	}

	if (allShown && state.revealButtonVisible) {
		if (ui.fiftyFiftyBtn) {
			ui.fiftyFiftyBtn.style.visibility = state.hintMode === "none" ? "visible" : "hidden";
		}
		if (ui.montyHallBtn) {
			ui.montyHallBtn.style.visibility = canUseMontyHall || state.hintMode === "hall" ? "visible" : "hidden";
		}
	}
	ui.revealBtn.disabled = state.revealedCorrect;
}

function init() {
	cacheUi();
	runtime.isMobileDevice = detectMobileDevice();
	loadState();
	commitPendingRoundVotesToStatistics();
	clearPendingRoundState();
	bindEvents();
	setRound(state.roundIndex);
}

window.addEventListener("DOMContentLoaded", init);