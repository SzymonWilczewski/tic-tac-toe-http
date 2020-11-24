const express = require("express");
const cors = require("cors");
const shortid = require("shortid");
const Redux = require("redux");
const axios = require("axios");

const app = express();
const port = 3000;

app.use(express.json());
app.use(cors());

const games = (state = [], action) => {
  switch (action.type) {
    case "ADD_GAME": {
      return [...state, action.payload.game];
    }
    case "UPDATE": {
      const id = state.findIndex((game) => game.id === action.payload.game.id);
      return [
        ...state.slice(0, id),
        action.payload.game,
        ...state.slice(id + 1),
      ];
    }
    default:
      return state;
  }
};

const store = Redux.createStore(games);

const newGameSchema = (id) => ({
  id: id,
  status: "Game in progress",
  boardByKey: {
    0: 2,
    1: 7,
    2: 6,
    3: 9,
    4: 5,
    5: 1,
    6: 4,
    7: 3,
    8: 8,
  },
  boardByValue: {
    2: 0,
    7: 1,
    6: 2,
    9: 3,
    5: 4,
    1: 5,
    4: 6,
    3: 7,
    8: 8,
  },
  boardAllowedMoveByKey: {
    0: true,
    1: true,
    2: true,
    3: true,
    4: true,
    5: true,
    6: true,
    7: true,
    8: true,
  },
  boardAllowedMoveByValue: {
    2: true,
    7: true,
    6: true,
    9: true,
    5: true,
    1: true,
    4: true,
    3: true,
    8: true,
  },
  serverMoves: [],
  clientMoves: [],
  serverStarts: false,
});

const addGame = (id) => {
  store.dispatch({ type: "ADD_GAME", payload: { game: newGameSchema(id) } });
};

const gameOver = (game) => {
  if (game.status === "Draw!" || game.status === "Server won!") {
    return true;
  } else if (!Object.values(game.boardAllowedMoveByKey).includes(true)) {
    game.status = "Draw!";
    return true;
  } else {
    return false;
  }
};

const update = (game, key, value, whoseMoves = "serverMoves") => ({
  ...game,
  boardAllowedMoveByKey: {
    ...game.boardAllowedMoveByKey,
    [key]: false,
  },
  boardAllowedMoveByValue: {
    ...game.boardAllowedMoveByValue,
    [value]: false,
  },
  [whoseMoves]: [...game[whoseMoves], value],
});

const dispatchUpdate = (game, key, value) => {
  game.boardAllowedMoveByKey[key] = false;
  game.boardAllowedMoveByValue[value] = false;
  game.serverMoves = [...game.serverMoves, value];

  store.dispatch({ type: "UPDATE", payload: { game: game } });
};

const adjacentCorner = (game) => {
  const firstMove = game.boardByValue[game.serverMoves[0]];

  const firstOption =
    Math.abs(Math.floor(firstMove / 3) - 2) * 3 + Math.abs(firstMove % 3);
  const firstOptionFirstCondition =
    Math.abs(Math.floor(firstMove / 3) - 1) * 3 + Math.abs(firstMove % 3);
  const firstOptionSecondCondition =
    Math.abs(Math.floor(firstMove / 3) - 2) * 3 + Math.abs((firstMove % 3) - 1);
  const secondOption =
    Math.abs(Math.floor(firstMove / 3)) * 3 + Math.abs((firstMove % 3) - 2);

  game.boardAllowedMoveByKey[firstOption] &&
  game.boardAllowedMoveByKey[firstOptionFirstCondition] &&
  game.boardAllowedMoveByKey[firstOptionSecondCondition]
    ? dispatchUpdate(game, firstOption, game.boardByKey[firstOption])
    : dispatchUpdate(game, secondOption, game.boardByKey[secondOption]);
};

const oppositeCorner = (game) => {
  const firstMove = game.boardByValue[game.serverMoves[0]];
  const secondMove = game.boardByValue[game.serverMoves[1]];

  const firstOption =
    Math.abs(Math.floor(firstMove / 3) - 2) * 3 + Math.abs((firstMove % 3) - 2);
  const secondOption =
    Math.abs(Math.floor(secondMove / 3) - 2) * 3 +
    Math.abs((secondMove % 3) - 2);

  game.boardAllowedMoveByKey[firstOption]
    ? dispatchUpdate(game, firstOption, game.boardByKey[firstOption])
    : dispatchUpdate(game, secondOption, game.boardByKey[secondOption]);
};

const randomMove = (game) => {
  const prohibitedMoves = game.serverMoves.concat(game.clientMoves);
  const possibleMoves = Object.values(game.boardByKey).filter(
    (value) => !prohibitedMoves.includes(value)
  );
  const value = possibleMoves[Math.floor(Math.random() * possibleMoves.length)];

  dispatchUpdate(game, game.boardByValue[value], value);
};

const addServerMove = (game) => {
  if (game.serverStarts && game.clientMoves.length === 0) {
    const key = [0, 2, 6, 8][Math.floor(Math.random() * 4)];
    dispatchUpdate(game, key, game.boardByKey[key]);
  } else if (game.serverStarts && game.serverMoves.length === 1) {
    game.boardAllowedMoveByKey[4] ? adjacentCorner(game) : oppositeCorner(game);
  } else if (!game.serverStarts && game.boardAllowedMoveByKey[4]) {
    dispatchUpdate(game, 4, game.boardByKey[4]);
  } else if (!game.serverStarts && game.serverMoves.length === 1) {
    const key = [1, 3, 5, 7][Math.floor(Math.random() * 4)];
    dispatchUpdate(game, key, game.boardByKey[key]);
  } else {
    const winningMove = game.serverMoves
      .flatMap((x, i) => game.serverMoves.slice(i + 1).map((y) => 15 - (x + y)))
      .find((value) => game.boardAllowedMoveByValue[value]);
    const defensiveMove = game.clientMoves
      .flatMap((x, i) => game.clientMoves.slice(i + 1).map((y) => 15 - (x + y)))
      .find((value) => game.boardAllowedMoveByValue[value]);

    if (winningMove) {
      dispatchUpdate(game, game.boardByValue[winningMove], winningMove);
      game.status = "Server won!";
    } else if (defensiveMove) {
      dispatchUpdate(game, game.boardByValue[defensiveMove], defensiveMove);
    } else if (game.serverStarts && game.serverMoves.length === 2) {
      oppositeCorner(game);
    } else {
      randomMove(game);
    }
  }
};

// Endpoints

app.post("/newgame", (req, res) => {
  const id = shortid.generate();

  addGame(id);

  res.status(201).send({ id: id });
});

app.patch("/game/:id/serverstarts", (req, res) => {
  const id = req.params.id;
  const game = store.getState().find((game) => game.id === id);

  if (!game) {
    res.status(404).send("Game not found!");
  } else if (!game.serverStarts && game.clientMoves.length === 0) {
    game.serverStarts = true;
    addServerMove(game);

    res.status(200).send("OK");
  } else {
    res.status(400).send("Operation not allowed!");
  }
});

app.get("/game/:id", (req, res) => {
  const id = req.params.id;
  const game = store.getState().find((game) => game.id === id);

  if (!game) {
    res.status(404).send("Game not found!");
  } else {
    const matrixBoard = [
      ["", "", ""],
      ["", "", ""],
      ["", "", ""],
    ];

    game.serverMoves.map((move) => {
      const key = game.boardByValue[move];
      matrixBoard[Math.floor(key / 3)][key % 3] = "x";
    });
    game.clientMoves.map((move) => {
      const key = game.boardByValue[move];
      matrixBoard[Math.floor(key / 3)][key % 3] = "o";
    });

    res.send({
      matrixBoard: matrixBoard,
      game: game,
    });
  }
});

app.post("/game/:id/move", (req, res) => {
  const id = req.params.id;
  const move =
    req.body.move !== undefined
      ? Math.trunc(req.body.move)
      : Math.trunc(req.body.y) * 3 + Math.trunc(req.body.x);
  const game = store.getState().find((game) => game.id === id);

  if (!game) {
    res.status(404).send("Game not found!");
  } else if (move === undefined) {
    res.status(400).send("Move was not given!");
  } else if (game.boardAllowedMoveByKey[move]) {
    const key = move;
    const value = game.boardByKey[key];

    game.boardAllowedMoveByKey[key] = false;
    game.boardAllowedMoveByValue[value] = false;
    game.clientMoves = [...game.clientMoves, value];

    store.dispatch({ type: "UPDATE", payload: { game: game } });

    gameOver(game)
      ? res.status(200).send(game.status)
      : addServerMove(game) && gameOver(game)
      ? res.status(200).send(game.status)
      : res.status(200).send("OK");
  } else {
    res.status(400).send("Move not allowed!");
  }
});

app.put("/game/:id/move/:moveId", (req, res) => {
  const id = req.params.id;
  const moveId = Math.trunc(req.params.moveId);
  const newMove = req.body.move
    ? Math.trunc(req.body.move)
    : Math.trunc(req.body.y) * 3 + Math.trunc(req.body.x);
  const game = {
    old: store.getState().find((game) => game.id === id),
    new: newGameSchema(id),
  };
  const newMoves = {
    server: game.old.serverStarts
      ? game.old.serverMoves.slice(0, moveId + 1)
      : game.old.serverMoves.slice(0, moveId),
    client: game.old.clientMoves.slice(0, moveId),
  };

  if (!game.old) {
    res.status(404).send("Game not found!");
  } else if (
    newMoves.server.includes(game.new.boardByKey[newMove]) ||
    newMoves.client.includes(game.new.boardByKey[newMove])
  ) {
    res.status(400).send("Move not allowed!");
  } else {
    game.new.serverStarts = game.old.serverStarts;
    newMoves.server.map(
      (value) =>
        (game.new = update(
          game.new,
          game.new.boardByValue[value],
          value,
          "serverMoves"
        ))
    );
    newMoves.client[moveId] = game.new.boardByKey[newMove];
    newMoves.client.map(
      (value) =>
        (game.new = update(
          game.new,
          game.new.boardByValue[value],
          value,
          "clientMoves"
        ))
    );

    store.dispatch({ type: "UPDATE", payload: { game: game.new } });

    res.status(200).send("OK");
  }
});

app.delete("/game/:id/move/:moveId", (req, res) => {
  const id = req.params.id;
  const moveId = Math.trunc(req.params.moveId);
  const game = {
    old: store.getState().find((game) => game.id === id),
    new: newGameSchema(id),
  };
  const newMoves = {
    server: game.old.serverStarts
      ? game.old.serverMoves.slice(0, moveId + 1)
      : game.old.serverMoves.slice(0, moveId),
    client: game.old.clientMoves.slice(0, moveId),
  };

  if (!game.old) {
    res.status(404).send("Game not found!");
  } else {
    game.new.serverStarts = game.old.serverStarts;
    newMoves.server.map(
      (value) =>
        (game.new = update(
          game.new,
          game.new.boardByValue[value],
          value,
          "serverMoves"
        ))
    );
    newMoves.client.map(
      (value) =>
        (game.new = update(
          game.new,
          game.new.boardByValue[value],
          value,
          "clientMoves"
        ))
    );

    store.dispatch({ type: "UPDATE", payload: { game: game.new } });

    res.status(200).send("OK");
  }
});

// Client

const adjacentCornerClient = (game) => {
  const firstMove = game.boardByValue[game.clientMoves[0]];

  const firstOption =
    Math.abs(Math.floor(firstMove / 3) - 2) * 3 + Math.abs(firstMove % 3);
  const firstOptionFirstCondition =
    Math.abs(Math.floor(firstMove / 3) - 1) * 3 + Math.abs(firstMove % 3);
  const firstOptionSecondCondition =
    Math.abs(Math.floor(firstMove / 3) - 2) * 3 + Math.abs((firstMove % 3) - 1);
  const secondOption =
    Math.abs(Math.floor(firstMove / 3)) * 3 + Math.abs((firstMove % 3) - 2);

  return game.boardAllowedMoveByKey[firstOption] &&
    game.boardAllowedMoveByKey[firstOptionFirstCondition] &&
    game.boardAllowedMoveByKey[firstOptionSecondCondition]
    ? firstOption
    : secondOption;
};

const oppositeCornerClient = (game) => {
  const firstMove = game.boardByValue[game.clientMoves[0]];
  const secondMove = game.boardByValue[game.clientMoves[1]];

  const firstOption =
    Math.abs(Math.floor(firstMove / 3) - 2) * 3 + Math.abs((firstMove % 3) - 2);
  const secondOption =
    Math.abs(Math.floor(secondMove / 3) - 2) * 3 +
    Math.abs((secondMove % 3) - 2);

  return game.boardAllowedMoveByKey[firstOption] ? firstOption : secondOption;
};

const randomMoveClient = (game) => {
  const prohibitedMoves = game.serverMoves.concat(game.clientMoves);
  const possibleMoves = Object.values(game.boardByKey).filter(
    (value) => !prohibitedMoves.includes(value)
  );
  const value = possibleMoves[Math.floor(Math.random() * possibleMoves.length)];

  return value;
};

const addClientMove = (game) => {
  if (!game.serverStarts && game.clientMoves.length === 0) {
    return [0, 2, 6, 8][Math.floor(Math.random() * 4)];
  } else if (!game.serverStarts && game.clientMoves.length === 1) {
    return game.boardAllowedMoveByKey[4]
      ? adjacentCornerClient(game)
      : oppositeCornerClient(game);
  } else if (game.serverStarts && game.boardAllowedMoveByKey[4]) {
    return 4;
  } else if (game.serverStarts && game.clientMoves.length === 1) {
    return [1, 3, 5, 7][Math.floor(Math.random() * 4)];
  } else {
    const winningMove = game.clientMoves
      .flatMap((x, i) => game.clientMoves.slice(i + 1).map((y) => 15 - (x + y)))
      .find((value) => game.boardAllowedMoveByValue[value]);
    const defensiveMove = game.serverMoves
      .flatMap((x, i) => game.serverMoves.slice(i + 1).map((y) => 15 - (x + y)))
      .find((value) => game.boardAllowedMoveByValue[value]);

    if (winningMove) {
      return game.boardByValue[winningMove];
    } else if (defensiveMove) {
      return game.boardByValue[defensiveMove];
    } else if (!game.serverStarts && game.clientMoves.length === 2) {
      return oppositeCornerClient(game);
    } else {
      return randomMoveClient(game);
    }
  }
};

app.get("/playwith", async (req, res) => {
  const url = req.body.url;
  const serverStarts = String(req.body.serverstarts) == "true";

  const id = await axios
    .post(`${url}/newgame`)
    .then((res) => res.data.id)
    .catch((err) => err);

  if (serverStarts) {
    await axios.patch(`${url}/game/${id}/serverstarts`);
  }

  let game = await axios
    .get(`${url}/game/${id}`)
    .then((res) => res.data.game)
    .catch((err) => err);
  let move;

  for (i = 0; i < 5; i++) {
    if (gameOver(game)) {
      res.send(game.status);
      break;
    }

    move = await addClientMove(game);
    // console.log(game.clientMoves, game.serverMoves, move);
    await axios
      .post(`${url}/game/${id}/move`, {
        move: move,
      })
      .catch((err) => console.log(err.response.data));

    game = await axios
      .get(`${url}/game/${id}`)
      .then((res) => res.data.game)
      .catch((err) => err.response.data);

    if (gameOver(game)) {
      res.send(game.status);
      break;
    }
  }
});

app.listen(port, () =>
  console.log(`Tic Tac Toe app listening on port ${port}!`)
);
