# Chess960 Engine & UI

*Read this in [English](README.md)*

Abhaengigkeitsfreie Chess960-Bibliothek in plain ES Modules. Das Projekt besteht aus:

- einer wiederverwendbaren Engine in `src/chess960.js`
- einer Browser-UI in `app.js`
- einer Regression-Suite in `tests/`

Die Engine kann inzwischen deutlich mehr als nur Startaufstellungen erzeugen. Sie verwaltet komplette Chess960-Partien, erzeugt legale Zuege, liest und schreibt Notation, erkennt Remisfaelle und haelt Undo/Redo-Historie.

## Aktueller Umfang

- alle 960 legalen Chess960-Grundreihen erzeugen
- Grundreihe in Scharnagl-ID umrechnen und zurueck
- spielbare Game States erzeugen und hydrieren
- legale Zuege berechnen und ausfuehren
- Chess960-Rochade, En-passant, Promotion, Schach, Matt und Patt behandeln
- Remisregeln erkennen
- FEN exportieren und importieren
- SAN und PGN exportieren und importieren
- Zugverlauf und Undo/Redo-Snapshots verwalten
- State fuer `localStorage` oder andere Persistenz serialisieren

## Projektstruktur

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

## Engine verwenden

```js
import Chess960 from "./src/chess960.js";

const chess960 = new Chess960();
```

### Startaufstellungen

```js
const backRank = chess960.generate(518);
// ["R", "N", "B", "Q", "K", "B", "N", "R"]

const id = chess960.getIdFromPosition(backRank);
// 518

const allPositions = chess960.generateAll();
// [{ id, backRank }, ...] mit 960 Eintraegen
```

### Partie erzeugen

```js
const game = chess960.createGame(518);
// oder:
const customGame = chess960.createGame(["B", "N", "R", "K", "R", "Q", "N", "B"]);
```

`createGame(...)` akzeptiert:

- eine Chess960-ID
- ein gueltiges Grundreihen-Array

### Oeffentliche API

Die stabilen oeffentlichen Methoden sind:

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

## Typischer Ablauf

```js
let game = chess960.createGame(518);

game = chess960.movePiece(game, "e2", "e4");
game = chess960.movePiece(game, "e7", "e5");

console.log(game.moveHistory.at(-1).san);
// "e5"

game = chess960.undo(game);
game = chess960.redo(game);
```

Wenn du lieber klickbasierte UI-Interaktion willst:

```js
let game = chess960.createGame(518);

game = chess960.selectSquare(game, "e2");
console.log(game.legalTargets);
// ["e3", "e4"]

game = chess960.performInteraction(game, "e4");
```

## Aufbau des Game States

Die Engine liefert plain serialisierbare Objekte. Wichtige Felder sind:

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

### Statuswerte

- `ready`
- `active`
- `check`
- `checkmate`
- `stalemate`
- `draw`

### Remisgruende

Beanspruchbare Remisgruende:

- `threefoldRepetition`
- `fiftyMoveRule`

Automatische Remisgruende:

- `fivefoldRepetition`
- `seventyFiveMoveRule`
- `insufficientMaterial`

Beispiel:

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

Die Engine nutzt Chess960-faehige Rochaderechte. Bei importierten Mittelspiel-FENs solltest du `backRank` oder `positionId` mitgeben, wenn sich die urspruengliche Startaufstellung nicht sicher aus der Stellung ableiten laesst.

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

`exportPGN(...)` unterstuetzt benutzerdefinierte Header bereits ueber `options.headers`.

Import:

```js
const imported = chess960.importPGN(pgn, {
    backRank: game.backRank
});

console.log(imported.headers);
console.log(imported.gameState);
```

## Persistenz

Weil der Game State nur aus Daten besteht, kannst du ihn direkt speichern:

```js
const serialized = chess960.serializeGameState(game);
localStorage.setItem("chess960.game", JSON.stringify(serialized));

const restored = chess960.hydrateGameState(
    JSON.parse(localStorage.getItem("chess960.game"))
);
```

Undo/Redo-Historie ist Teil des serialisierten States.

## Tests

Die Regression-Suite startest du mit:

```bash
npm test
```

Abgedeckt sind aktuell:

- Chess960-ID- und Grundreihen-Roundtrips
- legale Zuege und En-passant
- Chess960-Rochade
- SAN und PGN
- FEN-Roundtrips
- Remiserkennung
- Undo/Redo-Historie

## UI-Hinweis

`app.js` ist bewusst nur die UI-/Controller-Schicht. Die eigentlichen Regeln und die Notationslogik liegen in `src/chess960.js`.

Die Hauptregel des Projekts bleibt:

- UI-Verwaltung in `app.js`
- Spiellogik in `src/chess960.js`
