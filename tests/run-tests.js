import coreTests from "./chess960.core.test.js";
import moveTests from "./chess960.moves.test.js";
import castlingTests from "./chess960.castling.test.js";
import notationTests from "./chess960.notation.test.js";
import fenPgnTests from "./chess960.fen-pgn.test.js";
import drawTests from "./chess960.draws.test.js";
import historyTests from "./chess960.history.test.js";

const suites = [
    ...coreTests,
    ...moveTests,
    ...castlingTests,
    ...notationTests,
    ...fenPgnTests
    ,
    ...drawTests,
    ...historyTests
];

let passed = 0;

for (const suite of suites) {
    try {
        await suite.run();
        passed += 1;
        console.log(`PASS ${suite.name}`);
    } catch (error) {
        console.error(`FAIL ${suite.name}`);
        console.error(error);
        process.exitCode = 1;
        break;
    }
}

if (!process.exitCode) {
    console.log(`\n${passed}/${suites.length} tests passed`);
}
