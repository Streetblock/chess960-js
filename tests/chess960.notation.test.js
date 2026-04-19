import assert from "node:assert/strict";

import Chess960 from "../src/chess960.js";

export default [
    {
        name: "builds SAN for normal move, capture, en passant and mate",
        run() {
            const engine = new Chess960();

            let game = engine.createGame(518);
            game = engine.movePiece(game, "e2", "e4");
            game = engine.movePiece(game, "e7", "e5");
            game = engine.movePiece(game, "g1", "f3");
            game = engine.movePiece(game, "b8", "c6");
            game = engine.movePiece(game, "f1", "b5");
            game = engine.movePiece(game, "a7", "a6");
            game = engine.movePiece(game, "b5", "c6");

            assert.deepEqual(
                game.moveHistory.map((move) => move.san),
                ["e4", "e5", "Nf3", "Nc6", "Bb5", "a6", "Bxc6"]
            );

            let enPassantGame = engine.createGame(518);
            enPassantGame = engine.movePiece(enPassantGame, "e2", "e4");
            enPassantGame = engine.movePiece(enPassantGame, "a7", "a6");
            enPassantGame = engine.movePiece(enPassantGame, "e4", "e5");
            enPassantGame = engine.movePiece(enPassantGame, "d7", "d5");
            enPassantGame = engine.movePiece(enPassantGame, "e5", "d6");

            assert.equal(enPassantGame.moveHistory.at(-1)?.san, "exd6");

            let mateGame = engine.createGame(518);
            mateGame = engine.applySAN(mateGame, "f3");
            mateGame = engine.applySAN(mateGame, "e5");
            mateGame = engine.applySAN(mateGame, "g4");
            mateGame = engine.applySAN(mateGame, "Qh4#");

            assert.equal(mateGame.moveHistory.at(-1)?.san, "Qh4#");
        }
    },
    {
        name: "disambiguates SAN when two pieces can reach the same square",
        run() {
            const engine = new Chess960();
            const game = engine.importFEN("4k3/8/8/8/8/8/3N3N/4K3 w - - 0 1", {
                backRank: ["R", "N", "B", "Q", "K", "B", "N", "R"]
            });
            const afterMove = engine.movePiece(game, "d2", "f3");

            assert.equal(afterMove.moveHistory.at(-1)?.san, "Ndf3");
        }
    },
    {
        name: "builds SAN for promotion moves",
        run() {
            const engine = new Chess960();
            const game = engine.importFEN("1k6/P7/8/8/8/8/8/K7 w - - 0 1", {
                backRank: ["R", "N", "B", "Q", "K", "B", "N", "R"]
            });
            const afterMove = engine.movePiece(game, "a7", "a8", "N");

            assert.equal(afterMove.moveHistory.at(-1)?.san, "a8=N");
            assert.equal(engine.getPieceAt(afterMove, "a8")?.type, "N");
        }
    }
];
