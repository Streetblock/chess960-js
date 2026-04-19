import Chess960 from "./src/chess960.js";

const UI_STORAGE_KEY = "chess960.ui-state";
const GAME_STORAGE_KEY = "chess960.game-state";
const PIECES = ["R", "N", "B", "Q", "K"];
const WHITE_SYMBOLS = {
    R: "\u2656",
    N: "\u2658",
    B: "\u2657",
    Q: "\u2655",
    K: "\u2654",
    P: "\u2659"
};
const BLACK_SYMBOLS = {
    R: "\u265C",
    N: "\u265E",
    B: "\u265D",
    Q: "\u265B",
    K: "\u265A",
    P: "\u265F"
};
const PROMOTION_LABELS = {
    Q: "Dame",
    R: "Turm",
    B: "Läufer",
    N: "Springer"
};
const COLOR_LABELS = {
    white: "Wei\u00df",
    black: "Schwarz"
};
const STATUS_LABELS = {
    ready: "Bereit",
    active: "Partie l\u00e4uft",
    check: "Schach",
    checkmate: "Schachmatt",
    stalemate: "Patt",
    draw: "Remis"
};

const chess960 = new Chess960();

const squares = Array.from(document.querySelectorAll(".square"));
const currentIdDisplay = document.getElementById("currentId");
const reverseIdDisplay = document.getElementById("reverseId");
const errorMsg = document.getElementById("errorMsg");
const fullBoardContainer = document.getElementById("fullBoard");
const copyBtn = document.getElementById("copyBtn");
const diceBtn = document.getElementById("diceBtn");
const resetBtn = document.getElementById("resetBtn");
const restartGameBtn = document.getElementById("restartGameBtn");
const activeColorDisplay = document.getElementById("activeColor");
const gameStatusDisplay = document.getElementById("gameStatus");
const historyStartBtn = document.getElementById("historyStartBtn");
const undoBtn = document.getElementById("undoBtn");
const redoBtn = document.getElementById("redoBtn");
const historyEndBtn = document.getElementById("historyEndBtn");
const historyPlayBtn = document.getElementById("historyPlayBtn");
const historyForkBtn = document.getElementById("historyForkBtn");
const historyStatus = document.getElementById("historyStatus");
const promotionPanel = document.getElementById("promotionPanel");
const promotionHint = document.getElementById("promotionHint");
const promotionButtons = Array.from(document.querySelectorAll(".promotion-btn"));
const cancelPromotionBtn = document.getElementById("cancelPromotionBtn");
const moveLog = document.getElementById("moveLog");
const drawPanel = document.getElementById("drawPanel");
const drawHint = document.getElementById("drawHint");
const claimThreefoldBtn = document.getElementById("claimThreefoldBtn");
const claimFiftyMoveBtn = document.getElementById("claimFiftyMoveBtn");
const fenInput = document.getElementById("fenInput");
const pgnInput = document.getElementById("pgnInput");
const refreshFenBtn = document.getElementById("refreshFenBtn");
const importFenBtn = document.getElementById("importFenBtn");
const refreshPgnBtn = document.getElementById("refreshPgnBtn");
const importPgnBtn = document.getElementById("importPgnBtn");
const notationStatus = document.getElementById("notationStatus");

let gameState = null;
let pendingPromotion = null;
let replayTimerId = null;

function isReplayRunning() {
    return replayTimerId !== null;
}

function stopReplay() {
    if (replayTimerId === null) {
        return;
    }

    window.clearInterval(replayTimerId);
    replayTimerId = null;
}

function initializeDropdowns() {
    squares.forEach((square) => {
        square.innerHTML = "";

        PIECES.forEach((piece) => {
            const option = document.createElement("option");
            option.value = piece;
            option.textContent = WHITE_SYMBOLS[piece];
            square.appendChild(option);
        });

        square.addEventListener("change", handleBackRankChange);
    });
}

function loadPositionById(id) {
    const backRank = chess960.generate(id);
    applyBackRankToInputs(backRank);
    initializeGameFromBackRank(backRank, id);
}

function applyBackRankToInputs(backRank) {
    backRank.forEach((piece, index) => {
        squares[index].value = piece;
    });
}

function getCurrentBackRank() {
    return squares.map((square) => square.value);
}

function handleBackRankChange() {
    const backRank = getCurrentBackRank();

    if (!chess960.isValidBackRank(backRank)) {
        renderInvalidBackRank(backRank);
        return;
    }

    initializeGameFromBackRank(backRank);
}

function initializeGameFromBackRank(backRank, currentId = null) {
    const positionId = currentId ?? chess960.getIdFromPosition(backRank);
    stopReplay();
    pendingPromotion = null;
    gameState = chess960.createGame(backRank);
    renderValidBackRank(backRank, positionId);
    renderGame();
    persistUiState({
        currentId: positionId,
        backRank: gameState.backRank,
        isValid: true
    });
    persistGameState();
}

function renderInvalidBackRank(backRank) {
    stopReplay();
    currentIdDisplay.textContent = "-";
    errorMsg.classList.remove("hidden");
    reverseIdDisplay.className = "error";
    reverseIdDisplay.textContent = "Ungültige Aufstellung";
    fullBoardContainer.innerHTML = "";
    copyBtn.disabled = true;
    copyBtn.style.opacity = "0.5";
    activeColorDisplay.textContent = "-";
    gameStatusDisplay.textContent = "Warte auf gueltige Startaufstellung";
    renderHistoryActions(null);
    renderHistoryStatus(null);
    renderPromotionPanel();
    moveLog.innerHTML = '<li class="move-log-empty">Noch keine Partie gestartet.</li>';
    persistUiState({
        currentId: null,
        backRank,
        isValid: false
    });
    localStorage.removeItem(GAME_STORAGE_KEY);
    gameState = null;
    drawPanel.classList.add("hidden");
    clearNotationFields();
}

function renderValidBackRank(backRank, currentId) {
    currentIdDisplay.textContent = currentId;
    errorMsg.classList.add("hidden");
    reverseIdDisplay.className = "success";
    reverseIdDisplay.textContent = `Gültige ID: ${currentId}`;
    copyBtn.disabled = false;
    copyBtn.style.opacity = "1";
    applyBackRankToInputs(backRank);
}

function renderGame() {
    if (!gameState) {
        clearNotationFields();
        return;
    }

    renderBoard(gameState);
    renderGameStatus(gameState);
    renderHistoryActions(gameState);
    renderHistoryStatus(gameState);
    renderPromotionPanel();
    renderDrawPanel(gameState);
    renderMoveLog(gameState.moveHistory);
    syncNotationFields(gameState);
}

function renderBoard(state) {
    fullBoardContainer.innerHTML = "";

    state.board.forEach((row, rowIndex) => {
        row.forEach((piece, colIndex) => {
            const squareName = toSquareName(rowIndex, colIndex);
            const square = document.createElement("button");
            const isLightSquare = (rowIndex + colIndex) % 2 === 0;

            square.type = "button";
            square.className = `board-square ${isLightSquare ? "light-square" : "dark-square"}`;
            square.dataset.square = squareName;
            square.setAttribute("aria-label", `${squareName}${piece ? ` ${piece.color} ${piece.type}` : ""}`);

            if (state.selectedSquare === squareName) {
                square.classList.add("selected-square");
            }

            if (state.legalTargets.includes(squareName)) {
                square.classList.add("legal-target");
            }

            if (piece) {
                square.textContent = getSymbolForPiece(piece);
                square.classList.add(piece.color === "white" ? "piece-white" : "piece-black");
            } else {
                square.textContent = "";
            }

            square.addEventListener("click", () => handleBoardClick(squareName));
            fullBoardContainer.appendChild(square);
        });
    });
}

function renderGameStatus(state) {
    activeColorDisplay.textContent = COLOR_LABELS[state.activeColor];

    if (state.status === "checkmate") {
        gameStatusDisplay.textContent = `Schachmatt - ${COLOR_LABELS[state.winner]} gewinnt`;
        return;
    }

    if (state.status === "stalemate") {
        gameStatusDisplay.textContent = "Patt";
        return;
    }

    if (state.status === "draw") {
        const drawReasonLabels = {
            insufficientMaterial: "Remis durch unzureichendes Material",
            fivefoldRepetition: "Remis durch fuenffache Stellungswiederholung",
            seventyFiveMoveRule: "Remis nach 75-Züge-Regel"
        };
        gameStatusDisplay.textContent = drawReasonLabels[state.drawReason] ?? "Remis";
        return;
    }

    if (state.status === "check") {
        gameStatusDisplay.textContent = `${COLOR_LABELS[state.activeColor]} steht im Schach`;
        return;
    }

    gameStatusDisplay.textContent = STATUS_LABELS[state.status] ?? STATUS_LABELS.active;
}

function renderDrawPanel(state) {
    const claimable = state.claimableDraws ?? [];

    if (claimable.length === 0) {
        drawPanel.classList.add("hidden");
        claimThreefoldBtn.disabled = true;
        claimFiftyMoveBtn.disabled = true;
        return;
    }

    const hintParts = [];

    if (claimable.includes("threefoldRepetition")) {
        hintParts.push("dreifache Stellungswiederholung");
    }

    if (claimable.includes("fiftyMoveRule")) {
        hintParts.push("50-Züge-Regel");
    }

    drawPanel.classList.remove("hidden");
    drawHint.textContent = `Remis kann beansprucht werden: ${hintParts.join(" und ")}.`;
    claimThreefoldBtn.disabled = !claimable.includes("threefoldRepetition");
    claimFiftyMoveBtn.disabled = !claimable.includes("fiftyMoveRule");
}

function renderHistoryActions(state) {
    if (!state) {
        historyStartBtn.disabled = true;
        undoBtn.disabled = true;
        redoBtn.disabled = true;
        historyEndBtn.disabled = true;
        historyPlayBtn.disabled = true;
        historyForkBtn.disabled = true;
        historyPlayBtn.textContent = "Play";
        return;
    }

    const canUndo = Boolean(state?.canUndo);
    const canRedo = Boolean(state?.canRedo);
    const hasHistory = Boolean(state && chess960.getHistoryLength(state) > 1);

    historyStartBtn.disabled = !hasHistory || state.historyIndex === 0;
    undoBtn.disabled = !canUndo;
    redoBtn.disabled = !canRedo;
    historyEndBtn.disabled = !hasHistory || state.historyIndex === chess960.getHistoryLength(state) - 1;
    historyPlayBtn.disabled = !hasHistory;
    historyForkBtn.disabled = !hasHistory || state.historyIndex === chess960.getHistoryLength(state) - 1;
    historyPlayBtn.textContent = isReplayRunning() ? "Pause" : "Play";
}

function renderHistoryStatus(state) {
    if (!state) {
        historyStatus.textContent = "Keine Historie geladen.";
        return;
    }

    const currentPly = state.historyIndex;
    const totalPlies = Math.max(0, chess960.getHistoryLength(state) - 1);

    if (currentPly === totalPlies) {
        historyStatus.textContent = totalPlies === 0
            ? "Live-Ansicht. Noch keine Züge gespielt."
            : `Live-Ansicht auf Halbzug ${currentPly}/${totalPlies}.`;
        return;
    }

    historyStatus.textContent = `Replay-Modus auf Halbzug ${currentPly}/${totalPlies}. Brett ist schreibgeschützt.`;
}

function renderPromotionPanel() {
    if (!pendingPromotion) {
        promotionPanel.classList.add("hidden");
        return;
    }

    const colorLabel = COLOR_LABELS[pendingPromotion.color];
    promotionHint.textContent = `${colorLabel} wandelt auf ${pendingPromotion.to} um. Bitte Figur wählen.`;
    promotionPanel.classList.remove("hidden");
}

function renderMoveLog(moves) {
    moveLog.innerHTML = "";

    if (moves.length === 0) {
        moveLog.innerHTML = '<p class="move-log-empty">Noch keine Züge ausgeführt.</p>';
        return;
    }

    const rows = [];

    moves.forEach((move) => {
        const rowIndex = move.moveNumber - 1;

        if (!rows[rowIndex]) {
            rows[rowIndex] = {
                moveNumber: move.moveNumber,
                white: null,
                black: null
            };
        }

        rows[rowIndex][move.color] = move;
    });

    rows.forEach((row) => {
        const rowElement = document.createElement("div");
        rowElement.className = "move-log-row";

        const numberElement = document.createElement("div");
        numberElement.className = "move-log-number";
        numberElement.textContent = `${row.moveNumber}.`;
        rowElement.appendChild(numberElement);

        rowElement.appendChild(createMoveLogCell(row.white, "Weiß"));
        rowElement.appendChild(createMoveLogCell(row.black, "Schwarz"));

        moveLog.appendChild(rowElement);
    });
}

function createMoveLogCell(move, fallbackLabel) {
    const cell = document.createElement("div");
    cell.className = "move-log-cell";

    const button = document.createElement("button");
    button.type = "button";
    button.className = "move-log-item";

    if (!move) {
        button.classList.add("empty");
        button.disabled = true;
        button.textContent = `${fallbackLabel} -`;
        cell.appendChild(button);
        return cell;
    }

    if (gameState?.historyIndex === move.ply) {
        button.classList.add("active");
    }

    button.textContent = `${fallbackLabel} ${move.san ?? move.notation}`;
    button.addEventListener("click", () => jumpToHistory(move.ply));
    cell.appendChild(button);
    return cell;
}

function handleBoardClick(square) {
    if (!gameState) {
        return;
    }

    stopReplay();

    if (gameState.historyIndex !== chess960.getHistoryLength(gameState) - 1) {
        setNotationStatus("Replay-Modus aktiv. Bitte zuerst zur aktuellen Stellung zurückkehren.", true);
        return;
    }

    if (pendingPromotion) {
        pendingPromotion = null;
    }

    try {
        const selectedSquare = gameState.selectedSquare;

        if (selectedSquare && gameState.legalTargets.includes(square) && chess960.isPromotionMove(gameState, selectedSquare, square)) {
            const piece = chess960.getPieceAt(gameState, selectedSquare);
            pendingPromotion = {
                from: selectedSquare,
                to: square,
                color: piece?.color ?? gameState.activeColor
            };
            renderGame();
            return;
        }

        gameState = chess960.performInteraction(gameState, square);
        renderGame();
        persistGameState();
    } catch (error) {
        console.error("Board interaction failed", error);
    }
}

function confirmPromotion(pieceType) {
    if (!gameState || !pendingPromotion) {
        return;
    }

    try {
        gameState = chess960.movePiece(gameState, pendingPromotion.from, pendingPromotion.to, pieceType);
        pendingPromotion = null;
        renderGame();
        persistGameState();
        setNotationStatus(`Bauer erfolgreich zu ${PROMOTION_LABELS[pieceType]} umgewandelt.`);
    } catch (error) {
        console.error("Promotion failed", error);
        setNotationStatus(`Umwandlung fehlgeschlagen: ${error.message}`, true);
    }
}

function cancelPromotion() {
    if (!pendingPromotion) {
        return;
    }

    stopReplay();
    pendingPromotion = null;
    renderGame();
    setNotationStatus("Bauernumwandlung abgebrochen.");
}

function restartCurrentGame() {
    const backRank = getCurrentBackRank();

    if (!chess960.isValidBackRank(backRank)) {
        renderInvalidBackRank(backRank);
        return;
    }

    initializeGameFromBackRank(backRank);
}

function syncNotationFields(state) {
    fenInput.value = chess960.exportFEN(state);
    pgnInput.value = chess960.exportPGN(state);
    setNotationStatus("Notation aktualisiert.");
}

function clearNotationFields() {
    fenInput.value = "";
    pgnInput.value = "";
    setNotationStatus("Warte auf gueltige Partie.", true);
}

function setNotationStatus(message, isError = false) {
    notationStatus.textContent = message;
    notationStatus.className = isError ? "notation-status error" : "notation-status";
}

function applyImportedGameState(importedState) {
    stopReplay();
    pendingPromotion = null;
    gameState = chess960.hydrateGameState(importedState);
    applyBackRankToInputs(gameState.backRank);
    renderValidBackRank(gameState.backRank, gameState.positionId);
    renderGame();
    persistUiState({
        currentId: gameState.positionId,
        backRank: gameState.backRank,
        isValid: true
    });
    persistGameState();
}

function importFen() {
    const fen = fenInput.value.trim();

    if (!fen) {
        setNotationStatus("Bitte zuerst eine FEN eingeben.", true);
        return;
    }

    try {
        const importedState = chess960.importFEN(fen, {
            backRank: gameState?.backRank ?? getCurrentBackRank()
        });
        applyImportedGameState(importedState);
        setNotationStatus("FEN erfolgreich importiert.");
    } catch (error) {
        console.error("FEN import failed", error);
        setNotationStatus(`FEN-Import fehlgeschlagen: ${error.message}`, true);
    }
}

function importPgn() {
    const pgn = pgnInput.value.trim();

    if (!pgn) {
        setNotationStatus("Bitte zuerst eine PGN eingeben.", true);
        return;
    }

    try {
        const imported = chess960.importPGN(pgn, {
            backRank: gameState?.backRank
        });
        applyImportedGameState(imported.gameState);
        if (imported.warnings?.length) {
            setNotationStatus(`PGN importiert mit Hinweis: ${imported.warnings.join(" ")}`);
        } else {
            setNotationStatus("PGN erfolgreich importiert.");
        }
    } catch (error) {
        console.error("PGN import failed", error);
        setNotationStatus(`PGN-Import fehlgeschlagen: ${error.message}`, true);
    }
}

function claimDraw(reason) {
    if (!gameState) {
        return;
    }

    try {
        stopReplay();
        gameState = chess960.claimDraw(gameState, reason);
        renderGame();
        persistGameState();
        setNotationStatus("Remis erfolgreich eingetragen.");
    } catch (error) {
        console.error("Draw claim failed", error);
        setNotationStatus(`Remis konnte nicht beansprucht werden: ${error.message}`, true);
    }
}

function jumpToHistory(historyIndex) {
    if (!gameState) {
        return;
    }

    try {
        stopReplay();
        pendingPromotion = null;
        gameState = chess960.goToHistoryIndex(gameState, historyIndex);
        renderGame();
        persistGameState();
        setNotationStatus(`Zu Halbzug ${historyIndex} gesprungen.`);
    } catch (error) {
        console.error("History jump failed", error);
        setNotationStatus(`Historien-Sprung fehlgeschlagen: ${error.message}`, true);
    }
}

function undoMove() {
    if (!gameState) {
        return;
    }

    try {
        stopReplay();
        pendingPromotion = null;
        gameState = chess960.undo(gameState);
        renderGame();
        persistGameState();
        setNotationStatus("Vorherigen Zustand wiederhergestellt.");
    } catch (error) {
        console.error("Undo failed", error);
        setNotationStatus(`Undo fehlgeschlagen: ${error.message}`, true);
    }
}

function redoMove() {
    if (!gameState) {
        return;
    }

    try {
        stopReplay();
        pendingPromotion = null;
        gameState = chess960.redo(gameState);
        renderGame();
        persistGameState();
        setNotationStatus("Naechsten Zustand wiederhergestellt.");
    } catch (error) {
        console.error("Redo failed", error);
        setNotationStatus(`Redo fehlgeschlagen: ${error.message}`, true);
    }
}

function jumpToStart() {
    jumpToHistory(0);
}

function jumpToLatest() {
    if (!gameState) {
        return;
    }

    jumpToHistory(chess960.getHistoryLength(gameState) - 1);
}

function forkVariationFromCurrentPosition() {
    if (!gameState) {
        return;
    }

    const latestIndex = chess960.getHistoryLength(gameState) - 1;

    if (gameState.historyIndex >= latestIndex) {
        setNotationStatus("Du bist bereits auf der aktuellen Hauptlinie.", true);
        return;
    }

    try {
        stopReplay();
        pendingPromotion = null;
        gameState = chess960.forkFromHistoryIndex(gameState, gameState.historyIndex);
        renderGame();
        persistGameState();
        setNotationStatus(`Neue Variante ab Halbzug ${gameState.historyIndex} gestartet.`);
    } catch (error) {
        console.error("Variation fork failed", error);
        setNotationStatus(`Variante konnte nicht erstellt werden: ${error.message}`, true);
    }
}

function stepReplayForward() {
    if (!gameState) {
        stopReplay();
        renderGame();
        return;
    }

    const latestIndex = chess960.getHistoryLength(gameState) - 1;

    if (gameState.historyIndex >= latestIndex) {
        stopReplay();
        renderGame();
        setNotationStatus("Replay am aktuellen Stand beendet.");
        return;
    }

    gameState = chess960.goToHistoryIndex(gameState, gameState.historyIndex + 1);
    renderGame();
    persistGameState();
}

function toggleReplay() {
    if (!gameState) {
        return;
    }

    if (isReplayRunning()) {
        stopReplay();
        renderGame();
        setNotationStatus("Replay pausiert.");
        return;
    }

    const latestIndex = chess960.getHistoryLength(gameState) - 1;

    if (latestIndex === 0) {
        setNotationStatus("Noch keine Züge für Replay vorhanden.", true);
        return;
    }

    if (gameState.historyIndex >= latestIndex) {
        gameState = chess960.goToHistoryIndex(gameState, 0);
    }

    replayTimerId = window.setInterval(stepReplayForward, 700);
    renderGame();
    persistGameState();
    setNotationStatus("Replay gestartet.");
}

function shouldIgnoreHistoryShortcut(target) {
    if (!(target instanceof HTMLElement)) {
        return false;
    }

    return Boolean(target.closest("textarea, input, select"));
}

function handleGlobalKeydown(event) {
    if (!gameState || event.altKey || event.ctrlKey || event.metaKey) {
        return;
    }

    if (shouldIgnoreHistoryShortcut(event.target)) {
        return;
    }

    if (event.key === "ArrowLeft") {
        event.preventDefault();
        undoMove();
        return;
    }

    if (event.key === "ArrowRight") {
        event.preventDefault();
        redoMove();
        return;
    }

    if (event.key === "Home") {
        event.preventDefault();
        jumpToStart();
        return;
    }

    if (event.key === "End") {
        event.preventDefault();
        jumpToLatest();
    }
}

function getSymbolForPiece(piece) {
    return piece.color === "white" ? WHITE_SYMBOLS[piece.type] : BLACK_SYMBOLS[piece.type];
}

function toSquareName(rowIndex, colIndex) {
    return `${String.fromCharCode(97 + colIndex)}${8 - rowIndex}`;
}

function persistUiState(state) {
    localStorage.setItem(UI_STORAGE_KEY, JSON.stringify(state));
}

function persistGameState() {
    if (!gameState) {
        localStorage.removeItem(GAME_STORAGE_KEY);
        return;
    }

    localStorage.setItem(GAME_STORAGE_KEY, JSON.stringify(chess960.serializeGameState(gameState)));
}

function readJsonStorage(key) {
    try {
        const rawValue = localStorage.getItem(key);
        return rawValue ? JSON.parse(rawValue) : null;
    } catch (error) {
        console.warn(`Could not restore persisted state for ${key}.`, error);
        return null;
    }
}

function restoreInitialState() {
    const persistedUiState = readJsonStorage(UI_STORAGE_KEY);
    const persistedGameState = readJsonStorage(GAME_STORAGE_KEY);

    if (persistedGameState?.backRank && chess960.isValidBackRank(persistedGameState.backRank)) {
        try {
            gameState = chess960.hydrateGameState(persistedGameState);
            applyBackRankToInputs(gameState.backRank);
            renderValidBackRank(gameState.backRank, gameState.positionId);
            renderGame();
            persistUiState({
                currentId: gameState.positionId,
                backRank: gameState.backRank,
                isValid: true
            });
            return;
        } catch (error) {
            console.warn("Could not restore persisted game state.", error);
        }
    }

    if (persistedUiState?.isValid && Array.isArray(persistedUiState.backRank) && chess960.isValidBackRank(persistedUiState.backRank)) {
        applyBackRankToInputs(persistedUiState.backRank);
        initializeGameFromBackRank(persistedUiState.backRank, persistedUiState.currentId);
        return;
    }

    loadPositionById(chess960.classicPositionId);
}

function copyToClipboard() {
    const backRank = getCurrentBackRank();

    if (!chess960.isValidBackRank(backRank)) {
        return;
    }

    const id = chess960.getIdFromPosition(backRank);
    const positionString = backRank.join(" ");
    const textToCopy = `Chess960 Setup\nID: ${id}\nAufstellung: ${positionString}`;
    const textArea = document.createElement("textarea");

    textArea.value = textToCopy;
    document.body.appendChild(textArea);
    textArea.select();

    try {
        document.execCommand("copy");

        const originalText = copyBtn.innerHTML;
        copyBtn.innerHTML = `
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="20 6 9 17 4 12"></polyline>
            </svg> Kopiert!`;
        copyBtn.classList.add("copied");

        setTimeout(() => {
            copyBtn.innerHTML = originalText;
            copyBtn.classList.remove("copied");
        }, 2000);
    } catch (error) {
        console.error("Copy failed", error);
    } finally {
        document.body.removeChild(textArea);
    }
}

diceBtn.addEventListener("click", () => {
    loadPositionById(Math.floor(Math.random() * chess960.positionCount));
});

resetBtn.addEventListener("click", () => {
    stopReplay();
    pendingPromotion = null;
    localStorage.removeItem(UI_STORAGE_KEY);
    localStorage.removeItem(GAME_STORAGE_KEY);
    loadPositionById(chess960.classicPositionId);
});

restartGameBtn.addEventListener("click", restartCurrentGame);
copyBtn.addEventListener("click", copyToClipboard);
historyStartBtn.addEventListener("click", jumpToStart);
undoBtn.addEventListener("click", undoMove);
redoBtn.addEventListener("click", redoMove);
historyEndBtn.addEventListener("click", jumpToLatest);
historyPlayBtn.addEventListener("click", toggleReplay);
historyForkBtn.addEventListener("click", forkVariationFromCurrentPosition);
promotionButtons.forEach((button) => {
    button.addEventListener("click", () => confirmPromotion(button.dataset.promotionPiece));
});
cancelPromotionBtn.addEventListener("click", cancelPromotion);
refreshFenBtn.addEventListener("click", () => {
    if (!gameState) {
        setNotationStatus("Es gibt aktuell keine Partie zum Exportieren.", true);
        return;
    }

    fenInput.value = chess960.exportFEN(gameState);
    setNotationStatus("FEN aktualisiert.");
});
importFenBtn.addEventListener("click", importFen);
refreshPgnBtn.addEventListener("click", () => {
    if (!gameState) {
        setNotationStatus("Es gibt aktuell keine Partie zum Exportieren.", true);
        return;
    }

    pgnInput.value = chess960.exportPGN(gameState);
    setNotationStatus("PGN aktualisiert.");
});
importPgnBtn.addEventListener("click", importPgn);
claimThreefoldBtn.addEventListener("click", () => claimDraw("threefoldRepetition"));
claimFiftyMoveBtn.addEventListener("click", () => claimDraw("fiftyMoveRule"));
document.addEventListener("keydown", handleGlobalKeydown);

initializeDropdowns();
restoreInitialState();

