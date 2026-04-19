import assert from "node:assert/strict";

import Chess960 from "../src/chess960.js";

export default [
    {
        name: "generates 960 unique Chess960 positions",
        run() {
            const engine = new Chess960();
            const positions = engine.generateAll();
            const uniqueBackRanks = new Set(positions.map((entry) => entry.backRank.join("")));

            assert.equal(positions.length, 960);
            assert.equal(uniqueBackRanks.size, 960);
        }
    },
    {
        name: "roundtrips Chess960 id and back rank",
        run() {
            const engine = new Chess960();
            const sampleIds = [0, 3, 181, 518, 959];

            sampleIds.forEach((id) => {
                const backRank = engine.generate(id);

                assert.equal(engine.getIdFromPosition(backRank), id);
                assert.equal(engine.isValidBackRank(backRank), true);
            });
        }
    },
    {
        name: "creates a valid classical game state",
        run() {
            const engine = new Chess960();
            const game = engine.createGame(518);

            assert.equal(game.positionId, 518);
            assert.equal(game.activeColor, "white");
            assert.equal(game.status, "ready");
            assert.equal(game.board[7][4]?.type, "K");
            assert.equal(game.board[0][4]?.type, "K");
        }
    }
];
