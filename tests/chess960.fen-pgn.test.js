import assert from "node:assert/strict";

import Chess960 from "../src/chess960.js";

export default [
    {
        name: "roundtrips FEN including en passant target and clocks",
        run() {
            const engine = new Chess960();
            let game = engine.createGame(518);

            game = engine.movePiece(game, "e2", "e4");
            game = engine.movePiece(game, "e7", "e5");

            const fen = engine.exportFEN(game);
            const imported = engine.importFEN(fen, { backRank: game.backRank });

            assert.equal(engine.exportFEN(imported), fen);
            assert.equal(imported.fullmoveNumber, 2);
            assert.equal(imported.halfmoveClock, 0);
            assert.equal(imported.enPassantTarget, "e6");
        }
    },
    {
        name: "roundtrips PGN for a short classical sequence",
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

            const pgn = engine.exportPGN(game);
            const imported = engine.importPGN(pgn);

            assert.deepEqual(
                imported.gameState.moveHistory.map((move) => move.san),
                game.moveHistory.map((move) => move.san)
            );
            assert.equal(
                engine.exportFEN(imported.gameState),
                "r1bqkbnr/1ppp1ppp/p1B5/4p3/4P3/5N2/PPPP1PPP/RNBQK2R b HAha - 0 4"
            );
        }
    },
    {
        name: "imports Chess960 PGN with setup FEN header",
        run() {
            const engine = new Chess960();
            const initial = engine.createGame(3);
            const pgn = engine.exportPGN(initial);
            const imported = engine.importPGN(pgn, { positionId: 3 });

            assert.equal(engine.exportFEN(imported.gameState), engine.exportFEN(initial));
        }
    },
    {
        name: "roundtrips Chess960 castling through PGN import export",
        run() {
            const engine = new Chess960();
            let game = engine.createGame(3);

            game = engine.movePiece(game, "f1", "g1");

            const pgn = engine.exportPGN(game);
            const imported = engine.importPGN(pgn, { positionId: 3 });

            assert.deepEqual(
                imported.gameState.moveHistory.map((move) => move.san),
                ["O-O"]
            );
            assert.equal(engine.exportFEN(imported.gameState), engine.exportFEN(game));
        }
    },
    {
        name: "roundtrips promotion through PGN import export",
        run() {
            const engine = new Chess960();
            const setup = engine.importFEN("1k6/P7/8/8/8/8/8/K7 w - - 0 1", {
                backRank: ["R", "N", "B", "Q", "K", "B", "N", "R"]
            });
            const promoted = engine.movePiece(setup, "a7", "a8", "N");

            const pgn = engine.exportPGN(promoted);
            const imported = engine.importPGN(pgn, {
                backRank: setup.backRank
            });

            assert.equal(imported.gameState.moveHistory.at(-1)?.san, "a8=N");
            assert.equal(engine.getPieceAt(imported.gameState, "a8")?.type, "N");
            assert.equal(engine.exportFEN(imported.gameState), engine.exportFEN(promoted));
        }
    }
];
