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
const PROMOTION_PIECES = Object.freeze(["Q", "R", "B", "N"]);
const CLAIMABLE_DRAW_REASONS = Object.freeze(["threefoldRepetition", "fiftyMoveRule"]);
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

function cloneVariationGraph(variationGraph) {
    if (!variationGraph || typeof variationGraph !== "object") {
        return null;
    }

    return {
        rootId: variationGraph.rootId,
        nextNodeId: variationGraph.nextNodeId,
        nodes: Object.fromEntries(
            Object.entries(variationGraph.nodes ?? {}).map(([nodeId, node]) => ([
                nodeId,
                {
                    id: node.id,
                    parentId: node.parentId ?? null,
                    children: Array.isArray(node.children) ? [...node.children] : [],
                    preferredChildId: node.preferredChildId ?? null,
                    move: node.move ? { ...node.move } : null,
                    snapshot: node.snapshot ? JSON.parse(JSON.stringify(node.snapshot)) : null
                }
            ]))
        )
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
            positionHistory: [],
            drawReason: null,
            claimableDraws: [],
            setupFEN: null,
            stateHistory: [],
            historyIndex: 0,
            lineNodeIds: [],
            currentNodeId: null,
            variationGraph: null,
            canUndo: false,
            canRedo: false,
            castlingConfig,
            castlingRights: {
                white: { kingSide: true, queenSide: true },
                black: { kingSide: true, queenSide: true }
            }
        };

        return this.#seedHistory(this.#syncDerivedState(gameState));
    }

    hydrateGameState(rawState) {
        if (!rawState || !Array.isArray(rawState.board) || !Array.isArray(rawState.backRank)) {
            throw new Error("Cannot hydrate invalid game state.");
        }

        const hasVariationGraph = rawState.variationGraph && typeof rawState.variationGraph === "object";
        const hasHistory = Array.isArray(rawState.stateHistory) && rawState.stateHistory.length > 0;

        if (!hasHistory && !hasVariationGraph) {
            return this.#seedHistory(this.#syncDerivedState(this.#cloneGameState(rawState)));
        }

        if (!hasVariationGraph) {
            const stateHistory = rawState.stateHistory.map((snapshot) => (
                this.#createHistorySnapshot(this.#syncDerivedState(this.#cloneGameState(snapshot)))
            ));
            const rawHistoryIndex = Number.isInteger(rawState.historyIndex) ? rawState.historyIndex : stateHistory.length - 1;
            const historyIndex = Math.max(0, Math.min(rawHistoryIndex, stateHistory.length - 1));
            const currentState = this.#syncDerivedState(this.#cloneGameState(rawState));

            return this.#attachHistory(currentState, stateHistory, historyIndex);
        }

        const currentState = this.#syncDerivedState(this.#cloneGameState(rawState));
        return this.#syncVariationState(currentState);
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
            positionHistory: [],
            drawReason: null,
            claimableDraws: [],
            setupFEN: fen.trim(),
            stateHistory: [],
            historyIndex: 0,
            lineNodeIds: [],
            currentNodeId: null,
            variationGraph: null,
            canUndo: false,
            canRedo: false,
            castlingConfig,
            castlingRights
        };

        return this.#seedHistory(this.#syncDerivedState(gameState));
    }

    exportPGN(gameState, options = {}) {
        const normalizedState = this.hydrateGameState(gameState);
        const headers = {
            Event: "Casual Game",
            Site: "?",
            Date: "????.??.??",
            Round: "?",
            White: "White",
            Black: "Black",
            Result: this.#getPgnResult(normalizedState),
            Variant: "Chess960",
            ...options.headers
        };
        const startingFen = normalizedState.setupFEN ?? this.exportFEN(this.createGame(normalizedState.backRank));
        const includeSetup = options.includeSetup ?? Boolean(normalizedState.setupFEN || normalizedState.positionId !== this.classicPositionId);

        if (includeSetup) {
            headers.SetUp = "1";
            headers.FEN = startingFen;
        }

        const headerSection = Object.entries(headers)
            .map(([key, value]) => `[${key} "${value}"]`)
            .join("\n");
        const moveSection = this.#formatPgnMoves(normalizedState.moveHistory, headers.Result);

        return `${headerSection}\n\n${moveSection}`.trim();
    }

    applySAN(gameState, sanMove) {
        if (typeof sanMove !== "string" || !sanMove.trim()) {
            throw new Error("SAN move must be a non-empty string.");
        }

        const previousState = this.hydrateGameState(gameState);
        const targetSan = this.#normalizeSanToken(sanMove);
        const legalMoves = this.#enumerateLegalMoves(previousState);

        for (const candidate of legalMoves) {
            const nextState = this.movePiece(previousState, candidate.from, candidate.to, candidate.promotion);
            const lastMove = nextState.moveHistory.at(-1);

            if (lastMove && this.#normalizeSanToken(lastMove.san ?? lastMove.notation) === targetSan) {
                return nextState;
            }
        }

        throw new Error(`Could not resolve SAN move: ${sanMove}`);
    }

    importPGN(pgn, options = {}) {
        if (typeof pgn !== "string") {
            throw new Error("PGN must be a string.");
        }

        const { headers, movetext } = this.#parsePgnDocument(pgn);
        let gameState;
        const warnings = [];

        if (headers.FEN) {
            const fenOptions = {
                ...options
            };

            if (headers.SetUp === "1" && !fenOptions.backRank && !Number.isInteger(fenOptions.positionId) && !Array.isArray(fenOptions.positionInput)) {
                fenOptions.backRank = this.#deriveBackRankFromFenHeader(headers.FEN);
            }

            gameState = this.importFEN(headers.FEN, fenOptions);
        } else if (Number.isInteger(options.positionId) || Array.isArray(options.backRank) || Array.isArray(options.positionInput)) {
            const positionInput = Number.isInteger(options.positionId)
                ? options.positionId
                : (options.backRank ?? options.positionInput);
            gameState = this.createGame(positionInput);
        } else {
            if (headers.Variant === "Chess960") {
                warnings.push("PGN declares Variant \"Chess960\" without a FEN start position. Falling back to classical start position 518.");
            }
            gameState = this.createGame(this.classicPositionId);
        }

        const tokens = this.#tokenizePgnMoves(movetext);

        for (const token of tokens) {
            if (this.#isPgnResultToken(token)) {
                continue;
            }

            gameState = this.applySAN(gameState, token);
        }

        return {
            headers,
            gameState,
            warnings
        };
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
            positionHistory: Array.isArray(rawState.positionHistory) ? [...rawState.positionHistory] : [],
            drawReason: typeof rawState.drawReason === "string" ? rawState.drawReason : null,
            claimableDraws: Array.isArray(rawState.claimableDraws) ? [...rawState.claimableDraws] : [],
            setupFEN: typeof rawState.setupFEN === "string" ? rawState.setupFEN : null,
            stateHistory: Array.isArray(rawState.stateHistory) ? rawState.stateHistory.map((snapshot) => this.#cloneHistorySnapshot(snapshot)) : [],
            historyIndex: Number.isInteger(rawState.historyIndex) ? rawState.historyIndex : 0,
            lineNodeIds: Array.isArray(rawState.lineNodeIds) ? [...rawState.lineNodeIds] : [],
            currentNodeId: rawState.currentNodeId ?? null,
            variationGraph: rawState.variationGraph ? cloneVariationGraph(rawState.variationGraph) : null,
            canUndo: Boolean(rawState.canUndo),
            canRedo: Boolean(rawState.canRedo),
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

    #annotateLastMove(previousState, move, syncedState) {
        if (syncedState.moveHistory.length === 0) {
            return syncedState;
        }

        const nextState = this.#cloneGameState(syncedState);
        const lastMoveIndex = nextState.moveHistory.length - 1;
        const san = this.#buildSan(previousState, move, syncedState);
        const notation = nextState.moveHistory[lastMoveIndex].notation;

        nextState.moveHistory[lastMoveIndex] = {
            ...nextState.moveHistory[lastMoveIndex],
            san,
            label: `${COLOR_NAMES[move.color]} ${getPieceLabel(move.piece)} ${san}`,
            pgn: san,
            longAlgebraic: notation,
            positionKeyAfter: syncedState.positionHistory.at(-1) ?? null
        };

        return nextState;
    }

    #buildSan(previousState, move, resultingState) {
        let san;

        if (move.isCastle) {
            san = CASTLE_SIDE_NAMES[move.castleSide];
        } else {
            const pieceLetter = move.piece === "P" ? "" : move.piece;
            const disambiguation = move.piece === "P" ? "" : this.#getSanDisambiguation(previousState, move);
            const captureToken = move.capture || move.isEnPassant ? "x" : "";
            const destination = move.to;
            const promotionSuffix = move.promotion ? `=${move.promotion}` : "";
            const pawnPrefix = move.piece === "P" && captureToken ? move.from[0] : "";
            san = `${pieceLetter}${disambiguation}${pawnPrefix}${captureToken}${destination}${promotionSuffix}`;
        }

        if (resultingState.status === "checkmate" && resultingState.winner === move.color) {
            return `${san}#`;
        }

        if (resultingState.status === "check") {
            return `${san}+`;
        }

        return san;
    }

    #getSanDisambiguation(gameState, move) {
        const candidates = [];

        for (let row = 0; row < BOARD_SIZE; row += 1) {
            for (let col = 0; col < BOARD_SIZE; col += 1) {
                const piece = gameState.board[row][col];

                if (!piece || piece.color !== move.color || piece.type !== move.piece || piece.square === move.from) {
                    continue;
                }

                if (this.getLegalMoves(gameState, piece.square).includes(move.to)) {
                    candidates.push(piece);
                }
            }
        }

        if (candidates.length === 0) {
            return "";
        }

        const from = parseSquare(move.from);
        const sameFile = candidates.some((piece) => piece.col === from.col);
        const sameRank = candidates.some((piece) => piece.row === from.row);

        if (!sameFile) {
            return move.from[0];
        }

        if (!sameRank) {
            return move.from[1];
        }

        return move.from;
    }

    #getPgnResult(gameState) {
        if (gameState.status === "checkmate") {
            return gameState.winner === "white" ? "1-0" : "0-1";
        }

        if (gameState.status === "stalemate" || gameState.status === "draw") {
            return "1/2-1/2";
        }

        return "*";
    }

    #formatPgnMoves(moveHistory, result) {
        if (moveHistory.length === 0) {
            return result;
        }

        const tokens = [];

        for (let index = 0; index < moveHistory.length; index += 1) {
            const move = moveHistory[index];

            if (move.color === "white") {
                tokens.push(`${move.moveNumber}. ${move.san ?? move.notation}`);
            } else if (index === 0) {
                tokens.push(`${move.moveNumber}... ${move.san ?? move.notation}`);
            } else {
                tokens.push(move.san ?? move.notation);
            }
        }

        tokens.push(result);
        return tokens.join(" ");
    }

    #parsePgnDocument(pgn) {
        const lines = pgn.replace(/\r\n/g, "\n").split("\n");
        const headers = {};
        const moveLines = [];
        let inHeaders = true;

        lines.forEach((line) => {
            const trimmed = line.trim();

            if (inHeaders && trimmed.startsWith("[") && trimmed.endsWith("]")) {
                const match = trimmed.match(/^\[(\w+)\s+"(.*)"\]$/);
                if (match) {
                    headers[match[1]] = match[2];
                }
                return;
            }

            if (trimmed === "" && inHeaders) {
                return;
            }

            inHeaders = false;
            if (trimmed !== "") {
                moveLines.push(trimmed);
            }
        });

        return {
            headers,
            movetext: moveLines.join(" ")
        };
    }

    #tokenizePgnMoves(movetext) {
        const withoutComments = movetext
            .replace(/\{[^}]*\}/g, " ")
            .replace(/;[^\n]*/g, " ")
            .replace(/\([^()]*\)/g, " ");

        return withoutComments
            .split(/\s+/)
            .map((token) => token.trim())
            .filter(Boolean)
            .filter((token) => !/^\d+\.(\.\.)?$/.test(token))
            .filter((token) => !/^\$\d+$/.test(token));
    }

    #isPgnResultToken(token) {
        return token === "1-0" || token === "0-1" || token === "1/2-1/2" || token === "*";
    }

    #normalizeSanToken(token) {
        return token
            .trim()
            .replace(/[!?]+/g, "")
            .replace(/\s+/g, "");
    }

    #getRepetitionKey(gameState) {
        const placement = boardToFenPlacement(gameState.board);
        const activeColor = gameState.activeColor === "black" ? "b" : "w";
        const castlingRights = this.#formatFenCastlingRights(gameState, "shredder");
        const enPassantTarget = this.#getCanonicalEnPassantTarget(gameState) ?? "-";

        return `${placement} ${activeColor} ${castlingRights} ${enPassantTarget}`;
    }

    #getCanonicalEnPassantTarget(gameState) {
        if (!gameState.enPassantTarget) {
            return null;
        }

        const target = parseSquare(gameState.enPassantTarget);
        const sourceRow = gameState.activeColor === "white" ? target.row + 1 : target.row - 1;

        for (const offset of [-1, 1]) {
            const sourceCol = target.col + offset;

            if (!isInsideBoard(sourceRow, sourceCol)) {
                continue;
            }

            const piece = gameState.board[sourceRow][sourceCol];
            if (piece?.type === "P" && piece.color === gameState.activeColor) {
                return gameState.enPassantTarget;
            }
        }

        return null;
    }

    #getClaimableDraws(gameState, repetitionCount) {
        const claimableDraws = [];

        if (gameState.halfmoveClock >= 100) {
            claimableDraws.push("fiftyMoveRule");
        }

        if (repetitionCount >= 3) {
            claimableDraws.push("threefoldRepetition");
        }

        return claimableDraws;
    }

    #getAutomaticDrawReason(gameState, repetitionCount) {
        if (this.#hasInsufficientMaterial(gameState.board)) {
            return "insufficientMaterial";
        }

        if (repetitionCount >= 5) {
            return "fivefoldRepetition";
        }

        if (gameState.halfmoveClock >= 150) {
            return "seventyFiveMoveRule";
        }

        return null;
    }

    #hasInsufficientMaterial(board) {
        const pieces = [];

        for (let row = 0; row < BOARD_SIZE; row += 1) {
            for (let col = 0; col < BOARD_SIZE; col += 1) {
                const piece = board[row][col];

                if (!piece || piece.type === "K") {
                    continue;
                }

                pieces.push(piece);
            }
        }

        if (pieces.length === 0) {
            return true;
        }

        if (pieces.some((piece) => ["Q", "R", "P"].includes(piece.type))) {
            return false;
        }

        if (pieces.length === 1 && ["B", "N"].includes(pieces[0].type)) {
            return true;
        }

        if (pieces.length === 2 && pieces.every((piece) => piece.type === "B")) {
            const bishopColors = pieces.map((piece) => (piece.row + piece.col) % 2);
            return bishopColors[0] === bishopColors[1];
        }

        return false;
    }

    #enumerateLegalMoves(gameState) {
        const moves = [];

        for (let row = 0; row < BOARD_SIZE; row += 1) {
            for (let col = 0; col < BOARD_SIZE; col += 1) {
                const piece = gameState.board[row][col];

                if (!piece || piece.color !== gameState.activeColor) {
                    continue;
                }

                const legalTargets = this.getLegalMoves(gameState, piece.square);

                legalTargets.forEach((targetSquare) => {
                    const promotions = piece.type === "P" && (targetSquare.endsWith("8") || targetSquare.endsWith("1"))
                        ? ["Q", "R", "B", "N"]
                        : [undefined];

                    promotions.forEach((promotion) => {
                        moves.push({
                            from: piece.square,
                            to: targetSquare,
                            promotion
                        });
                    });
                });
            }
        }

        return moves;
    }

    #deriveBackRankFromFenHeader(fen) {
        const placement = fen.trim().split(/\s+/)[0];
        const ranks = placement.split("/");
        const whiteRank = ranks.at(-1);

        if (!whiteRank) {
            throw new Error("Could not derive Chess960 back rank from FEN header.");
        }

        const backRank = [];
        for (const symbol of whiteRank) {
            if (/^\d$/.test(symbol)) {
                throw new Error("FEN header does not contain a full white back rank.");
            }

            backRank.push(fenSymbolToPieceType(symbol));
        }

        if (!this.isValidBackRank(backRank)) {
            throw new Error("Derived back rank from FEN header is not a legal Chess960 setup.");
        }

        return backRank;
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

        if (nextState.status === "checkmate" || nextState.status === "stalemate" || nextState.status === "draw") {
            return nextState;
        }

        if (nextState.selectedSquare && nextState.legalTargets.includes(square)) {
            return this.movePiece(nextState, nextState.selectedSquare, square);
        }

        return this.selectSquare(nextState, square);
    }

    movePiece(gameState, fromSquare, toSquare, promotion = "Q") {
        const previousState = this.hydrateGameState(gameState);
        const nextState = this.#cloneGameState(previousState);
        const legalMoves = this.getLegalMoves(previousState, fromSquare);

        if (!legalMoves.includes(toSquare)) {
            throw new Error(`Illegal move from ${fromSquare} to ${toSquare}.`);
        }

        const move = this.#applyMove(nextState, fromSquare, toSquare, promotion);
        const movingColor = move.color;

        nextState.activeColor = otherColor(nextState.activeColor);
        nextState.selectedSquare = null;
        nextState.legalTargets = [];
        nextState.fullmoveNumber = movingColor === "black" ? nextState.fullmoveNumber + 1 : nextState.fullmoveNumber;
        nextState.moveHistory = [...nextState.moveHistory, this.#buildMoveRecord(previousState, move)];

        const syncedState = this.#syncDerivedState(nextState);
        return this.#pushHistory(this.#annotateLastMove(previousState, move, syncedState));
    }

    isPromotionMove(gameState, fromSquare, toSquare) {
        const normalizedState = this.hydrateGameState(gameState);
        const movingPiece = this.getPieceAt(normalizedState, fromSquare);

        if (!movingPiece || movingPiece.type !== "P") {
            return false;
        }

        if (!this.getLegalMoves(normalizedState, fromSquare).includes(toSquare)) {
            return false;
        }

        const { row } = parseSquare(toSquare);
        return row === 0 || row === BOARD_SIZE - 1;
    }

    claimDraw(gameState, reason) {
        const normalizedState = this.hydrateGameState(gameState);

        if (!normalizedState.claimableDraws.includes(reason)) {
            throw new Error(`Draw reason is not currently claimable: ${reason}`);
        }

        const nextState = this.#cloneGameState(normalizedState);
        nextState.status = "draw";
        nextState.winner = null;
        nextState.drawReason = reason;
        nextState.claimableDraws = [];
        nextState.selectedSquare = null;
        nextState.legalTargets = [];

        return this.#pushHistory(this.#syncClaimedDrawState(nextState));
    }

    resetGame(positionInput = this.classicPositionId) {
        return this.createGame(positionInput);
    }

    undo(gameState) {
        const normalizedState = this.hydrateGameState(gameState);

        if (!normalizedState.canUndo) {
            throw new Error("There is no earlier state to restore.");
        }

        return this.#restoreHistoryState(normalizedState, normalizedState.historyIndex - 1);
    }

    redo(gameState) {
        const normalizedState = this.hydrateGameState(gameState);

        if (!normalizedState.canRedo) {
            throw new Error("There is no later state to restore.");
        }

        return this.#restoreHistoryState(normalizedState, normalizedState.historyIndex + 1);
    }

    canUndo(gameState) {
        return this.hydrateGameState(gameState).canUndo;
    }

    canRedo(gameState) {
        return this.hydrateGameState(gameState).canRedo;
    }

    goToHistoryIndex(gameState, historyIndex) {
        const normalizedState = this.#syncVariationState(this.hydrateGameState(gameState));

        if (!Number.isInteger(historyIndex)) {
            throw new Error("History index must be an integer.");
        }

        if (historyIndex < 0 || historyIndex >= normalizedState.stateHistory.length) {
            throw new Error(`History index out of range: ${historyIndex}`);
        }

        return this.#restoreHistoryState(normalizedState, historyIndex);
    }

    getHistoryLength(gameState) {
        return this.#syncVariationState(this.hydrateGameState(gameState)).stateHistory.length;
    }

    forkFromHistoryIndex(gameState, historyIndex) {
        const normalizedState = this.goToHistoryIndex(gameState, historyIndex);
        const trimmedLineNodeIds = normalizedState.lineNodeIds.slice(0, historyIndex + 1);
        return this.#attachVariationState(normalizedState, normalizedState.variationGraph, trimmedLineNodeIds, historyIndex);
    }

    getVariationInfo(gameState) {
        const normalizedState = this.#syncVariationState(this.hydrateGameState(gameState));
        const currentNode = normalizedState.variationGraph?.nodes?.[normalizedState.currentNodeId] ?? null;
        return {
            currentNodeId: normalizedState.currentNodeId,
            lineNodeIds: [...normalizedState.lineNodeIds],
            historyIndex: normalizedState.historyIndex,
            isMainLine: normalizedState.lineNodeIds.every((nodeId, index) => {
                if (index === 0) {
                    return true;
                }

                const parentNode = normalizedState.variationGraph.nodes[normalizedState.lineNodeIds[index - 1]];
                return parentNode?.preferredChildId === nodeId;
            }),
            branchPointIndex: normalizedState.lineNodeIds.findIndex((nodeId, index) => {
                if (index === 0) {
                    return false;
                }

                const parentNode = normalizedState.variationGraph.nodes[normalizedState.lineNodeIds[index - 1]];
                return parentNode?.preferredChildId !== nodeId;
            }),
            childVariationCount: currentNode?.children?.length ?? 0
        };
    }

    getVariationLogInfo(gameState) {
        const normalizedState = this.#syncVariationState(this.hydrateGameState(gameState));
        const variationInfo = this.getVariationInfo(normalizedState);
        const branchPointIndex = variationInfo.branchPointIndex;

        return normalizedState.lineNodeIds.map((nodeId, index) => {
            const node = normalizedState.variationGraph.nodes[nodeId];
            const parentNode = index > 0
                ? normalizedState.variationGraph.nodes[normalizedState.lineNodeIds[index - 1]]
                : null;

            return {
                ply: index,
                nodeId,
                hasSiblingBranches: Boolean(parentNode && parentNode.children.length > 1),
                isSideLine: branchPointIndex !== -1 && index >= branchPointIndex,
                isPreferredChild: Boolean(!parentNode || parentNode.preferredChildId === nodeId),
                childVariationCount: node?.children?.length ?? 0
            };
        });
    }

    #restoreHistoryState(gameState, historyIndex) {
        const snapshot = gameState.stateHistory[historyIndex];

        if (!snapshot) {
            throw new Error(`History state does not exist at index ${historyIndex}.`);
        }

        const restoredState = this.#syncDerivedState(this.#cloneGameState(snapshot));
        return this.#attachVariationState(restoredState, gameState.variationGraph, gameState.lineNodeIds, historyIndex);
    }

    #syncVariationState(gameState) {
        if (!gameState.variationGraph || !Array.isArray(gameState.lineNodeIds) || gameState.lineNodeIds.length === 0) {
            return gameState;
        }

        const normalizedLineNodeIds = gameState.lineNodeIds.filter((nodeId) => gameState.variationGraph.nodes?.[nodeId]);
        const fallbackLineNodeIds = normalizedLineNodeIds.length > 0
            ? normalizedLineNodeIds
            : [gameState.variationGraph.rootId];

        return this.#attachVariationState(gameState, gameState.variationGraph, fallbackLineNodeIds, gameState.historyIndex);
    }

    #seedHistory(gameState) {
        const snapshot = this.#createHistorySnapshot(gameState);
        const rootNodeId = "n0";
        const variationGraph = {
            rootId: rootNodeId,
            nextNodeId: 1,
            nodes: {
                [rootNodeId]: {
                    id: rootNodeId,
                    parentId: null,
                    children: [],
                    preferredChildId: null,
                    move: null,
                    snapshot
                }
            }
        };

        return this.#attachVariationState(gameState, variationGraph, [rootNodeId], 0);
    }

    #pushHistory(gameState) {
        const variationGraph = cloneVariationGraph(gameState.variationGraph);
        const lineNodeIds = Array.isArray(gameState.lineNodeIds) ? [...gameState.lineNodeIds] : [];
        const historyIndex = Number.isInteger(gameState.historyIndex) ? gameState.historyIndex : lineNodeIds.length - 1;
        const currentNodeId = lineNodeIds[historyIndex];
        const currentNode = variationGraph?.nodes?.[currentNodeId];

        if (!variationGraph || !currentNodeId || !currentNode) {
            return this.#seedHistory(gameState);
        }

        const newNodeId = `n${variationGraph.nextNodeId}`;
        variationGraph.nextNodeId += 1;

        variationGraph.nodes[newNodeId] = {
            id: newNodeId,
            parentId: currentNodeId,
            children: [],
            preferredChildId: null,
            move: gameState.moveHistory.at(-1) ? { ...gameState.moveHistory.at(-1) } : null,
            snapshot: this.#createHistorySnapshot(gameState)
        };

        currentNode.children = [...currentNode.children, newNodeId];
        if (!currentNode.preferredChildId) {
            currentNode.preferredChildId = newNodeId;
        }

        const nextLineNodeIds = [...lineNodeIds.slice(0, historyIndex + 1), newNodeId];
        return this.#attachVariationState(gameState, variationGraph, nextLineNodeIds, nextLineNodeIds.length - 1);
    }

    #attachHistory(gameState, stateHistory, historyIndex) {
        const normalizedState = this.#cloneGameState(gameState);
        const rootNodeId = "n0";
        const variationGraph = {
            rootId: rootNodeId,
            nextNodeId: stateHistory.length,
            nodes: {}
        };

        stateHistory.forEach((snapshot, index) => {
            const nodeId = `n${index}`;
            const parentId = index === 0 ? null : `n${index - 1}`;
            const nextNodeId = index < stateHistory.length - 1 ? `n${index + 1}` : null;
            variationGraph.nodes[nodeId] = {
                id: nodeId,
                parentId,
                children: nextNodeId ? [nextNodeId] : [],
                preferredChildId: nextNodeId,
                move: index === 0 ? null : (normalizedState.moveHistory[index - 1] ? { ...normalizedState.moveHistory[index - 1] } : null),
                snapshot: this.#cloneHistorySnapshot(snapshot)
            };
        });

        const lineNodeIds = stateHistory.map((_, index) => `n${index}`);
        return this.#attachVariationState(normalizedState, variationGraph, lineNodeIds, historyIndex);
    }

    #attachVariationState(gameState, variationGraph, lineNodeIds, historyIndex) {
        const clonedState = this.#cloneGameState(gameState);
        const clonedVariationGraph = cloneVariationGraph(variationGraph);
        const normalizedLineNodeIds = Array.isArray(lineNodeIds) ? [...lineNodeIds] : [];
        const normalizedIndex = Math.max(0, Math.min(historyIndex, normalizedLineNodeIds.length - 1));
        const stateHistory = normalizedLineNodeIds.map((nodeId) => (
            clonedVariationGraph.nodes[nodeId]?.snapshot
                ? this.#cloneHistorySnapshot(clonedVariationGraph.nodes[nodeId].snapshot)
                : this.#createHistorySnapshot(clonedState)
        ));

        return {
            ...clonedState,
            variationGraph: clonedVariationGraph,
            lineNodeIds: normalizedLineNodeIds,
            currentNodeId: normalizedLineNodeIds[normalizedIndex] ?? clonedVariationGraph.rootId,
            stateHistory,
            historyIndex: normalizedIndex,
            canUndo: normalizedIndex > 0,
            canRedo: normalizedIndex < stateHistory.length - 1
        };
    }

    #createHistorySnapshot(gameState) {
        return this.#cloneHistorySnapshot(gameState);
    }

    #cloneHistorySnapshot(gameState) {
        const clonedState = this.#cloneGameState(gameState);

        delete clonedState.stateHistory;
        delete clonedState.historyIndex;
        delete clonedState.lineNodeIds;
        delete clonedState.currentNodeId;
        delete clonedState.variationGraph;
        delete clonedState.canUndo;
        delete clonedState.canRedo;

        return JSON.parse(JSON.stringify(clonedState));
    }

    #syncDerivedState(gameState) {
        const nextState = {
            ...gameState,
            backRank: cloneBackRank(gameState.backRank),
            board: cloneBoard(gameState.board),
            moveHistory: gameState.moveHistory.map((move) => ({ ...move })),
            legalTargets: [...gameState.legalTargets],
            positionHistory: Array.isArray(gameState.positionHistory) ? [...gameState.positionHistory] : [],
            drawReason: gameState.drawReason ?? null,
            claimableDraws: Array.isArray(gameState.claimableDraws) ? [...gameState.claimableDraws] : [],
            setupFEN: typeof gameState.setupFEN === "string" ? gameState.setupFEN : null,
            stateHistory: Array.isArray(gameState.stateHistory) ? gameState.stateHistory.map((snapshot) => this.#cloneHistorySnapshot(snapshot)) : [],
            historyIndex: Number.isInteger(gameState.historyIndex) ? gameState.historyIndex : 0,
            lineNodeIds: Array.isArray(gameState.lineNodeIds) ? [...gameState.lineNodeIds] : [],
            currentNodeId: gameState.currentNodeId ?? null,
            variationGraph: gameState.variationGraph ? cloneVariationGraph(gameState.variationGraph) : null,
            castlingConfig: cloneCastlingConfig(gameState.castlingConfig),
            castlingRights: cloneCastlingRights(gameState.castlingRights)
        };
        const persistedDrawReason = nextState.drawReason;
        const shouldPreserveClaimedDraw = nextState.status === "draw"
            && CLAIMABLE_DRAW_REASONS.includes(persistedDrawReason);

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

        const currentPositionKey = this.#getRepetitionKey(nextState);

        if (nextState.positionHistory.length === 0) {
            nextState.positionHistory = [currentPositionKey];
        } else if (nextState.positionHistory.length === nextState.moveHistory.length) {
            nextState.positionHistory = [...nextState.positionHistory, currentPositionKey];
        } else if (nextState.positionHistory.length !== nextState.moveHistory.length + 1) {
            nextState.positionHistory = [currentPositionKey];
        }

        const repetitionCount = nextState.positionHistory.filter((key) => key === currentPositionKey).length;
        const automaticDrawReason = this.#getAutomaticDrawReason(nextState, repetitionCount);
        const claimableDraws = this.#getClaimableDraws(nextState, repetitionCount);

        const sideToMove = nextState.activeColor;
        const kingInCheck = this.isKingInCheck(nextState, sideToMove);
        const hasMove = this.#hasAnyLegalMove(nextState, sideToMove);

        nextState.isCheck = kingInCheck;
        nextState.drawReason = null;
        nextState.claimableDraws = claimableDraws;

        if (shouldPreserveClaimedDraw && claimableDraws.includes(persistedDrawReason)) {
            nextState.status = "draw";
            nextState.winner = null;
            nextState.drawReason = persistedDrawReason;
            nextState.claimableDraws = [];
        } else if (!hasMove && kingInCheck) {
            nextState.status = "checkmate";
            nextState.winner = otherColor(sideToMove);
        } else if (!hasMove) {
            nextState.status = "stalemate";
            nextState.winner = null;
        } else if (automaticDrawReason) {
            nextState.status = "draw";
            nextState.winner = null;
            nextState.drawReason = automaticDrawReason;
        } else if (kingInCheck) {
            nextState.status = "check";
            nextState.winner = null;
        } else {
            nextState.status = nextState.moveHistory.length === 0 ? "ready" : "active";
            nextState.winner = null;
        }

        return nextState;
    }

    #syncClaimedDrawState(gameState) {
        return {
            ...gameState,
            backRank: cloneBackRank(gameState.backRank),
            board: cloneBoard(gameState.board),
            moveHistory: gameState.moveHistory.map((move) => ({ ...move })),
            legalTargets: [],
            selectedSquare: null,
            positionHistory: Array.isArray(gameState.positionHistory) ? [...gameState.positionHistory] : [],
            drawReason: gameState.drawReason ?? null,
            claimableDraws: [],
            setupFEN: typeof gameState.setupFEN === "string" ? gameState.setupFEN : null,
            stateHistory: Array.isArray(gameState.stateHistory) ? gameState.stateHistory.map((snapshot) => this.#cloneHistorySnapshot(snapshot)) : [],
            historyIndex: Number.isInteger(gameState.historyIndex) ? gameState.historyIndex : 0,
            lineNodeIds: Array.isArray(gameState.lineNodeIds) ? [...gameState.lineNodeIds] : [],
            currentNodeId: gameState.currentNodeId ?? null,
            variationGraph: gameState.variationGraph ? cloneVariationGraph(gameState.variationGraph) : null,
            castlingConfig: cloneCastlingConfig(gameState.castlingConfig),
            castlingRights: cloneCastlingRights(gameState.castlingRights),
            canUndo: Number.isInteger(gameState.historyIndex) ? gameState.historyIndex > 0 : false,
            canRedo: false
        };
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
        const normalizedPromotion = this.#normalizePromotionPiece(promotion);
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
            nextPiece.type = normalizedPromotion;
            moveContext.promotion = normalizedPromotion;
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
            san: null,
            pgn: null,
            longAlgebraic: notation,
            positionKeyAfter: null,
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

    #normalizePromotionPiece(promotion) {
        if (typeof promotion !== "string") {
            throw new Error("Promotion piece must be a string.");
        }

        const normalizedPromotion = promotion.trim().toUpperCase();

        if (!PROMOTION_PIECES.includes(normalizedPromotion)) {
            throw new Error(`Promotion piece must be one of: ${PROMOTION_PIECES.join(", ")}.`);
        }

        return normalizedPromotion;
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
