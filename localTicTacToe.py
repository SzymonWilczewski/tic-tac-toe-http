import requests
from pandas import DataFrame


def game_over():
    game = requests.get(f"http://localhost:{port}/game/{id}").json()["game"]
    if game["status"] == "Server won!" or game["status"] == "Draw!":
        print_board()
        print(game["status"])
        return True
    return False


def print_board():
    board = requests.get(f"http://localhost:{port}/game/{id}").json()["matrixBoard"]
    print(f"Board:\n{DataFrame(board)}")


port = 3000
id = requests.post(f"http://localhost:{port}/newgame").json()["id"]
print("ID: " + id)

serverStarts = requests.patch(f"http://localhost:{port}/game/{id}/serverstarts").status_code
print("serverStarts response code: " + str(serverStarts))

print_board()

for _ in range(5):
    if game_over():
        break

    move = int(input("Make a move: "))
    requests.post(f"http://localhost:{port}/game/{id}/move", json={"move": move})

    print_board()

    if game_over():
        break
