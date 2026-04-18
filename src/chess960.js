const BOARD_SIZE = 8;
const CHESS960_POSITION_COUNT = 960;
const CLASSIC_POSITION_ID = 518;
const PIECE_COUNTS = Object.freeze({
    K: 1,
    Q: 1,
    R: 2,
    B: 2,
    N: 2
});
const FILES = Object.freeze(["a", "b", "c", "d", "e", "f", "g", "h"]);
const KNIGHT_MAPPING = Object.freeze([
    [0, 1], [0, 2], [0, 3], [0, 4], [1, 2],
    [1, 3], [1, 4], [2, 3], [2, 4], [3, 4]
]);
const PIECE_DIRECTIONS = Object.freeze({
    bishop: [
        { row: -1, col: -1 },
        { row: -1, col: 1 },
        { row: 1, col: -1 },
        { row: 1, col: 1 }
    ],
    rook: [
        { row: -1, col: 0 },
        { row: 1, col: 0 },
        { row: 0, col: -1 },
        { row: 0, col: 1 }
    ],
    knight: [
        { row: -2, col: -1 },
        { row: -2, col: 1 },
        { row: -1, col: -2 },
        { row: -1, col: 2 },
        { row: 1, col: -2 },
        { row: 1, col: 2 },
        { row: 2, col: -1 },
        { row: 2, col: 1 }
    ],
    king: [
        { row: -1, col: -1 },
        { row: -1, col: 0 },
        { row: -1, col: 1 },
        { row: 0, col: -1 },
        { row: 0, col: 1 },
        { row: 1, col: -1 },
        { row: 1, col: 0 },
        { row: 1, col: 1 }
    ]
});
const COLOR_NAMES = Object.freeze({
    white: "White",
    black: "Black"
});

function cloneBackRank(backRank) {
    return [...backRank];
}

function createEmptyBoard() {
    return Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(null));
}

function isInsideBoard(row, col) {
    return row >= 0 && row < BOARD_SIZE && col >= 0 && col < BOARD_SIZE;
}

function squareFromIndex(row, col) {
    return `${FILES[col]}${BOARD_SIZE - row}`;
}

function parseSquare(square) {
    if (typeof square !== "string" || square.length < 2) {
        throw new Error("Square must be a string such as e4.");
    }

    const normalized = square.trim().toLowerCase();
    const file = normalized[0];
    const rank = Number(normalized.slice(1));
    const col = FILES.indexOf(file);
    const row = BOARD_SIZE - rank;

    if (col === -1 || !Number.isInteger(rank) || !isInsideBoard(row, col)) {
        throw new Error(`Invalid square: ${square}`);
    }

    return { row, col, square: normalized };
}

function createPiece(type, color, row, col) {
    return {
        id: `${color}-${type}-${col}-${row}`,
        type,
        color,
        row,
        col,
        square: squareFromIndex(row, col),
        hasMoved: false
    };
}

function clonePiece(piece) {
    if (!piece) {
        return null;
    }

    return { ...piece };
}

function cloneBoard(board) {
    return board.map((row) => row.map((piece) => clonePiece(piece)));
}

function otherColor(color) {
    return color === "white" ? "black" : "white";
}

function getPieceLabel(pieceType) {
    switch (pieceType) {
        case "K":
            return "King";
        case "Q":
            return "Queen";
        case "R":
            return "Rook";
        case "B":
            return "Bishop";
        case "N":
            return "Knight";
        case "P":
            return "Pawn";
        default:
            return pieceType;
    }
}

export default class Chess960 {
    constructor() {
        this.knightMapping = KNIGHT_MAPPING;
        this.classicPositionId = CLASSIC_POSITION_ID;
        this.positionCount = CHESS960_POSITION_COUNT;
    }

    generate(id) {
        if (!Number.isInteger(id) || id < 0 || id >= this.positionCount) {
            throw new Error(`ID must be an integer between 0 and ${this.positionCount - 1}.`);
        }

        const row = new Array(BOARD_SIZE).fill(null);
        let n = id;

        const lightBishopPos = (n % 4) * 2 + 1;
        row[lightBishopPos] = "B";
        n = Math.floor(n / 4);

        const darkBishopPos = (n % 4) * 2;
        row[darkBishopPos] = "B";
        n = Math.floor(n / 4);

        const queenPosIndex = n % 6;
        this.#placeAtEmptySlot(row, queenPosIndex, "Q");
        n = Math.floor(n / 6);

        const knightCombo = this.knightMapping[n];
        this.#placeAtEmptySlot(row, knightCombo[0], "N");
        this.#placeAtEmptySlot(row, knightCombo[1] - 1, "N");

        this.#placeAtEmptySlot(row, 0, "R");
        this.#placeAtEmptySlot(row, 0, "K");
        this.#placeAtEmptySlot(row, 0, "R");

        return row;
    }

    generateAll() {
        return Array.from({ length: this.positionCount }, (_, id) => ({
            id,
            backRank: this.generate(id)
        }));
    }

    getIdFromPosition(backRank) {
        const normalizedBackRank = this.#normalizeBackRank(backRank);

        if (!this.isValidBackRank(normalizedBackRank)) {
            throw new Error("Back rank is not a legal Chess960 position.");
        }

        const lightBishopIndex = normalizedBackRank.findIndex((piece, index) => piece === "B" && index % 2 === 1);
        const darkBishopIndex = normalizedBackRank.findIndex((piece, index) => piece === "B" && index % 2 === 0);
        const lightBishopFactor = (lightBishopIndex - 1) / 2;
        const darkBishopFactor = darkBishopIndex / 2;
        const rowWithoutBishops = normalizedBackRank.filter((_, index) => index !== lightBishopIndex && index !== darkBishopIndex);
        const queenFactor = rowWithoutBishops.indexOf("Q");
        const rowWithoutQueen = rowWithoutBishops.filter((piece) => piece !== "Q");
        const knightIndices = [];

        rowWithoutQueen.forEach((piece, index) => {
            if (piece === "N") {
                knightIndices.push(index);
            }
        });

        const knightFactor = this.knightMapping.findIndex((pair) => pair[0] === knightIndices[0] && pair[1] === knightIndices[1]);
        return (knightFactor * 96) + (queenFactor * 16) + (darkBishopFactor * 4) + lightBishopFactor;
    }

    isValidBackRank(backRank) {
        const normalizedBackRank = this.#normalizeBackRank(backRank, false);

        if (!normalizedBackRank || normalizedBackRank.length !== BOARD_SIZE) {
            return false;
        }

        const counts = { K: 0, Q: 0, R: 0, B: 0, N: 0 };

        for (const piece of normalizedBackRank) {
            if (!Object.hasOwn(PIECE_COUNTS, piece)) {
                return false;
            }

            counts[piece] += 1;
        }

        for (const [piece, requiredCount] of Object.entries(PIECE_COUNTS)) {
            if (counts[piece] !== requiredCount) {
                return false;
            }
        }

        const kingIndex = normalizedBackRank.indexOf("K");
        const firstRookIndex = normalizedBackRank.indexOf("R");
        const lastRookIndex = normalizedBackRank.lastIndexOf("R");

        if (kingIndex < firstRookIndex || kingIndex > lastRookIndex) {
            return false;
        }

        const bishopIndices = normalizedBackRank
            .map((piece, index) => piece === "B" ? index : -1)
            .filter((index) => index !== -1);

        return bishopIndices[0] % 2 !== bishopIndices[1] % 2;
    }

    createGame(positionInput = this.classicPositionId) {
        const backRank = this.#resolveBackRank(positionInput);
        const board = createEmptyBoard();

        backRank.forEach((pieceType, col) => {
            board[0][col] = createPiece(pieceType, "black", 0, col);
            board[1][col] = createPiece("P", "black", 1, col);
            board[6][col] = createPiece("P", "white", 6, col);
            board[7][col] = createPiece(pieceType, "white", 7, col);
        });

        const gameState = {
            positionId: this.getIdFromPosition(backRank),
            backRank: cloneBackRank(backRank),
            board,
            activeColor: "white",
            selectedSquare: null,
            legalTargets: [],
            moveHistory: [],
            status: "ready",
            winner: null,
            isCheck: false
        };

        return this.#syncDerivedState(gameState);
    }

    hydrateGameState(rawState) {
        if (!rawState || !Array.isArray(rawState.board) || !Array.isArray(rawState.backRank)) {
            throw new Error("Cannot hydrate invalid game state.");
        }

        const gameState = {
            positionId: typeof rawState.positionId === "number" ? rawState.positionId : this.getIdFromPosition(rawState.backRank),
            backRank: this.#resolveBackRank(rawState.backRank),
            board: cloneBoard(rawState.board),
            activeColor: rawState.activeColor === "black" ? "black" : "white",
            selectedSquare: rawState.selectedSquare ?? null,
            legalTargets: Array.isArray(rawState.legalTargets) ? [...rawState.legalTargets] : [],
            moveHistory: Array.isArray(rawState.moveHistory) ? rawState.moveHistory.map((move) => ({ ...move })) : [],
            status: typeof rawState.status === "string" ? rawState.status : "ready",
            winner: rawState.winner ?? null,
            isCheck: Boolean(rawState.isCheck)
        };

        return this.#syncDerivedState(gameState);
    }

    serializeGameState(gameState) {
        return JSON.parse(JSON.stringify(gameState));
    }

    getPieceAt(gameState, square) {
        const { row, col } = parseSquare(square);
        return gameState.board[row][col];
    }

    getLegalMoves(gameState, fromSquare) {
        const piece = this.getPieceAt(gameState, fromSquare);

        if (!piece || piece.color !== gameState.activeColor) {
            return [];
        }

        return this.#getLegalMovesForPiece(gameState, piece);
    }

    selectSquare(gameState, square) {
        const nextState = this.hydrateGameState(gameState);
        const piece = this.getPieceAt(nextState, square);

        if (piece && piece.color === nextState.activeColor) {
            nextState.selectedSquare = square;
            nextState.legalTargets = this.getLegalMoves(nextState, square);
            return this.#syncDerivedState(nextState);
        }

        nextState.selectedSquare = null;
        nextState.legalTargets = [];
        return this.#syncDerivedState(nextState);
    }

    performInteraction(gameState, square) {
        const nextState = this.hydrateGameState(gameState);

        if (nextState.status === "checkmate" || nextState.status === "stalemate") {
            return nextState;
        }

        if (nextState.selectedSquare && nextState.legalTargets.includes(square)) {
            return this.movePiece(nextState, nextState.selectedSquare, square);
        }

        return this.selectSquare(nextState, square);
    }

    movePiece(gameState, fromSquare, toSquare, promotion = "Q") {
        const nextState = this.hydrateGameState(gameState);
        const legalMoves = this.getLegalMoves(nextState, fromSquare);

        if (!legalMoves.includes(toSquare)) {
            throw new Error(`Illegal move from ${fromSquare} to ${toSquare}.`);
        }

        const move = this.#applyMove(nextState.board, fromSquare, toSquare, promotion);

        nextState.activeColor = otherColor(nextState.activeColor);
        nextState.selectedSquare = null;
        nextState.legalTargets = [];
        nextState.moveHistory = [...nextState.moveHistory, this.#buildMoveRecord(nextState, move)];

        return this.#syncDerivedState(nextState);
    }

    resetGame(positionInput = this.classicPositionId) {
        return this.createGame(positionInput);
    }

    #syncDerivedState(gameState) {
        const nextState = {
            ...gameState,
            backRank: cloneBackRank(gameState.backRank),
            board: cloneBoard(gameState.board),
            moveHistory: gameState.moveHistory.map((move) => ({ ...move })),
            legalTargets: [...gameState.legalTargets]
        };

        if (nextState.selectedSquare) {
            const selectedPiece = this.getPieceAt(nextState, nextState.selectedSquare);
            if (!selectedPiece || selectedPiece.color !== nextState.activeColor) {
                nextState.selectedSquare = null;
                nextState.legalTargets = [];
            } else {
                nextState.legalTargets = this.#getLegalMovesForPiece(nextState, selectedPiece);
            }
        } else {
            nextState.legalTargets = [];
        }

        const sideToMove = nextState.activeColor;
        const kingInCheck = this.isKingInCheck(nextState, sideToMove);
        const hasMove = this.#hasAnyLegalMove(nextState, sideToMove);

        nextState.isCheck = kingInCheck;

        if (!hasMove && kingInCheck) {
            nextState.status = "checkmate";
            nextState.winner = otherColor(sideToMove);
        } else if (!hasMove) {
            nextState.status = "stalemate";
            nextState.winner = null;
        } else if (kingInCheck) {
            nextState.status = "check";
            nextState.winner = null;
        } else {
            nextState.status = nextState.moveHistory.length === 0 ? "ready" : "active";
            nextState.winner = null;
        }

        return nextState;
    }

    #hasAnyLegalMove(gameState, color) {
        for (let row = 0; row < BOARD_SIZE; row += 1) {
            for (let col = 0; col < BOARD_SIZE; col += 1) {
                const piece = gameState.board[row][col];

                if (!piece || piece.color !== color) {
                    continue;
                }

                if (this.#getLegalMovesForPiece({ ...gameState, activeColor: color }, piece).length > 0) {
                    return true;
                }
            }
        }

        return false;
    }

    isKingInCheck(gameState, color) {
        const kingSquare = this.#findKingSquare(gameState.board, color);

        if (!kingSquare) {
            return false;
        }

        return this.#isSquareAttacked(gameState.board, kingSquare.row, kingSquare.col, otherColor(color));
    }

    #findKingSquare(board, color) {
        for (let row = 0; row < BOARD_SIZE; row += 1) {
            for (let col = 0; col < BOARD_SIZE; col += 1) {
                const piece = board[row][col];

                if (piece?.type === "K" && piece.color === color) {
                    return { row, col, square: squareFromIndex(row, col) };
                }
            }
        }

        return null;
    }

    #isSquareAttacked(board, targetRow, targetCol, byColor) {
        const pawnDirection = byColor === "white" ? -1 : 1;
        const pawnAttackRow = targetRow - pawnDirection;

        for (const offset of [-1, 1]) {
            const attackCol = targetCol + offset;

            if (!isInsideBoard(pawnAttackRow, attackCol)) {
                continue;
            }

            const attacker = board[pawnAttackRow][attackCol];
            if (attacker?.color === byColor && attacker.type === "P") {
                return true;
            }
        }

        for (const offset of PIECE_DIRECTIONS.knight) {
            const row = targetRow + offset.row;
            const col = targetCol + offset.col;

            if (!isInsideBoard(row, col)) {
                continue;
            }

            const attacker = board[row][col];
            if (attacker?.color === byColor && attacker.type === "N") {
                return true;
            }
        }

        for (const offset of PIECE_DIRECTIONS.king) {
            const row = targetRow + offset.row;
            const col = targetCol + offset.col;

            if (!isInsideBoard(row, col)) {
                continue;
            }

            const attacker = board[row][col];
            if (attacker?.color === byColor && attacker.type === "K") {
                return true;
            }
        }

        for (const direction of PIECE_DIRECTIONS.bishop) {
            if (this.#scanAttackLine(board, targetRow, targetCol, byColor, direction, ["B", "Q"])) {
                return true;
            }
        }

        for (const direction of PIECE_DIRECTIONS.rook) {
            if (this.#scanAttackLine(board, targetRow, targetCol, byColor, direction, ["R", "Q"])) {
                return true;
            }
        }

        return false;
    }

    #scanAttackLine(board, startRow, startCol, byColor, direction, validTypes) {
        let row = startRow + direction.row;
        let col = startCol + direction.col;

        while (isInsideBoard(row, col)) {
            const piece = board[row][col];

            if (!piece) {
                row += direction.row;
                col += direction.col;
                continue;
            }

            return piece.color === byColor && validTypes.includes(piece.type);
        }

        return false;
    }

    #getLegalMovesForPiece(gameState, piece) {
        const pseudoMoves = this.#getPseudoLegalMoves(gameState.board, piece);
        const legalMoves = [];

        pseudoMoves.forEach((targetSquare) => {
            const boardClone = cloneBoard(gameState.board);
            this.#applyMove(boardClone, piece.square, targetSquare, "Q");

            if (!this.#isSquareAttackedAfterMove(boardClone, piece.color)) {
                legalMoves.push(targetSquare);
            }
        });

        return legalMoves;
    }

    #isSquareAttackedAfterMove(board, color) {
        const kingSquare = this.#findKingSquare(board, color);

        if (!kingSquare) {
            return true;
        }

        return this.#isSquareAttacked(board, kingSquare.row, kingSquare.col, otherColor(color));
    }

    #getPseudoLegalMoves(board, piece) {
        switch (piece.type) {
            case "P":
                return this.#getPawnMoves(board, piece);
            case "N":
                return this.#getKnightMoves(board, piece);
            case "B":
                return this.#getSlidingMoves(board, piece, PIECE_DIRECTIONS.bishop);
            case "R":
                return this.#getSlidingMoves(board, piece, PIECE_DIRECTIONS.rook);
            case "Q":
                return this.#getSlidingMoves(board, piece, [...PIECE_DIRECTIONS.bishop, ...PIECE_DIRECTIONS.rook]);
            case "K":
                return this.#getKingMoves(board, piece);
            default:
                return [];
        }
    }

    #getPawnMoves(board, piece) {
        const moves = [];
        const direction = piece.color === "white" ? -1 : 1;
        const oneStepRow = piece.row + direction;

        if (isInsideBoard(oneStepRow, piece.col) && !board[oneStepRow][piece.col]) {
            moves.push(squareFromIndex(oneStepRow, piece.col));

            const startRow = piece.color === "white" ? 6 : 1;
            const twoStepRow = piece.row + (direction * 2);

            if (piece.row === startRow && !board[twoStepRow][piece.col]) {
                moves.push(squareFromIndex(twoStepRow, piece.col));
            }
        }

        for (const offset of [-1, 1]) {
            const targetCol = piece.col + offset;

            if (!isInsideBoard(oneStepRow, targetCol)) {
                continue;
            }

            const targetPiece = board[oneStepRow][targetCol];

            if (targetPiece && targetPiece.color !== piece.color) {
                moves.push(squareFromIndex(oneStepRow, targetCol));
            }
        }

        return moves;
    }

    #getKnightMoves(board, piece) {
        return PIECE_DIRECTIONS.knight
            .map((offset) => ({ row: piece.row + offset.row, col: piece.col + offset.col }))
            .filter(({ row, col }) => isInsideBoard(row, col))
            .filter(({ row, col }) => !board[row][col] || board[row][col].color !== piece.color)
            .map(({ row, col }) => squareFromIndex(row, col));
    }

    #getSlidingMoves(board, piece, directions) {
        const moves = [];

        directions.forEach((direction) => {
            let row = piece.row + direction.row;
            let col = piece.col + direction.col;

            while (isInsideBoard(row, col)) {
                const targetPiece = board[row][col];

                if (!targetPiece) {
                    moves.push(squareFromIndex(row, col));
                    row += direction.row;
                    col += direction.col;
                    continue;
                }

                if (targetPiece.color !== piece.color) {
                    moves.push(squareFromIndex(row, col));
                }

                break;
            }
        });

        return moves;
    }

    #getKingMoves(board, piece) {
        return PIECE_DIRECTIONS.king
            .map((offset) => ({ row: piece.row + offset.row, col: piece.col + offset.col }))
            .filter(({ row, col }) => isInsideBoard(row, col))
            .filter(({ row, col }) => !board[row][col] || board[row][col].color !== piece.color)
            .map(({ row, col }) => squareFromIndex(row, col));
    }

    #applyMove(board, fromSquare, toSquare, promotion = "Q") {
        const from = parseSquare(fromSquare);
        const to = parseSquare(toSquare);
        const movingPiece = clonePiece(board[from.row][from.col]);

        if (!movingPiece) {
            throw new Error(`No piece on ${fromSquare}.`);
        }

        const capturedPiece = clonePiece(board[to.row][to.col]);
        const nextPiece = {
            ...movingPiece,
            row: to.row,
            col: to.col,
            square: squareFromIndex(to.row, to.col),
            hasMoved: true
        };

        if (movingPiece.type === "P" && (to.row === 0 || to.row === BOARD_SIZE - 1)) {
            nextPiece.type = promotion;
        }

        board[from.row][from.col] = null;
        board[to.row][to.col] = nextPiece;

        return {
            color: movingPiece.color,
            piece: movingPiece.type,
            from: from.square,
            to: to.square,
            capture: capturedPiece?.type ?? null,
            promotion: nextPiece.type !== movingPiece.type ? nextPiece.type : null
        };
    }

    #buildMoveRecord(gameStateBeforeSync, move) {
        const moveNumber = Math.floor(gameStateBeforeSync.moveHistory.length / 2) + 1;
        const notation = `${move.from}${move.capture ? "x" : "-"}${move.to}${move.promotion ? `=${move.promotion}` : ""}`;

        return {
            id: gameStateBeforeSync.moveHistory.length + 1,
            moveNumber,
            color: move.color,
            piece: move.piece,
            from: move.from,
            to: move.to,
            capture: move.capture,
            promotion: move.promotion,
            notation,
            label: `${COLOR_NAMES[move.color]} ${getPieceLabel(move.piece)} ${notation}`
        };
    }

    #resolveBackRank(positionInput) {
        if (typeof positionInput === "number") {
            return this.generate(positionInput);
        }

        const normalizedBackRank = this.#normalizeBackRank(positionInput);

        if (!this.isValidBackRank(normalizedBackRank)) {
            throw new Error("Back rank is not a legal Chess960 position.");
        }

        return normalizedBackRank;
    }

    #normalizeBackRank(backRank, throwOnInvalid = true) {
        if (!Array.isArray(backRank)) {
            if (throwOnInvalid) {
                throw new Error("Back rank must be an array of 8 piece codes.");
            }

            return null;
        }

        return backRank.map((piece) => typeof piece === "string" ? piece.trim().toUpperCase() : piece);
    }

    #placeAtEmptySlot(row, targetEmptySlot, piece) {
        let emptySeen = 0;

        for (let index = 0; index < row.length; index += 1) {
            if (row[index] !== null) {
                continue;
            }

            if (emptySeen === targetEmptySlot) {
                row[index] = piece;
                return;
            }

            emptySeen += 1;
        }

        throw new Error(`Could not place piece ${piece} at empty slot ${targetEmptySlot}.`);
    }
}
