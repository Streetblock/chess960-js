import assert from "node:assert/strict";

import Chess960 from "../src/chess960.js";

export default [
    {
        name: "returns expected legal opening pawn moves",
        run() {
            const engine = new Chess960();
            const game = engine.createGame(518);

            assert.deepEqual(engine.getLegalMoves(game, "e2"), ["e3", "e4"]);
        }
    },
    {
        name: "applies en passant capture correctly",
        run() {
            const engine = new Chess960();
            let game = engine.createGame(518);

            game = engine.movePiece(game, "e2", "e4");
            game = engine.movePiece(game, "a7", "a6");
            game = engine.movePiece(game, "e4", "e5");
            game = engine.movePiece(game, "d7", "d5");

            assert.deepEqual(engine.getLegalMoves(game, "e5"), ["e6", "d6"]);

            game = engine.movePiece(game, "e5", "d6");

            assert.equal(engine.getPieceAt(game, "d6")?.type, "P");
            assert.equal(engine.getPieceAt(game, "d5"), null);
            assert.equal(game.enPassantTarget, null);
        }
    },
    {
        name: "detects checkmate in fools mate",
        run() {
            const engine = new Chess960();
            let game = engine.createGame(518);

            game = engine.movePiece(game, "f2", "f3");
            game = engine.movePiece(game, "e7", "e5");
            game = engine.movePiece(game, "g2", "g4");
            game = engine.movePiece(game, "d8", "h4");

            assert.equal(game.status, "checkmate");
            assert.equal(game.winner, "black");
            assert.equal(game.isCheck, true);
        }
    }
];
