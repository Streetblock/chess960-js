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
const CASTLE_SIDE_NAMES = Object.freeze({
    kingSide: "O-O",
    queenSide: "O-O-O"
});
const DEFAULT_FEN_OPTIONS = Object.freeze({
    castlingFormat: "shredder"
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

function getLineSquares(row, fromCol, toCol) {
    if (fromCol === toCol) {
        return [squareFromIndex(row, fromCol)];
    }

    const step = fromCol < toCol ? 1 : -1;
    const squares = [];

    for (let col = fromCol; col !== toCol + step; col += step) {
        squares.push(squareFromIndex(row, col));
    }

    return squares;
}

function pieceToFenSymbol(piece) {
    if (!piece) {
        return "";
    }

    return piece.color === "white" ? piece.type : piece.type.toLowerCase();
}

function fenSymbolToPieceType(symbol) {
    const normalized = symbol.toUpperCase();
    const supported = ["K", "Q", "R", "B", "N", "P"];

    if (!supported.includes(normalized)) {
        throw new Error(`Unsupported FEN piece symbol: ${symbol}`);
    }

    return normalized;
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

function cloneCastlingRights(castlingRights) {
    return {
        white: { ...castlingRights.white },
        black: { ...castlingRights.black }
    };
}

function cloneCastlingConfig(castlingConfig) {
    return {
        white: {
            kingStart: castlingConfig.white.kingStart,
            rookStarts: { ...castlingConfig.white.rookStarts },
            kingTargets: { ...castlingConfig.white.kingTargets },
            rookTargets: { ...castlingConfig.white.rookTargets }
        },
        black: {
            kingStart: castlingConfig.black.kingStart,
            rookStarts: { ...castlingConfig.black.rookStarts },
            kingTargets: { ...castlingConfig.black.kingTargets },
            rookTargets: { ...castlingConfig.black.rookTargets }
        }
    };
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

function createCastlingConfig(backRank) {
    const kingCol = backRank.indexOf("K");
    const rookCols = backRank
        .map((piece, index) => piece === "R" ? index : -1)
        .filter((index) => index !== -1);
    const queenSideRookCol = rookCols.find((col) => col < kingCol);
    const kingSideRookCol = rookCols.find((col) => col > kingCol);

    return {
        white: {
            kingStart: squareFromIndex(7, kingCol),
            rookStarts: {
                kingSide: typeof kingSideRookCol === "number" ? squareFromIndex(7, kingSideRookCol) : null,
                queenSide: typeof queenSideRookCol === "number" ? squareFromIndex(7, queenSideRookCol) : null
            },
            kingTargets: {
                kingSide: "g1",
                queenSide: "c1"
            },
            rookTargets: {
                kingSide: "f1",
                queenSide: "d1"
            }
        },
        black: {
            kingStart: squareFromIndex(0, kingCol),
            rookStarts: {
                kingSide: typeof kingSideRookCol === "number" ? squareFromIndex(0, kingSideRookCol) : null,
                queenSide: typeof queenSideRookCol === "number" ? squareFromIndex(0, queenSideRookCol) : null
            },
            kingTargets: {
                kingSide: "g8",
                queenSide: "c8"
            },
            rookTargets: {
                kingSide: "f8",
                queenSide: "d8"
            }
        }
    };
}

function boardToFenPlacement(board) {
    return board.map((row) => {
        let emptyCount = 0;
        let output = "";

        row.forEach((piece) => {
            if (!piece) {
                emptyCount += 1;
                return;
            }

            if (emptyCount > 0) {
                output += String(emptyCount);
                emptyCount = 0;
            }

            output += pieceToFenSymbol(piece);
        });

        if (emptyCount > 0) {
            output += String(emptyCount);
        }

        return output;
    }).join("/");
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
        const castlingConfig = createCastlingConfig(backRank);

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
            isCheck: false,
            enPassantTarget: null,
            halfmoveClock: 0,
            fullmoveNumber: 1,
            castlingConfig,
            castlingRights: {
                white: { kingSide: true, queenSide: true },
                black: { kingSide: true, queenSide: true }
            }
        };

        return this.#syncDerivedState(gameState);
    }

    hydrateGameState(rawState) {
        if (!rawState || !Array.isArray(rawState.board) || !Array.isArray(rawState.backRank)) {
            throw new Error("Cannot hydrate invalid game state.");
        }

        const gameState = this.#cloneGameState(rawState);

        return this.#syncDerivedState(gameState);
    }

    serializeGameState(gameState) {
        return JSON.parse(JSON.stringify(gameState));
    }

    exportFEN(gameState, options = {}) {
        const normalizedState = this.hydrateGameState(gameState);
        const fenOptions = { ...DEFAULT_FEN_OPTIONS, ...options };
        const placement = boardToFenPlacement(normalizedState.board);
        const activeColor = normalizedState.activeColor === "black" ? "b" : "w";
        const castlingRights = this.#formatFenCastlingRights(normalizedState, fenOptions.castlingFormat);
        const enPassantTarget = normalizedState.enPassantTarget ?? "-";

        return [
            placement,
            activeColor,
            castlingRights,
            enPassantTarget,
            normalizedState.halfmoveClock,
            normalizedState.fullmoveNumber
        ].join(" ");
    }

    importFEN(fen, options = {}) {
        if (typeof fen !== "string") {
            throw new Error("FEN must be a string.");
        }

        const parts = fen.trim().split(/\s+/);
        if (parts.length !== 6) {
            throw new Error("FEN must have exactly 6 fields.");
        }

        const [placement, activeColorToken, castlingToken, enPassantToken, halfmoveToken, fullmoveToken] = parts;
        const board = this.#parseFenPlacement(placement);
        const positionInput = this.#resolveImportedPositionInput(board, options);
        const backRank = this.#resolveBackRank(positionInput);
        const castlingConfig = this.#createImportedCastlingConfig(board, backRank, castlingToken);
        const castlingRights = this.#parseFenCastlingRights(castlingToken, castlingConfig);
        const activeColor = activeColorToken === "b" ? "black" : activeColorToken === "w" ? "white" : null;

        if (!activeColor) {
            throw new Error(`Invalid active color token in FEN: ${activeColorToken}`);
        }

        const enPassantTarget = enPassantToken === "-" ? null : parseSquare(enPassantToken).square;
        const halfmoveClock = Number(halfmoveToken);
        const fullmoveNumber = Number(fullmoveToken);

        if (!Number.isInteger(halfmoveClock) || halfmoveClock < 0) {
            throw new Error(`Invalid halfmove clock in FEN: ${halfmoveToken}`);
        }

        if (!Number.isInteger(fullmoveNumber) || fullmoveNumber < 1) {
            throw new Error(`Invalid fullmove number in FEN: ${fullmoveToken}`);
        }

        const gameState = {
            positionId: Array.isArray(positionInput) ? this.getIdFromPosition(positionInput) : positionInput,
            backRank,
            board: this.#applyImportedPieceFlags(board, castlingConfig, castlingRights),
            activeColor,
            selectedSquare: null,
            legalTargets: [],
            moveHistory: [],
            status: "ready",
            winner: null,
            isCheck: false,
            enPassantTarget,
            halfmoveClock,
            fullmoveNumber,
            castlingConfig,
            castlingRights
        };

        return this.#syncDerivedState(gameState);
    }

    #cloneGameState(rawState) {
        const defaultCastlingConfig = createCastlingConfig(rawState.backRank);

        return {
            positionId: typeof rawState.positionId === "number" ? rawState.positionId : this.getIdFromPosition(rawState.backRank),
            backRank: this.#resolveBackRank(rawState.backRank),
            board: cloneBoard(rawState.board),
            activeColor: rawState.activeColor === "black" ? "black" : "white",
            selectedSquare: rawState.selectedSquare ?? null,
            legalTargets: Array.isArray(rawState.legalTargets) ? [...rawState.legalTargets] : [],
            moveHistory: Array.isArray(rawState.moveHistory) ? rawState.moveHistory.map((move) => ({ ...move })) : [],
            status: typeof rawState.status === "string" ? rawState.status : "ready",
            winner: rawState.winner ?? null,
            isCheck: Boolean(rawState.isCheck),
            enPassantTarget: typeof rawState.enPassantTarget === "string" ? rawState.enPassantTarget : null,
            halfmoveClock: Number.isInteger(rawState.halfmoveClock) ? rawState.halfmoveClock : 0,
            fullmoveNumber: Number.isInteger(rawState.fullmoveNumber) ? rawState.fullmoveNumber : 1,
            castlingConfig: rawState.castlingConfig ? cloneCastlingConfig(rawState.castlingConfig) : defaultCastlingConfig,
            castlingRights: rawState.castlingRights ? cloneCastlingRights(rawState.castlingRights) : {
                white: { kingSide: true, queenSide: true },
                black: { kingSide: true, queenSide: true }
            }
        };
    }

    #parseFenPlacement(placement) {
        const ranks = placement.split("/");

        if (ranks.length !== BOARD_SIZE) {
            throw new Error("FEN board placement must contain 8 ranks.");
        }

        const board = createEmptyBoard();

        ranks.forEach((rankToken, row) => {
            let col = 0;

            for (const symbol of rankToken) {
                if (/^\d$/.test(symbol)) {
                    col += Number(symbol);
                    continue;
                }

                if (!isInsideBoard(row, col)) {
                    throw new Error(`FEN rank overflows board width: ${rankToken}`);
                }

                const type = fenSymbolToPieceType(symbol);
                const color = symbol === symbol.toUpperCase() ? "white" : "black";
                board[row][col] = createPiece(type, color, row, col);
                col += 1;
            }

            if (col !== BOARD_SIZE) {
                throw new Error(`FEN rank does not fill 8 files: ${rankToken}`);
            }
        });

        return board;
    }

    #resolveImportedPositionInput(board, options) {
        if (typeof options.positionId === "number") {
            return options.positionId;
        }

        if (Array.isArray(options.backRank)) {
            return options.backRank;
        }

        if (Array.isArray(options.positionInput)) {
            return options.positionInput;
        }

        const whiteHomeRank = board[7].map((piece) => piece?.color === "white" ? piece.type : null);
        if (whiteHomeRank.every(Boolean) && this.isValidBackRank(whiteHomeRank)) {
            return whiteHomeRank;
        }

        const blackHomeRank = board[0].map((piece) => piece?.color === "black" ? piece.type : null);
        if (blackHomeRank.every(Boolean) && this.isValidBackRank(blackHomeRank)) {
            return blackHomeRank;
        }

        throw new Error("Importing this FEN needs the original Chess960 setup. Pass options.backRank or options.positionId.");
    }

    #createImportedCastlingConfig(board, backRank, castlingToken) {
        const config = createCastlingConfig(backRank);
        const parsedToken = castlingToken === "-" ? "" : castlingToken;
        const tokenChars = [...parsedToken];

        ["white", "black"].forEach((color) => {
            const kingSquare = this.#findKingSquare(board, color)?.square;
            if (kingSquare) {
                config[color].kingStart = kingSquare;
            }
        });

        tokenChars.forEach((token) => {
            if (token === "K" || token === "Q" || token === "k" || token === "q") {
                return;
            }

            const isWhite = token === token.toUpperCase();
            const color = isWhite ? "white" : "black";
            const file = token.toLowerCase();
            const col = FILES.indexOf(file);

            if (col === -1) {
                throw new Error(`Unsupported castling token in FEN: ${token}`);
            }

            const kingCol = parseSquare(config[color].kingStart).col;
            const side = col > kingCol ? "kingSide" : "queenSide";
            const row = color === "white" ? 7 : 0;
            config[color].rookStarts[side] = squareFromIndex(row, col);
        });

        return config;
    }

    #parseFenCastlingRights(castlingToken, castlingConfig) {
        const rights = {
            white: { kingSide: false, queenSide: false },
            black: { kingSide: false, queenSide: false }
        };

        if (castlingToken === "-") {
            return rights;
        }

        for (const token of castlingToken) {
            if (token === "K") {
                rights.white.kingSide = true;
                continue;
            }

            if (token === "Q") {
                rights.white.queenSide = true;
                continue;
            }

            if (token === "k") {
                rights.black.kingSide = true;
                continue;
            }

            if (token === "q") {
                rights.black.queenSide = true;
                continue;
            }

            const isWhite = token === token.toUpperCase();
            const color = isWhite ? "white" : "black";
            const col = FILES.indexOf(token.toLowerCase());

            if (col === -1) {
                throw new Error(`Unsupported castling token in FEN: ${token}`);
            }

            const kingCol = parseSquare(castlingConfig[color].kingStart).col;
            const side = col > kingCol ? "kingSide" : "queenSide";
            rights[color][side] = true;
        }

        return rights;
    }

    #formatFenCastlingRights(gameState, castlingFormat) {
        const white = this.#formatFenCastlingRightsForColor(gameState, "white", castlingFormat);
        const black = this.#formatFenCastlingRightsForColor(gameState, "black", castlingFormat);
        const token = `${white}${black}`;

        return token || "-";
    }

    #formatFenCastlingRightsForColor(gameState, color, castlingFormat) {
        const config = gameState.castlingConfig[color];
        const rights = gameState.castlingRights[color];
        const isWhite = color === "white";
        const tokens = [];

        if (rights.kingSide) {
            tokens.push(this.#formatFenCastleToken(config.rookStarts.kingSide, "kingSide", castlingFormat, isWhite));
        }

        if (rights.queenSide) {
            tokens.push(this.#formatFenCastleToken(config.rookStarts.queenSide, "queenSide", castlingFormat, isWhite));
        }

        return tokens.join("");
    }

    #formatFenCastleToken(rookStartSquare, side, castlingFormat, isWhite) {
        if (!rookStartSquare) {
            return "";
        }

        if (castlingFormat === "standard") {
            const baseToken = side === "kingSide" ? "K" : "Q";
            return isWhite ? baseToken : baseToken.toLowerCase();
        }

        const file = rookStartSquare[0];
        return isWhite ? file.toUpperCase() : file;
    }

    #applyImportedPieceFlags(board, castlingConfig, castlingRights) {
        return board.map((row) => row.map((piece) => {
            if (!piece) {
                return null;
            }

            return {
                ...piece,
                hasMoved: this.#inferImportedPieceHasMoved(piece, castlingConfig, castlingRights)
            };
        }));
    }

    #inferImportedPieceHasMoved(piece, castlingConfig, castlingRights) {
        if (piece.type === "P") {
            return !(piece.color === "white" ? piece.row === 6 : piece.row === 1);
        }

        if (piece.type === "K") {
            const anyRights = castlingRights[piece.color].kingSide || castlingRights[piece.color].queenSide;
            return !(anyRights && piece.square === castlingConfig[piece.color].kingStart);
        }

        if (piece.type === "R") {
            const config = castlingConfig[piece.color];
            if (castlingRights[piece.color].kingSide && piece.square === config.rookStarts.kingSide) {
                return false;
            }

            if (castlingRights[piece.color].queenSide && piece.square === config.rookStarts.queenSide) {
                return false;
            }
        }

        return true;
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

        const move = this.#applyMove(nextState, fromSquare, toSquare, promotion);
        const movingColor = move.color;

        nextState.activeColor = otherColor(nextState.activeColor);
        nextState.selectedSquare = null;
        nextState.legalTargets = [];
        nextState.fullmoveNumber = movingColor === "black" ? nextState.fullmoveNumber + 1 : nextState.fullmoveNumber;
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
            legalTargets: [...gameState.legalTargets],
            castlingConfig: cloneCastlingConfig(gameState.castlingConfig),
            castlingRights: cloneCastlingRights(gameState.castlingRights)
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
        const pseudoMoves = this.#getPseudoLegalMoves(gameState, piece);
        const legalMoves = [];

        pseudoMoves.forEach((targetSquare) => {
            const simulatedState = this.#cloneGameState(gameState);
            this.#applyMove(simulatedState, piece.square, targetSquare, "Q");

            if (!this.#isSquareAttackedAfterMove(simulatedState.board, piece.color)) {
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

    #getPseudoLegalMoves(gameState, piece) {
        switch (piece.type) {
            case "P":
                return this.#getPawnMoves(gameState, piece);
            case "N":
                return this.#getKnightMoves(gameState.board, piece);
            case "B":
                return this.#getSlidingMoves(gameState.board, piece, PIECE_DIRECTIONS.bishop);
            case "R":
                return this.#getSlidingMoves(gameState.board, piece, PIECE_DIRECTIONS.rook);
            case "Q":
                return this.#getSlidingMoves(gameState.board, piece, [...PIECE_DIRECTIONS.bishop, ...PIECE_DIRECTIONS.rook]);
            case "K":
                return [
                    ...this.#getKingMoves(gameState.board, piece),
                    ...this.#getCastlingMoves(gameState, piece)
                ];
            default:
                return [];
        }
    }

    #getPawnMoves(gameState, piece) {
        const board = gameState.board;
        const moves = [];
        const direction = piece.color === "white" ? -1 : 1;
        const oneStepRow = piece.row + direction;

        if (isInsideBoard(oneStepRow, piece.col) && !board[oneStepRow][piece.col]) {
            moves.push(squareFromIndex(oneStepRow, piece.col));

            const startRow = piece.color === "white" ? 6 : 1;
            const twoStepRow = piece.row + (direction * 2);

            if (piece.row === startRow && isInsideBoard(twoStepRow, piece.col) && !board[twoStepRow][piece.col]) {
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
                continue;
            }

            if (gameState.enPassantTarget === squareFromIndex(oneStepRow, targetCol)) {
                const adjacentPiece = board[piece.row][targetCol];
                if (adjacentPiece?.type === "P" && adjacentPiece.color !== piece.color) {
                    moves.push(squareFromIndex(oneStepRow, targetCol));
                }
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

    #getCastlingMoves(gameState, kingPiece) {
        if (kingPiece.type !== "K") {
            return [];
        }

        const config = gameState.castlingConfig[kingPiece.color];
        if (kingPiece.square !== config.kingStart) {
            return [];
        }

        const moves = [];
        ["kingSide", "queenSide"].forEach((side) => {
            if (this.#canCastle(gameState, kingPiece.color, side)) {
                moves.push(config.kingTargets[side]);
            }
        });

        return moves;
    }

    #canCastle(gameState, color, side) {
        if (!gameState.castlingRights[color][side]) {
            return false;
        }

        const config = gameState.castlingConfig[color];
        const rookStart = config.rookStarts[side];
        const kingStart = config.kingStart;

        if (!rookStart || !kingStart) {
            return false;
        }

        const kingPiece = this.getPieceAt(gameState, kingStart);
        const rookPiece = this.getPieceAt(gameState, rookStart);

        if (!kingPiece || kingPiece.type !== "K" || kingPiece.color !== color || kingPiece.hasMoved) {
            return false;
        }

        if (!rookPiece || rookPiece.type !== "R" || rookPiece.color !== color || rookPiece.hasMoved) {
            return false;
        }

        const kingStartPos = parseSquare(kingStart);
        const rookStartPos = parseSquare(rookStart);

        if (kingStartPos.row !== rookStartPos.row) {
            return false;
        }

        const boardWithoutCastlePieces = cloneBoard(gameState.board);
        boardWithoutCastlePieces[kingStartPos.row][kingStartPos.col] = null;
        boardWithoutCastlePieces[rookStartPos.row][rookStartPos.col] = null;

        const kingTarget = parseSquare(config.kingTargets[side]);
        const rookTarget = parseSquare(config.rookTargets[side]);
        const betweenSquares = getLineSquares(kingStartPos.row, kingStartPos.col, rookStartPos.col)
            .slice(1, -1);

        if (betweenSquares.some((square) => {
            const position = parseSquare(square);
            return Boolean(gameState.board[position.row][position.col]);
        })) {
            return false;
        }

        const requiredEmptySquares = new Set([
            ...getLineSquares(kingStartPos.row, kingStartPos.col, kingTarget.col),
            ...getLineSquares(rookStartPos.row, rookStartPos.col, rookTarget.col)
        ]);

        requiredEmptySquares.delete(kingStart);
        requiredEmptySquares.delete(rookStart);

        for (const square of requiredEmptySquares) {
            const position = parseSquare(square);
            if (boardWithoutCastlePieces[position.row][position.col]) {
                return false;
            }
        }

        const kingTravelSquares = getLineSquares(kingStartPos.row, kingStartPos.col, kingTarget.col);

        for (const square of kingTravelSquares) {
            const position = parseSquare(square);
            const boardProbe = cloneBoard(boardWithoutCastlePieces);
            boardProbe[position.row][position.col] = createPiece("K", color, position.row, position.col);

            if (this.#isSquareAttacked(boardProbe, position.row, position.col, otherColor(color))) {
                return false;
            }
        }

        return true;
    }

    #getCastlingSide(gameState, piece, toSquare) {
        if (piece.type !== "K") {
            return null;
        }

        const config = gameState.castlingConfig[piece.color];
        if (piece.square !== config.kingStart) {
            return null;
        }

        if (toSquare === config.kingTargets.kingSide && this.#canCastle(gameState, piece.color, "kingSide")) {
            return "kingSide";
        }

        if (toSquare === config.kingTargets.queenSide && this.#canCastle(gameState, piece.color, "queenSide")) {
            return "queenSide";
        }

        return null;
    }

    #applyMove(gameState, fromSquare, toSquare, promotion = "Q") {
        const from = parseSquare(fromSquare);
        const to = parseSquare(toSquare);
        const movingPiece = clonePiece(gameState.board[from.row][from.col]);

        if (!movingPiece) {
            throw new Error(`No piece on ${fromSquare}.`);
        }

        const castlingSide = this.#getCastlingSide(gameState, movingPiece, toSquare);
        const moveContext = {
            color: movingPiece.color,
            piece: movingPiece.type,
            from: from.square,
            to: to.square,
            capture: null,
            promotion: null,
            isCastle: false,
            castleSide: null,
            rookFrom: null,
            rookTo: null,
            isEnPassant: false,
            enPassantTargetBefore: gameState.enPassantTarget,
            enPassantTargetAfter: null,
            castlingRightsBefore: cloneCastlingRights(gameState.castlingRights),
            castlingRightsAfter: null,
            fullmoveNumber: gameState.fullmoveNumber,
            halfmoveClockBefore: gameState.halfmoveClock,
            halfmoveClockAfter: 0
        };

        if (castlingSide) {
            return this.#applyCastleMove(gameState, movingPiece, castlingSide, moveContext);
        }

        const targetPiece = clonePiece(gameState.board[to.row][to.col]);
        const isDiagonalPawnMove = movingPiece.type === "P" && from.col !== to.col;
        const isEnPassantCapture = movingPiece.type === "P"
            && isDiagonalPawnMove
            && !targetPiece
            && gameState.enPassantTarget === to.square;

        let capturedPiece = targetPiece;

        gameState.board[from.row][from.col] = null;

        if (isEnPassantCapture) {
            const captureRow = movingPiece.row;
            capturedPiece = clonePiece(gameState.board[captureRow][to.col]);
            gameState.board[captureRow][to.col] = null;
        }

        const nextPiece = {
            ...movingPiece,
            row: to.row,
            col: to.col,
            square: squareFromIndex(to.row, to.col),
            hasMoved: true
        };

        if (movingPiece.type === "P" && (to.row === 0 || to.row === BOARD_SIZE - 1)) {
            nextPiece.type = promotion;
            moveContext.promotion = promotion;
        }

        gameState.board[to.row][to.col] = nextPiece;
        gameState.enPassantTarget = null;

        if (movingPiece.type === "P" && Math.abs(to.row - from.row) === 2) {
            gameState.enPassantTarget = squareFromIndex((from.row + to.row) / 2, from.col);
        }

        this.#updateCastlingRights(gameState, movingPiece, from.square, capturedPiece, to.square);

        moveContext.capture = capturedPiece?.type ?? null;
        moveContext.to = nextPiece.square;
        moveContext.isEnPassant = isEnPassantCapture;
        moveContext.enPassantTargetAfter = gameState.enPassantTarget;
        moveContext.castlingRightsAfter = cloneCastlingRights(gameState.castlingRights);
        moveContext.halfmoveClockAfter = movingPiece.type === "P" || capturedPiece ? 0 : gameState.halfmoveClock + 1;
        gameState.halfmoveClock = moveContext.halfmoveClockAfter;

        return moveContext;
    }

    #applyCastleMove(gameState, kingPiece, side, moveContext) {
        const config = gameState.castlingConfig[kingPiece.color];
        const kingStart = parseSquare(config.kingStart);
        const rookStart = parseSquare(config.rookStarts[side]);
        const kingTarget = parseSquare(config.kingTargets[side]);
        const rookTarget = parseSquare(config.rookTargets[side]);
        const rookPiece = clonePiece(gameState.board[rookStart.row][rookStart.col]);

        gameState.board[kingStart.row][kingStart.col] = null;
        gameState.board[rookStart.row][rookStart.col] = null;

        gameState.board[kingTarget.row][kingTarget.col] = {
            ...kingPiece,
            row: kingTarget.row,
            col: kingTarget.col,
            square: kingTarget.square,
            hasMoved: true
        };
        gameState.board[rookTarget.row][rookTarget.col] = {
            ...rookPiece,
            row: rookTarget.row,
            col: rookTarget.col,
            square: rookTarget.square,
            hasMoved: true
        };

        gameState.enPassantTarget = null;
        gameState.castlingRights[kingPiece.color].kingSide = false;
        gameState.castlingRights[kingPiece.color].queenSide = false;
        gameState.halfmoveClock += 1;

        moveContext.to = kingTarget.square;
        moveContext.isCastle = true;
        moveContext.castleSide = side;
        moveContext.rookFrom = rookStart.square;
        moveContext.rookTo = rookTarget.square;
        moveContext.enPassantTargetAfter = null;
        moveContext.castlingRightsAfter = cloneCastlingRights(gameState.castlingRights);
        moveContext.halfmoveClockAfter = gameState.halfmoveClock;

        return moveContext;
    }

    #updateCastlingRights(gameState, movingPiece, fromSquare, capturedPiece, toSquare) {
        const movingColorConfig = gameState.castlingConfig[movingPiece.color];
        const opponentColor = otherColor(movingPiece.color);
        const opponentConfig = gameState.castlingConfig[opponentColor];

        if (movingPiece.type === "K") {
            gameState.castlingRights[movingPiece.color].kingSide = false;
            gameState.castlingRights[movingPiece.color].queenSide = false;
        }

        if (movingPiece.type === "R") {
            if (fromSquare === movingColorConfig.rookStarts.kingSide) {
                gameState.castlingRights[movingPiece.color].kingSide = false;
            }

            if (fromSquare === movingColorConfig.rookStarts.queenSide) {
                gameState.castlingRights[movingPiece.color].queenSide = false;
            }
        }

        if (capturedPiece?.type === "R") {
            if (toSquare === opponentConfig.rookStarts.kingSide) {
                gameState.castlingRights[opponentColor].kingSide = false;
            }

            if (toSquare === opponentConfig.rookStarts.queenSide) {
                gameState.castlingRights[opponentColor].queenSide = false;
            }
        }
    }

    #buildMoveRecord(gameStateBeforeSync, move) {
        const ply = gameStateBeforeSync.moveHistory.length + 1;
        const moveNumber = Math.floor((ply + 1) / 2);
        let notation = `${move.from}${move.capture ? "x" : "-"}${move.to}`;

        if (move.isCastle) {
            notation = CASTLE_SIDE_NAMES[move.castleSide];
        } else if (move.promotion) {
            notation = `${notation}=${move.promotion}`;
        }

        if (move.isEnPassant) {
            notation = `${notation} e.p.`;
        }

        return {
            id: ply,
            ply,
            moveNumber,
            color: move.color,
            piece: move.piece,
            from: move.from,
            to: move.to,
            capture: move.capture,
            promotion: move.promotion,
            isCastle: move.isCastle,
            castleSide: move.castleSide,
            rookFrom: move.rookFrom,
            rookTo: move.rookTo,
            isEnPassant: move.isEnPassant,
            enPassantTargetBefore: move.enPassantTargetBefore,
            enPassantTargetAfter: move.enPassantTargetAfter,
            castlingRightsBefore: move.castlingRightsBefore,
            castlingRightsAfter: move.castlingRightsAfter,
            halfmoveClockAfter: move.halfmoveClockAfter,
            fullmoveNumber: move.fullmoveNumber,
            notation,
            label: move.isCastle
                ? `${COLOR_NAMES[move.color]} castles ${move.castleSide === "kingSide" ? "king side" : "queen side"}`
                : `${COLOR_NAMES[move.color]} ${getPieceLabel(move.piece)} ${notation}`
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
