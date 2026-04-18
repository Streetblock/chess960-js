import Chess960 from "./src/chess960.js";

const STORAGE_KEY = "chess960.ui-state";
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

const chess960 = new Chess960();

const squares = Array.from(document.querySelectorAll(".square"));
const currentIdDisplay = document.getElementById("currentId");
const reverseIdDisplay = document.getElementById("reverseId");
const errorMsg = document.getElementById("errorMsg");
const fullBoardContainer = document.getElementById("fullBoard");
const copyBtn = document.getElementById("copyBtn");
const diceBtn = document.getElementById("diceBtn");
const resetBtn = document.getElementById("resetBtn");

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
    updateUiFromInputs({ currentId: id });
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
    updateUiFromInputs();
}

function updateUiFromInputs({ currentId = null } = {}) {
    const backRank = getCurrentBackRank();
    const isValid = chess960.isValidBackRank(backRank);

    if (!isValid) {
        currentIdDisplay.textContent = currentId ?? "-";
        errorMsg.classList.remove("hidden");
        reverseIdDisplay.className = "error";
        reverseIdDisplay.textContent = "Ungueltige Aufstellung";
        fullBoardContainer.innerHTML = "";
        copyBtn.disabled = true;
        copyBtn.style.opacity = "0.5";
        persistUiState({
            currentId,
            backRank,
            isValid
        });
        return;
    }

    const calculatedId = chess960.getIdFromPosition(backRank);
    const boardState = chess960.createStartingBoard(backRank);

    currentIdDisplay.textContent = currentId ?? calculatedId;
    errorMsg.classList.add("hidden");
    reverseIdDisplay.className = "success";
    reverseIdDisplay.textContent = `Gueltige ID: ${calculatedId}`;
    copyBtn.disabled = false;
    copyBtn.style.opacity = "1";

    renderBoard(boardState.board);
    persistUiState({
        currentId: calculatedId,
        backRank: boardState.backRank,
        isValid
    });
}

function renderBoard(board) {
    fullBoardContainer.innerHTML = "";

    board.forEach((row, rowIndex) => {
        row.forEach((piece, colIndex) => {
            const square = document.createElement("div");
            const isLightSquare = (rowIndex + colIndex) % 2 === 0;
            square.className = `board-square ${isLightSquare ? "light-square" : "dark-square"}`;
            square.textContent = piece ? getSymbolForPiece(piece) : "";
            fullBoardContainer.appendChild(square);
        });
    });
}

function getSymbolForPiece(piece) {
    if (piece.color === "white") {
        return WHITE_SYMBOLS[piece.type];
    }

    return BLACK_SYMBOLS[piece.type];
}

function persistUiState(state) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function readPersistedUiState() {
    try {
        const rawValue = localStorage.getItem(STORAGE_KEY);

        if (!rawValue) {
            return null;
        }

        return JSON.parse(rawValue);
    } catch (error) {
        console.warn("Could not restore persisted Chess960 UI state.", error);
        return null;
    }
}

function restoreInitialState() {
    const persistedState = readPersistedUiState();

    if (persistedState?.isValid && Array.isArray(persistedState.backRank)) {
        applyBackRankToInputs(persistedState.backRank);
        updateUiFromInputs({ currentId: persistedState.currentId });
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
    localStorage.removeItem(STORAGE_KEY);
    loadPositionById(chess960.classicPositionId);
});

copyBtn.addEventListener("click", copyToClipboard);

initializeDropdowns();
restoreInitialState();
