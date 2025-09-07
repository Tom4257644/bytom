const allPlayers = ['player1', 'player2', 'player3', 'player4', 'player5'];
const suits = ['♠', '♥', '♦', '♣'];
const ranks = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

let deck = [], gameStage = 0, hands = {}, community = [], pot = 0;
let currentBet = 0, raiseCount = 0;
let a = 0;

updateCurrentBetDisplay();
let playerBets = {};
let foldedPlayers = new Set();
let playersToAct = [];
let playerWallets = {};
let handOver = false;
let dealerPosition = 0;
let rotatedPlayers = [];
let startingWallets = {};

[...allPlayers, 'userPlayer'].forEach(p => playerWallets[p] = 1000);

function buildDeck() {
    deck = [];
    for (let suit of suits) {
        for (let rank of ranks) {
            deck.push(rank + suit);
        }
    }
}

function shuffleDeck() {
    for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
    }
}

function dealCard() {
    return deck.pop();
}

function startGame() {
    a = 20;
    handOver = false;
    document.getElementById("startGameButton").style.display = "none";

    gameStage = 0;
    pot = 0;
    currentBet = 0;
    updateCurrentBetDisplay();

    raiseCount = 0;
    foldedPlayers.clear();
    community = [];
    hands = {};
    playerBets = {};
    playersToAct = [];
    startingWallets = {};

    dealerPosition = (dealerPosition + 1) % (allPlayers.length + 1);

    buildDeck();
    shuffleDeck();

    // 🔥 Reset all cards to face down
    for (let player of [...allPlayers, 'userPlayer']) {
        const container = document.getElementById(player);
        const cardFlips = container.querySelectorAll(".card-flip");
        cardFlips.forEach(flip => flip.classList.remove("flipped"));
    }

    for (let i = 0; i < 5; i++) {
        const cardFlip = document.querySelector(`#comm${i} .card-flip`);
        const back = document.querySelector(`#comm${i} .card-back`);
        if (cardFlip && back) {
            cardFlip.classList.remove("flipped"); // 🔥 flip card back down
            back.innerText = ""; // 🔥 clear text
        }
    }





    rotatedPlayers = [];
    const all = [...allPlayers, 'userPlayer'];
    for (let i = 0; i < all.length; i++) {
        rotatedPlayers.push(all[(dealerPosition + i) % all.length]);
    }

    for (let player of rotatedPlayers) {
        hands[player] = [dealCard(), dealCard()];
        playerBets[player] = 0;
        startingWallets[player] = playerWallets[player];

        const container = document.getElementById(player);
        const cardFlips = container.querySelectorAll(".card-flip");

        cardFlips.forEach(flip => {
            flip.querySelector(".card-front").innerText = "";
        });

        if (player === "userPlayer") {
            const back0 = cardFlips[0].querySelector(".card-back");
            const back1 = cardFlips[1].querySelector(".card-back");
            back0.innerText = hands[player][0];
            back1.innerText = hands[player][1];
            setCardColor(back0, hands[player][0]);
            setCardColor(back1, hands[player][1]);
            cardFlips.forEach(flip => flip.classList.add("flipped"));
        } else {
            cardFlips.forEach(flip => flip.querySelector(".card-back").innerText = "🂠");
        }

        updateWalletDisplay(player);
        updateBetDisplay(player);
        showPlayerAction(player, "");
    }

    document.getElementById("log").innerText = "Starting new game...";
    document.getElementById("userActions").style.display = "none";
    updatePotDisplay();

    const smallBlindPlayer = rotatedPlayers[(rotatedPlayers.length - 2) % rotatedPlayers.length];
    const bigBlindPlayer = rotatedPlayers[(rotatedPlayers.length - 1) % rotatedPlayers.length];

    postBlind(smallBlindPlayer, 10, "small blind");
    postBlind(bigBlindPlayer, 20, "big blind");

    currentBet = 20;
    updateCurrentBetDisplay();

    playersToAct = rotatedPlayers.filter(p => !foldedPlayers.has(p));
    startBettingCycle();
}

function postBlind(player, amount, label) {
    playerBets[player] += amount;
    playerWallets[player] -= amount;
    pot += amount;
    showPlayerAction(player, `posts ${label} $${amount}`);
    updateBetDisplay(player);
    updateWalletDisplay(player);
    updatePotDisplay();
}

async function startBettingCycle() {
    while (playersToAct.length > 0) {
        if (handOver) return;

        const player = playersToAct.shift();
        if (foldedPlayers.has(player)) continue;

        highlightPlayer(player); // 🔥 ADD THIS LINE

        if (player === "userPlayer") {
            promptUserAction();
            return;
        }

        await botAct(player);
    }

    if (!handOver) {
        dealNextStage();
    }
}

function highlightPlayer(playerId) {
    for (let player of [...allPlayers, 'userPlayer']) {
        const playerInfo = document.querySelector(`#${player} .player-info`);
        if (playerInfo) {
            if (foldedPlayers.has(player)) {
                playerInfo.style.color = "rgb(57, 9, 7)"; // 🔥 Always dark red if folded
            } else if (player === playerId) {
                playerInfo.style.color = "#ffcf57"; // 🔥 Yellow if it's their turn
            } else {
                playerInfo.style.color = "white"; // 🔥 White otherwise
            }
        }
    }
}


async function botAct(player) {
    const bet = playerBets[player];
    let action;

    if (currentBet === 0) {
        action = getRandom(['Check', 'Raise']);
    } else if (raiseCount >= 3) {
        action = getRandom(['Call', 'Fold']);
    } else {
        action = getRandom(['Call', 'Raise', 'Fold']);
    }

    if (action === 'Fold') {
        foldedPlayers.add(player);
        log(`${player.toUpperCase()} folds`);
        showPlayerAction(player, "Folded");
        checkForInstantWin();
        await delay(600); // small delay to feel natural
        return; // 🔥 EXIT after fold
    }

    if (action === 'Check') {
        log(`${player.toUpperCase()} checked`);
        showPlayerAction(player, "checked");
    } else if (action === 'Call') {
        const callAmt = currentBet - bet;
        playerBets[player] += callAmt;
        playerWallets[player] -= callAmt;
        pot += callAmt;
        log(`${player.toUpperCase()} Called $${callAmt}`);
        showPlayerAction(player, `Called $${callAmt}`);
        updateBetDisplay(player);
        updateWalletDisplay(player);
        updatePotDisplay();
    } else if (action === 'Raise') {
        const raiseAmt = Math.floor(Math.random() * 150) + 50;
        currentBet += raiseAmt;
        updateCurrentBetDisplay();

        const toCall = currentBet - bet;
        playerBets[player] += toCall;
        playerWallets[player] -= toCall;
        pot += toCall;
        raiseCount++;
        log(`${player.toUpperCase()} Raised $${currentBet}`);
        showPlayerAction(player, `Raised $${currentBet}`);
        updateBetDisplay(player);
        updateWalletDisplay(player);
        updatePotDisplay();

        for (let p of [...allPlayers, 'userPlayer']) {
            if (!foldedPlayers.has(p) && p !== player && playerBets[p] < currentBet && !playersToAct.includes(p)) {
                playersToAct.push(p);
            }
        }
    }

    await delay(2000); // small natural wait
}



function promptUserAction() {
    document.getElementById("userActions").style.display = "block";
    const bet = playerBets["userPlayer"];
    const toCall = currentBet - bet;

    highlightPlayer("userPlayer"); // highlight whose turn

    const checkButton = document.getElementById("checkButton");
    const callButton = document.getElementById("callButton");

    if (toCall === 0) {
        checkButton.style.display = "inline-block";
        callButton.style.display = "none"; // 🔥 HIDE the Call button entirely
    } else {
        checkButton.style.display = "none"; // 🔥 HIDE Check if not allowed
        callButton.style.display = "inline-block";
        callButton.innerText = `Call $${toCall}`; // set the right call amount
    }

    log("Your turn to act.");
}


function userBet(action) {
    document.getElementById("userActions").style.display = "none";
    const bet = playerBets["userPlayer"];

    if (action === 'Fold') {
        foldedPlayers.add("userPlayer");
        log("You fold.");
        showPlayerAction("userPlayer", "Folded");
        checkForInstantWin();

        const container = document.getElementById("userPlayer");
        const cardFlips = container.querySelectorAll(".card-flip");
        cardFlips.forEach(flip => flip.classList.remove("flipped"));

        document.getElementById("userActions").style.display = "none";

        // 🔥 🔥 🔥 If hand isn't over yet, bots must keep acting
        if (!handOver) {
            startBettingCycle();
        }

        return; // exit
    }


    if (action === 'Check') {
        log("You checked");
        showPlayerAction("userPlayer", "checked");
        startBettingCycle();
    } else if (action === 'Call') {
        const callAmt = currentBet - bet;
        playerBets["userPlayer"] += callAmt;
        playerWallets["userPlayer"] -= callAmt;
        pot += callAmt;
        log(`You call $${callAmt}`);
        showPlayerAction("userPlayer", `Called $${callAmt}`);
        updateBetDisplay("userPlayer");
        updateWalletDisplay("userPlayer");
        updatePotDisplay();
        startBettingCycle();
    } else if (action === 'Raise') {
        if (raiseCount >= 3) {
            log("Raise limit reached for this betting round."); // 🔥 Log it, don't alert
            document.getElementById("userActions").style.display = "block";
            return;
        }
        buildingRaise = true;
        raiseAmountChosen = 0;
        document.getElementById("buttonsForBets").style.display = "block";
        document.getElementById("totalBet").style.display = "block";
        document.getElementById("userActions").style.display = "none";
        document.getElementById("totalBet").innerText = "Total Bet: $0";
        return;
    }


}

function dealNextStage() {
    if (gameStage === 0) {
        // Flop - 3 cards
        community.push(dealCard(), dealCard(), dealCard());
        for (let i = 0; i < 3; i++) {
            const commCard = document.querySelector(`#comm${i} .card-back`);
            commCard.innerText = community[i];
            setCardColor(commCard, community[i]); // 🔥 SET CARD COLOR
            document.querySelector(`#comm${i} .card-flip`).classList.add("flipped");
        }
    } else if (gameStage === 1) {
        // Turn - 4th card
        community.push(dealCard());
        const commCard = document.querySelector(`#comm3 .card-back`);
        commCard.innerText = community[3];
        setCardColor(commCard, community[3]); // 🔥 SET CARD COLOR
        document.querySelector(`#comm3 .card-flip`).classList.add("flipped");
    } else if (gameStage === 2) {
        // River - 5th card
        community.push(dealCard());
        const commCard = document.querySelector(`#comm4 .card-back`);
        commCard.innerText = community[4];
        setCardColor(commCard, community[4]); // 🔥 SET CARD COLOR
        document.querySelector(`#comm4 .card-flip`).classList.add("flipped");
    } else {
        log("All cards dealt. Revealing hands...");
        revealAllHands();
        document.getElementById("startGameButton").style.display = "inline-block";
        return;
    }

    gameStage++;
    currentBet = 0;
    updateCurrentBetDisplay();

    raiseCount = 0;
    for (let p in playerBets) playerBets[p] = 0;
    playersToAct = rotatedPlayers.filter(p => !foldedPlayers.has(p));
    setTimeout(startBettingCycle, 1000);
}



function evaluateWinner() {
    const activePlayers = rotatedPlayers.filter(p => !foldedPlayers.has(p));

    let bestHand = null;
    let bestPlayer = null;

    for (const player of activePlayers) {
        const fullHand = hands[player].concat(community);
        const allCombos = getAll5CardCombos(fullHand);
        const rankedHands = allCombos.map(combo => ({
            player,
            cards: combo,
            rank: evaluateHand(combo)
        }));

        const best = rankedHands.sort(compareHands)[0];
        if (!bestHand || compareHands(best, bestHand) < 0) {
            bestHand = best;
            bestPlayer = player;
        }
    }

    if (bestPlayer) {
        playerWallets[bestPlayer] += pot;
        log(`${bestPlayer === 'userPlayer' ? 'You' : bestPlayer.toUpperCase()} won the pot of $${pot} with a ${bestHand.rank.name}!`);
        updateWalletDisplay(bestPlayer);
        pot = 0;
        updatePotDisplay();

        // 🔥 Clear ALL previous highlights and folding colors first
        for (let player of [...allPlayers, 'userPlayer']) {
            const playerInfo = document.querySelector(`#${player} .player-info`);
            if (playerInfo) {
                playerInfo.style.color = "rgb(57, 9, 7)"; // Everyone default to red first
            }
        }

        // 🔥 Now make the winner yellow
        const winnerInfo = document.querySelector(`#${bestPlayer} .player-info`);
        if (winnerInfo) {
            winnerInfo.style.color = "#ffcf57"; // winner yellow
        }
    }
}



function revealAllHands() {
    for (let player of [...allPlayers, 'userPlayer']) {
        const container = document.getElementById(player);
        const cardFlips = container.querySelectorAll(".card-flip");

        if (!foldedPlayers.has(player)) {
            // 🔥 Only flip players who did NOT fold
            cardFlips.forEach(flip => flip.classList.add("flipped"));

            const back0 = cardFlips[0].querySelector(".card-back");
            const back1 = cardFlips[1].querySelector(".card-back");
            back0.innerText = hands[player][0];
            back1.innerText = hands[player][1];
            setCardColor(back0, hands[player][0]);
            setCardColor(back1, hands[player][1]);
        }

        updateBetDisplay(player);
        updateWalletDisplay(player);
        showPlayerAction(player, foldedPlayers.has(player) ? "folded" : "");
    }

    evaluateWinner();
}


function log(msg) {
    document.getElementById("log").innerText = msg;
}

function showPlayerAction(playerId, message) {
    const el = document.getElementById(`action-${playerId}`);
    if (el) {
        el.innerText = message;
        const playerInfo = document.querySelector(`#${playerId} .player-info`);
        if (playerInfo) {
            if (message === "folded") {
                playerInfo.style.color = "rgb(57, 9, 7)"; // 🔥 red for folded
            }
        }
    }
}



function updatePotDisplay() {
    document.getElementById("potTracker").innerText = `Pot: $${pot}`;
}

function updateCurrentBetDisplay() {
    document.getElementById("currentBetTracker").innerText = `Current Bet: $${a}`;
}

function updateBetDisplay(player) {
    const el = document.getElementById(`bet-${player}`);
    if (el && startingWallets[player] !== undefined) {
        const lost = startingWallets[player] - playerWallets[player];
        if (lost > a) {
            a = lost;
            updateCurrentBetDisplay();

        }

        el.innerText = `Bet: $${lost}`;
    }
}

function updateWalletDisplay(player) {
    const el = document.getElementById(`wallet-${player}`);
    if (el) el.innerText = `Wallet: $${playerWallets[player]}`;
}

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function getRandom(options) {
    return options[Math.floor(Math.random() * options.length)];
}

function checkForInstantWin() {
    const activePlayers = rotatedPlayers.filter(p => !foldedPlayers.has(p));

    if (activePlayers.length === 1) {
        const winner = activePlayers[0];
        playerWallets[winner] += pot;
        log(`${winner === 'userPlayer' ? 'You' : winner.toUpperCase()} won the pot of $${pot} because everyone else folded!`);
        updateWalletDisplay(winner);
        pot = 0;
        updatePotDisplay();
        handOver = true;
        document.getElementById("startGameButton").style.display = "inline-block";
        document.getElementById("userActions").style.display = "none";

        // 🔥 Set all colors properly
        for (let player of [...allPlayers, 'userPlayer']) {
            const playerInfo = document.querySelector(`#${player} .player-info`);
            if (playerInfo) {
                playerInfo.style.color = "rgb(57, 9, 7)"; // everyone red
            }
        }

        const winnerInfo = document.querySelector(`#${winner} .player-info`);
        if (winnerInfo) {
            winnerInfo.style.color = "#ffcf57"; // winner yellow
        }
    }
}


let buildingRaise = false;
let raiseAmountChosen = 0;

document.getElementById("buttonsForBets").style.display = "none";
document.getElementById("totalBet").style.display = "none";

// document.getElementById("betButton1").onclick = () => addToRaise(1);
// document.getElementById("betButton10").onclick = () => addToRaise(10);
// document.getElementById("betButton50").onclick = () => addToRaise(50);
// document.getElementById("betButton100").onclick = () => addToRaise(100);

document.getElementById("confirmBetButton").onclick = confirmRaise;
document.getElementById("cancelBetButton").onclick = cancelRaise;

function addToRaise(amount) {
    raiseAmountChosen += amount;
    document.getElementById("totalBet").innerText = `Total Bet: $${raiseAmountChosen}`;
}

function confirmRaise() {
    if (raiseAmountChosen <= 0) {
        log("You must bet more than $0 to raise."); // 🔥 Log instead of alert
        return;
    }
    executeUserRaise(raiseAmountChosen);
}

function cancelRaise() {
    buildingRaise = false;
    raiseAmountChosen = 0;
    document.getElementById("buttonsForBets").style.display = "none";
    document.getElementById("totalBet").style.display = "none";
    document.getElementById("userActions").style.display = "block";
}

function executeUserRaise(amount) {
    buildingRaise = false;
    document.getElementById("buttonsForBets").style.display = "none";
    document.getElementById("totalBet").style.display = "none";

    const bet = playerBets["userPlayer"];
    currentBet += amount;
    updateCurrentBetDisplay();

    const toCall = currentBet - bet;
    playerBets["userPlayer"] += toCall;
    playerWallets["userPlayer"] -= toCall;
    pot += toCall;
    raiseCount++;

    log(`You raise $${currentBet}`);
    showPlayerAction("userPlayer", `Raises $${currentBet}`);
    updateBetDisplay("userPlayer");
    updateWalletDisplay("userPlayer");
    updatePotDisplay();

    playersToAct = rotatedPlayers.filter(p => !foldedPlayers.has(p) && playerBets[p] < currentBet);
    startBettingCycle();
}

function getAll5CardCombos(cards) {
    const combos = [];
    const n = cards.length;
    for (let a = 0; a < n - 4; a++)
        for (let b = a + 1; b < n - 3; b++)
            for (let c = b + 1; c < n - 2; c++)
                for (let d = c + 1; d < n - 1; d++)
                    for (let e = d + 1; e < n; e++)
                        combos.push([cards[a], cards[b], cards[c], cards[d], cards[e]]);
    return combos;
}

function evaluateHand(hand) {
    const values = hand.map(card => rankValue(card)).sort((a, b) => b - a);
    const suits = hand.map(card => card.slice(-1));
    const counts = {};
    for (let v of values) counts[v] = (counts[v] || 0) + 1;

    const groups = Object.entries(counts).sort((a, b) => b[1] - a[1] || b[0] - a[0]);
    const isFlush = suits.every(s => s === suits[0]);
    const isStraight = values.every((v, i, arr) => i === 0 || arr[i - 1] === v + 1) || values.join() === '14,5,4,3,2';

    const getSorted = () => groups.map(([v, c]) => `${c}${v}`).join();

    if (isStraight && isFlush) return { rank: 1, tiebreaker: values, name: "Straight Flush" };
    if (groups[0][1] === 4) return { rank: 2, tiebreaker: getSorted(), name: "Four of a Kind" };
    if (groups[0][1] === 3 && groups[1][1] === 2) return { rank: 3, tiebreaker: getSorted(), name: "Full House" };
    if (isFlush) return { rank: 4, tiebreaker: values, name: "Flush" };
    if (isStraight) return { rank: 5, tiebreaker: values, name: "Straight" };
    if (groups[0][1] === 3) return { rank: 6, tiebreaker: getSorted(), name: "Three of a Kind" };
    if (groups[0][1] === 2 && groups[1][1] === 2) return { rank: 7, tiebreaker: getSorted(), name: "Two Pair" };
    if (groups[0][1] === 2) return { rank: 8, tiebreaker: getSorted(), name: "One Pair" };
    return { rank: 9, tiebreaker: values, name: "High Card" };
}

function compareHands(a, b) {
    if (a.rank.rank !== b.rank.rank) return a.rank.rank - b.rank.rank;

    const ta = Array.isArray(a.rank.tiebreaker) ? a.rank.tiebreaker : a.rank.tiebreaker.split(',').map(Number);
    const tb = Array.isArray(b.rank.tiebreaker) ? b.rank.tiebreaker : b.rank.tiebreaker.split(',').map(Number);

    for (let i = 0; i < Math.min(ta.length, tb.length); i++) {
        if (ta[i] !== tb[i]) return tb[i] - ta[i];
    }
    return 0;
}

function rankValue(card) {
    const rank = card.slice(0, -1);
    if (rank === 'A') return 14;
    if (rank === 'K') return 13;
    if (rank === 'Q') return 12;
    if (rank === 'J') return 11;
    return parseInt(rank);
}

function setCardColor(cardElement, cardText) {
    if (cardText.includes('♥') || cardText.includes('♦')) {
        cardElement.style.color = "red";
    } else {
        cardElement.style.color = "black";
    }
}


// Start game button
document.getElementById("startGameButton")?.addEventListener("click", startGame);

// User action buttons
document.getElementById("checkButton")?.addEventListener("click", () => userBet('Check'));
document.getElementById("callButton")?.addEventListener("click", () => userBet('Call'));
document.getElementById("raiseButton")?.addEventListener("click", () => userBet('Raise'));
document.getElementById("foldButton")?.addEventListener("click", () => userBet('Fold'));

// Raise amount buttons
document.getElementById("betButton1")?.addEventListener("click", () => addToRaise(1));
document.getElementById("betButton10")?.addEventListener("click", () => addToRaise(10));
document.getElementById("betButton50")?.addEventListener("click", () => addToRaise(50));
document.getElementById("betButton100")?.addEventListener("click", () => addToRaise(100));

// Confirm / Cancel Raise
document.getElementById("confirmBetButton")?.addEventListener("click", confirmRaise);
document.getElementById("cancelBetButton")?.addEventListener("click", cancelRaise);
