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
const COLOR_LABELS = {
    white: "Wei\u00df",
    black: "Schwarz"
};
const STATUS_LABELS = {
    ready: "Bereit",
    active: "Partie l\u00e4uft",
    check: "Schach",
    checkmate: "Schachmatt",
    stalemate: "Patt"
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
const moveLog = document.getElementById("moveLog");

let gameState = null;

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
    currentIdDisplay.textContent = "-";
    errorMsg.classList.remove("hidden");
    reverseIdDisplay.className = "error";
    reverseIdDisplay.textContent = "Ungueltige Aufstellung";
    fullBoardContainer.innerHTML = "";
    copyBtn.disabled = true;
    copyBtn.style.opacity = "0.5";
    activeColorDisplay.textContent = "-";
    gameStatusDisplay.textContent = "Warte auf gueltige Startaufstellung";
    moveLog.innerHTML = '<li class="move-log-empty">Noch keine Partie gestartet.</li>';
    persistUiState({
        currentId: null,
        backRank,
        isValid: false
    });
    localStorage.removeItem(GAME_STORAGE_KEY);
    gameState = null;
}

function renderValidBackRank(backRank, currentId) {
    currentIdDisplay.textContent = currentId;
    errorMsg.classList.add("hidden");
    reverseIdDisplay.className = "success";
    reverseIdDisplay.textContent = `Gueltige ID: ${currentId}`;
    copyBtn.disabled = false;
    copyBtn.style.opacity = "1";
    applyBackRankToInputs(backRank);
}

function renderGame() {
    if (!gameState) {
        return;
    }

    renderBoard(gameState);
    renderGameStatus(gameState);
    renderMoveLog(gameState.moveHistory);
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

    if (state.status === "check") {
        gameStatusDisplay.textContent = `${COLOR_LABELS[state.activeColor]} steht im Schach`;
        return;
    }

    gameStatusDisplay.textContent = STATUS_LABELS[state.status] ?? STATUS_LABELS.active;
}

function renderMoveLog(moves) {
    moveLog.innerHTML = "";

    if (moves.length === 0) {
        moveLog.innerHTML = '<li class="move-log-empty">Noch keine Zuege ausgefuehrt.</li>';
        return;
    }

    moves.forEach((move) => {
        const item = document.createElement("li");
        item.className = "move-log-item";
        item.textContent = `${move.moveNumber}. ${COLOR_LABELS[move.color]} ${move.san ?? move.notation}`;
        moveLog.appendChild(item);
    });
}

function handleBoardClick(square) {
    if (!gameState) {
        return;
    }

    try {
        gameState = chess960.performInteraction(gameState, square);
        renderGame();
        persistGameState();
    } catch (error) {
        console.error("Board interaction failed", error);
    }
}

function restartCurrentGame() {
    const backRank = getCurrentBackRank();

    if (!chess960.isValidBackRank(backRank)) {
        renderInvalidBackRank(backRank);
        return;
    }

    initializeGameFromBackRank(backRank);
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
    localStorage.removeItem(UI_STORAGE_KEY);
    localStorage.removeItem(GAME_STORAGE_KEY);
    loadPositionById(chess960.classicPositionId);
});

restartGameBtn.addEventListener("click", restartCurrentGame);
copyBtn.addEventListener("click", copyToClipboard);

initializeDropdowns();
restoreInitialState();
