import assert from "node:assert/strict";

import Chess960 from "../src/chess960.js";

export default [
    {
        name: "marks threefold repetition as claimable draw",
        run() {
            const engine = new Chess960();
            let game = engine.createGame(518);

            for (let index = 0; index < 2; index += 1) {
                game = engine.movePiece(game, "g1", "f3");
                game = engine.movePiece(game, "g8", "f6");
                game = engine.movePiece(game, "f3", "g1");
                game = engine.movePiece(game, "f6", "g8");
            }

            assert.equal(game.status, "active");
            assert.ok(game.claimableDraws.includes("threefoldRepetition"));
        }
    },
    {
        name: "marks fivefold repetition as automatic draw",
        run() {
            const engine = new Chess960();
            let game = engine.createGame(518);

            for (let index = 0; index < 4; index += 1) {
                game = engine.movePiece(game, "g1", "f3");
                game = engine.movePiece(game, "g8", "f6");
                game = engine.movePiece(game, "f3", "g1");
                game = engine.movePiece(game, "f6", "g8");
            }

            assert.equal(game.status, "draw");
            assert.equal(game.drawReason, "fivefoldRepetition");
        }
    },
    {
        name: "marks fifty move rule as claimable draw", 
        run() {
            const engine = new Chess960();
            const game = engine.importFEN("4k3/8/8/8/8/8/8/R3K2R w HA - 100 1", {
                backRank: ["R", "N", "B", "Q", "K", "B", "N", "R"]
            });

            assert.ok(game.claimableDraws.includes("fiftyMoveRule"));
            assert.equal(game.status, "ready");
        }
    },
    {
        name: "marks seventy five move rule as automatic draw",
        run() {
            const engine = new Chess960();
            const game = engine.importFEN("4k3/8/8/8/8/8/8/R3K2R w HA - 150 1", {
                backRank: ["R", "N", "B", "Q", "K", "B", "N", "R"]
            });

            assert.equal(game.status, "draw");
            assert.equal(game.drawReason, "seventyFiveMoveRule");
        }
    },
    {
        name: "detects insufficient material", 
        run() {
            const engine = new Chess960();
            const game = engine.importFEN("4k3/8/8/8/8/8/8/4K3 w - - 0 1", {
                backRank: ["R", "N", "B", "Q", "K", "B", "N", "R"]
            });

            assert.equal(game.status, "draw");
            assert.equal(game.drawReason, "insufficientMaterial");
        }
    }
];
