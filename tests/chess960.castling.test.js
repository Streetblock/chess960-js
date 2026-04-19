import assert from "node:assert/strict";

import Chess960 from "../src/chess960.js";

export default [
    {
        name: "allows classical king side castling when legal",
        run() {
            const engine = new Chess960();
            let game = engine.createGame(518);

            game = engine.movePiece(game, "g1", "f3");
            game = engine.movePiece(game, "g8", "f6");
            game = engine.movePiece(game, "e2", "e4");
            game = engine.movePiece(game, "b8", "c6");
            game = engine.movePiece(game, "f1", "e2");
            game = engine.movePiece(game, "a7", "a6");

            assert.ok(engine.getLegalMoves(game, "e1").includes("g1"));

            game = engine.movePiece(game, "e1", "g1");

            assert.equal(engine.getPieceAt(game, "g1")?.type, "K");
            assert.equal(engine.getPieceAt(game, "f1")?.type, "R");
            assert.equal(game.moveHistory.at(-1)?.san, "O-O");
        }
    },
    {
        name: "allows Chess960 castling with rook starting on target-adjacent file",
        run() {
            const engine = new Chess960();
            const game = engine.createGame(3);
            const kingStart = game.castlingConfig.white.kingStart;

            assert.equal(kingStart, "f1");
            assert.ok(engine.getLegalMoves(game, kingStart).includes("g1"));

            const afterCastle = engine.movePiece(game, kingStart, "g1");

            assert.equal(engine.getPieceAt(afterCastle, "g1")?.type, "K");
            assert.equal(engine.getPieceAt(afterCastle, "f1")?.type, "R");
            assert.equal(afterCastle.moveHistory.at(-1)?.san, "O-O");
        }
    }
];
