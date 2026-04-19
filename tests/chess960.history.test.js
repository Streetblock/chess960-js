import assert from "node:assert/strict";

import Chess960 from "../src/chess960.js";

export default [
    {
        name: "seeds undo redo history for a new game",
        run() {
            const engine = new Chess960();
            const game = engine.createGame(518);

            assert.equal(game.stateHistory.length, 1);
            assert.equal(game.historyIndex, 0);
            assert.equal(game.canUndo, false);
            assert.equal(game.canRedo, false);
        }
    },
    {
        name: "undo and redo restore earlier board states",
        run() {
            const engine = new Chess960();
            let game = engine.createGame(518);

            game = engine.movePiece(game, "e2", "e4");
            game = engine.movePiece(game, "e7", "e5");

            const afterTwoMovesFen = engine.exportFEN(game);

            game = engine.undo(game);
            assert.equal(engine.exportFEN(game), "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b HAha e3 0 1");
            assert.equal(game.canUndo, true);
            assert.equal(game.canRedo, true);

            game = engine.redo(game);
            assert.equal(engine.exportFEN(game), afterTwoMovesFen);
            assert.equal(game.canRedo, false);
        }
    },
    {
        name: "drops redo branch after a new move",
        run() {
            const engine = new Chess960();
            let game = engine.createGame(518);

            game = engine.movePiece(game, "e2", "e4");
            game = engine.movePiece(game, "e7", "e5");
            game = engine.undo(game);
            game = engine.movePiece(game, "c7", "c5");

            assert.equal(game.canRedo, false);
            assert.equal(engine.exportFEN(game), "rnbqkbnr/pp1ppppp/8/2p5/4P3/8/PPPP1PPP/RNBQKBNR w HAha c6 0 2");
        }
    },
    {
        name: "persists undo redo history through serialization",
        run() {
            const engine = new Chess960();
            let game = engine.createGame(518);

            game = engine.movePiece(game, "g1", "f3");
            game = engine.movePiece(game, "g8", "f6");

            const serialized = engine.serializeGameState(game);
            const restored = engine.hydrateGameState(serialized);
            const undone = engine.undo(restored);

            assert.equal(restored.canUndo, true);
            assert.equal(restored.canRedo, false);
            assert.equal(undone.activeColor, "black");
            assert.equal(engine.getPieceAt(undone, "f6"), null);
            assert.equal(engine.getPieceAt(undone, "g8")?.type, "N");
        }
    },
    {
        name: "starts a fresh undo redo chain from imported FEN states",
        run() {
            const engine = new Chess960();
            let game = engine.importFEN("4k3/8/8/8/8/8/4P3/4K3 w - - 0 1", {
                backRank: ["R", "N", "B", "Q", "K", "B", "N", "R"]
            });

            game = engine.movePiece(game, "e2", "e4");

            const undone = engine.undo(game);
            const redone = engine.redo(undone);

            assert.equal(undone.historyIndex, 0);
            assert.equal(engine.exportFEN(undone), "4k3/8/8/8/8/8/4P3/4K3 w - - 0 1");
            assert.equal(engine.exportFEN(redone), engine.exportFEN(game));
        }
    },
    {
        name: "jumps to arbitrary history index",
        run() {
            const engine = new Chess960();
            let game = engine.createGame(518);

            game = engine.movePiece(game, "e2", "e4");
            game = engine.movePiece(game, "e7", "e5");
            game = engine.movePiece(game, "g1", "f3");

            const jumped = engine.goToHistoryIndex(game, 2);

            assert.equal(jumped.historyIndex, 2);
            assert.equal(engine.exportFEN(jumped), "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w HAha e6 0 2");
            assert.equal(engine.getHistoryLength(jumped), 4);
            assert.equal(jumped.canUndo, true);
            assert.equal(jumped.canRedo, true);
        }
    },
    {
        name: "rejects invalid history indices",
        run() {
            const engine = new Chess960();
            const game = engine.createGame(518);

            assert.throws(() => engine.goToHistoryIndex(game, -1), /History index out of range/);
            assert.throws(() => engine.goToHistoryIndex(game, 2), /History index out of range/);
            assert.throws(() => engine.goToHistoryIndex(game, 0.5), /History index must be an integer/);
        }
    }
];
