# Chess960 Engine & UI

*Lese dies auf  [Deutsch](README_de.md)*

Zero-dependency Chess960 library in plain ES modules. The project contains:

- a reusable engine in `src/chess960.js`
- a browser UI in `app.js`
- a regression suite in `tests/`

The engine goes beyond start-position generation. It can play full Chess960 games, track legal moves, export and import notation, detect draws, and manage undo/redo history.

## Current Scope

- Generate all 960 legal Chess960 back ranks
- Convert back rank to Scharnagl id and back
- Create and hydrate playable game states
- Generate legal moves and execute moves
- Handle Chess960 castling, en passant, promotion, check, checkmate, and stalemate
- Detect draw rules
- Export and import FEN
- Export and import SAN and PGN
- Track move history and undo/redo snapshots
- Serialize state for `localStorage` or other persistence

## Project Structure

```text
├── src/
│   └── chess960.js
├── tests/
│   ├── chess960.core.test.js
│   ├── chess960.moves.test.js
│   ├── chess960.castling.test.js
│   ├── chess960.notation.test.js
│   ├── chess960.fen-pgn.test.js
│   ├── chess960.draws.test.js
│   ├── chess960.history.test.js
│   └── run-tests.js
├── app.js
├── index.html
├── style.css
├── README.md
└── README_de.md
```

## Engine Usage

```js
import Chess960 from "./src/chess960.js";

const chess960 = new Chess960();
```

### Start Positions

```js
const backRank = chess960.generate(518);
// ["R", "N", "B", "Q", "K", "B", "N", "R"]

const id = chess960.getIdFromPosition(backRank);
// 518

const allPositions = chess960.generateAll();
// [{ id, backRank }, ...] with 960 entries
```

### Create a Game

```js
const game = chess960.createGame(518);
// or:
const customGame = chess960.createGame(["B", "N", "R", "K", "R", "Q", "N", "B"]);
```

`createGame(...)` accepts either:

- a Chess960 id
- a valid back-rank array

### Main Public API

The stable public methods are:

- `generate(id)`
- `generateAll()`
- `getIdFromPosition(backRank)`
- `isValidBackRank(backRank)`
- `createGame(positionInput)`
- `hydrateGameState(rawState)`
- `serializeGameState(gameState)`
- `getPieceAt(gameState, square)`
- `getLegalMoves(gameState, fromSquare)`
- `selectSquare(gameState, square)`
- `performInteraction(gameState, square)`
- `movePiece(gameState, fromSquare, toSquare, promotion = "Q")`
- `claimDraw(gameState, reason)`
- `resetGame(positionInput)`
- `undo(gameState)`
- `redo(gameState)`
- `canUndo(gameState)`
- `canRedo(gameState)`
- `isKingInCheck(gameState, color)`
- `exportFEN(gameState, options)`
- `importFEN(fen, options)`
- `applySAN(gameState, sanMove)`
- `exportPGN(gameState, options)`
- `importPGN(pgn, options)`

## Typical Flow

```js
let game = chess960.createGame(518);

game = chess960.movePiece(game, "e2", "e4");
game = chess960.movePiece(game, "e7", "e5");

console.log(game.moveHistory.at(-1).san);
// "e5"

game = chess960.undo(game);
game = chess960.redo(game);
```

If you want click-based UI interaction instead of coordinate-driven moves:

```js
let game = chess960.createGame(518);

game = chess960.selectSquare(game, "e2");
console.log(game.legalTargets);
// ["e3", "e4"]

game = chess960.performInteraction(game, "e4");
```

## Game State Shape

The engine returns plain serializable objects. Important fields include:

- `positionId`
- `backRank`
- `board`
- `activeColor`
- `selectedSquare`
- `legalTargets`
- `moveHistory`
- `status`
- `winner`
- `isCheck`
- `enPassantTarget`
- `halfmoveClock`
- `fullmoveNumber`
- `positionHistory`
- `drawReason`
- `claimableDraws`
- `castlingConfig`
- `castlingRights`
- `stateHistory`
- `historyIndex`
- `canUndo`
- `canRedo`

### Status Values

- `ready`
- `active`
- `check`
- `checkmate`
- `stalemate`
- `draw`

### Draw Reasons

Claimable draw reasons:

- `threefoldRepetition`
- `fiftyMoveRule`

Automatic draw reasons:

- `fivefoldRepetition`
- `seventyFiveMoveRule`
- `insufficientMaterial`

Example:

```js
if (game.claimableDraws.includes("threefoldRepetition")) {
    game = chess960.claimDraw(game, "threefoldRepetition");
}
```

## Notation

### FEN

```js
const fen = chess960.exportFEN(game);
const restored = chess960.importFEN(fen, {
    backRank: game.backRank
});
```

The engine uses Chess960-aware castling rights. For imported middle-game FENs, pass `backRank` or `positionId` when the original setup cannot be inferred safely.

### SAN

```js
let game = chess960.createGame(518);
game = chess960.applySAN(game, "e4");
game = chess960.applySAN(game, "e5");
game = chess960.applySAN(game, "Nf3");
```

### PGN

```js
const pgn = chess960.exportPGN(game, {
    headers: {
        Event: "Casual Game",
        Site: "Berlin",
        Date: "2026.04.19",
        Round: "1",
        White: "Alice",
        Black: "Bob"
    }
});
```

`exportPGN(...)` already supports custom headers through `options.headers`.

Import:

```js
const imported = chess960.importPGN(pgn, {
    backRank: game.backRank
});

console.log(imported.headers);
console.log(imported.gameState);
```

## Persistence

Because the game state is plain data, you can store it directly:

```js
const serialized = chess960.serializeGameState(game);
localStorage.setItem("chess960.game", JSON.stringify(serialized));

const restored = chess960.hydrateGameState(
    JSON.parse(localStorage.getItem("chess960.game"))
);
```

Undo/redo history is part of the serialized state.

## Tests

Run the regression suite with:

```bash
npm test
```

The suite covers:

- Chess960 id and back-rank roundtrips
- legal moves and en passant
- Chess960 castling
- SAN and PGN
- FEN roundtrips
- draw detection
- undo/redo history

## UI Notes

`app.js` is intentionally the UI/controller layer. Core rules and notation handling live in `src/chess960.js`.

That separation is the main project rule:

- UI state and DOM handling in `app.js`
- chess logic in `src/chess960.js`
