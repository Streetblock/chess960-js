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
    },
    {
        name: "detects promotion moves and rejects unsupported promotion pieces",
        run() {
            const engine = new Chess960();
            const game = engine.importFEN("4k3/P7/8/8/8/8/8/4K3 w - - 0 1", {
                backRank: ["R", "N", "B", "Q", "K", "B", "N", "R"]
            });

            assert.equal(engine.isPromotionMove(game, "a7", "a8"), true);
            assert.equal(engine.isPromotionMove(game, "a7", "a6"), false);
            assert.throws(() => engine.movePiece(game, "a7", "a8", "K"), /Promotion piece must be one of/);
        }
    },
    {
        name: "detects stalemate after queen promotion and allows underpromotion to avoid it",
        run() {
            const engine = new Chess960();
            const game = engine.importFEN("8/1P6/k7/8/K7/8/8/8 w - - 0 1", {
                backRank: ["R", "N", "B", "Q", "K", "B", "N", "R"]
            });

            const queenPromotion = engine.movePiece(game, "b7", "b8", "Q");
            const rookPromotion = engine.movePiece(game, "b7", "b8", "R");

            assert.equal(queenPromotion.status, "stalemate");
            assert.equal(queenPromotion.winner, null);
            assert.equal(queenPromotion.moveHistory.at(-1)?.san, "b8=Q");

            assert.equal(rookPromotion.status, "active");
            assert.equal(rookPromotion.winner, null);
            assert.equal(rookPromotion.moveHistory.at(-1)?.san, "b8=R");
        }
    }
];
