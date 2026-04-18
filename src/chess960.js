const BACK_RANK_SIZE = 8;
const CHESS960_POSITION_COUNT = 960;
const CLASSIC_POSITION_ID = 518;
const STARTING_PAWN_RANK = {
    white: 6,
    black: 1
};
const STARTING_BACK_RANK = {
    white: 7,
    black: 0
};
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

function cloneBackRank(backRank) {
    return [...backRank];
}

function createPiece(type, color, fileIndex, rankIndex) {
    return {
        id: `${color}-${type}-${fileIndex}-${rankIndex}`,
        type,
        color,
        file: FILES[fileIndex],
        rank: 8 - rankIndex,
        square: `${FILES[fileIndex]}${8 - rankIndex}`,
        fileIndex,
        rankIndex,
        hasMoved: false
    };
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

        const row = new Array(BACK_RANK_SIZE).fill(null);
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

        const lightBishopIdx = normalizedBackRank.findIndex((piece, index) => piece === "B" && index % 2 === 1);
        const darkBishopIdx = normalizedBackRank.findIndex((piece, index) => piece === "B" && index % 2 === 0);
        const lightBishopFactor = (lightBishopIdx - 1) / 2;
        const darkBishopFactor = darkBishopIdx / 2;

        const rowWithoutBishops = normalizedBackRank.filter((_, index) => index !== lightBishopIdx && index !== darkBishopIdx);
        const queenFactor = rowWithoutBishops.indexOf("Q");

        const rowWithoutQueen = rowWithoutBishops.filter((piece) => piece !== "Q");
        const knightIndices = [];

        rowWithoutQueen.forEach((piece, index) => {
            if (piece === "N") {
                knightIndices.push(index);
            }
        });

        const knightFactor = this.knightMapping.findIndex((pair) =>
            pair[0] === knightIndices[0] && pair[1] === knightIndices[1]
        );

        return (knightFactor * 96) + (queenFactor * 16) + (darkBishopFactor * 4) + lightBishopFactor;
    }

    isValidBackRank(backRank) {
        const normalizedBackRank = this.#normalizeBackRank(backRank, false);

        if (!normalizedBackRank || normalizedBackRank.length !== BACK_RANK_SIZE) {
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

        const firstRookIndex = normalizedBackRank.indexOf("R");
        const lastRookIndex = normalizedBackRank.lastIndexOf("R");
        const kingIndex = normalizedBackRank.indexOf("K");

        if (kingIndex < firstRookIndex || kingIndex > lastRookIndex) {
            return false;
        }

        const bishopIndices = normalizedBackRank
            .map((piece, index) => piece === "B" ? index : -1)
            .filter((index) => index !== -1);

        return bishopIndices[0] % 2 !== bishopIndices[1] % 2;
    }

    createStartingBoard(positionInput = this.classicPositionId) {
        const backRank = this.#resolveBackRank(positionInput);
        const board = Array.from({ length: BACK_RANK_SIZE }, () => Array(BACK_RANK_SIZE).fill(null));

        backRank.forEach((piece, fileIndex) => {
            board[STARTING_BACK_RANK.black][fileIndex] = createPiece(piece, "black", fileIndex, STARTING_BACK_RANK.black);
            board[STARTING_BACK_RANK.white][fileIndex] = createPiece(piece, "white", fileIndex, STARTING_BACK_RANK.white);
            board[STARTING_PAWN_RANK.black][fileIndex] = createPiece("P", "black", fileIndex, STARTING_PAWN_RANK.black);
            board[STARTING_PAWN_RANK.white][fileIndex] = createPiece("P", "white", fileIndex, STARTING_PAWN_RANK.white);
        });

        return {
            positionId: this.getIdFromPosition(backRank),
            backRank: cloneBackRank(backRank),
            board,
            activeColor: "white",
            moveHistory: [],
            selectedSquare: null
        };
    }

    serializeBoardState(boardState) {
        return JSON.parse(JSON.stringify(boardState));
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
