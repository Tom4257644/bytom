

// setting global variables 

let dealerCards = [];
let playerCards = [];
let dealerTotal = '';
let playerTotal = '';
let numberOfAcesDealer = 0;
let numberOfAcesPlayer = 0;
let totalBetAmount = 0;
let buttons = '<button onclick="deal()">Deal</button>';
let startingMoney = 1000;
let result = undefined;
let previousPlayerCardCount = 0;
let previousDealerCardCount = 0;


function pickCard() {
    let card = Math.floor(Math.random() * 13) + 1;
    return (card);
};

function displayCards() {
    const dealerContainer = document.getElementById('rowForDealerCards');
    const playerContainer = document.getElementById('rowForPlayerCards');

    dealerContainer.innerHTML = '';
    playerContainer.innerHTML = '';

    for (let i = 0; i < dealerCards.length; i++) {
        let val = dealerCards[i];
        let label = val === 1 ? 'A' : val === 11 ? 'J' : val === 12 ? 'Q' : val === 13 ? 'K' : val;
        let colorClass = Math.random() < 0.5 ? 'card-red' : 'card-black';

        let cardWrapper = document.createElement('div');
        cardWrapper.className = 'card-wrapper';

        let cardFlip = document.createElement('div');
        cardFlip.className = 'card-flip';

        cardFlip.innerHTML = `
                <div class="card-front"></div>
                <div class="card-back ${colorClass}">${label}</div>
            `;

        cardWrapper.appendChild(cardFlip);
        dealerContainer.appendChild(cardWrapper);

        if (i >= previousDealerCardCount) {
            setTimeout(() => cardFlip.classList.add('flipped'), 100 + i * 80);
        } else {
            cardFlip.classList.add('flipped'); // already shown
        }
    }

    for (let i = 0; i < playerCards.length; i++) {
        let val = playerCards[i];
        let label = val === 1 ? 'A' : val === 11 ? 'J' : val === 12 ? 'Q' : val === 13 ? 'K' : val;
        let colorClass = Math.random() < 0.5 ? 'card-red' : 'card-black';

        let cardWrapper = document.createElement('div');
        cardWrapper.className = 'card-wrapper';

        let cardFlip = document.createElement('div');
        cardFlip.className = 'card-flip';

        cardFlip.innerHTML = `
                <div class="card-front"></div>
                <div class="card-back ${colorClass}">${label}</div>
            `;

        cardWrapper.appendChild(cardFlip);
        playerContainer.appendChild(cardWrapper);

        if (i >= previousPlayerCardCount) {
            setTimeout(() => cardFlip.classList.add('flipped'), 100 + i * 80);
        } else {
            cardFlip.classList.add('flipped');
        }
    }

    previousDealerCardCount = dealerCards.length;
    previousPlayerCardCount = playerCards.length;
}



function deal() {
    dealerCards.push(pickCard());
    playerCards.push(pickCard());
    playerCards.push(pickCard());

    displayCards();
    getTotals();
    if (playerTotal === 21) {
        document.getElementById('playerResult').innerHTML = 'Result: Player BlackJack';
        buttons = '<span id="continueButton" class="button-single">Continue</span>';


        document.getElementById('buttonRow').innerHTML = buttons;
        document.getElementById('donationMessage').style.display = 'block';

        result = 'win';

        var continueButton = document.getElementById('continueButton');
        continueButton.addEventListener('click', reset);


    } else {


        buttons = '<span id="hitButton" class="button-double">Hit</span> <span id="standButton" class="button-double">Stand</span>';

        document.getElementById('buttonRow').innerHTML = buttons;

        var hitButton = document.getElementById('hitButton');
        hitButton.addEventListener('click', hit);

        var standButton = document.getElementById('standButton');
        standButton.addEventListener('click', stand);

    };

    document.getElementById('buttonsForBets').innerHTML = '';


};

function getTotals() {
    dealerTotal = 0;
    playerTotal = 0;

    for (let i = 0; i < dealerCards.length; i++) {



        if (dealerCards[i] == 1) {
            dealerTotal += 11;
            numberOfAcesDealer += 1;
        } else if (dealerCards[i] == 11 || dealerCards[i] == 12 || dealerCards[i] == 13) {
            dealerTotal += 10;
        } else {
            dealerTotal += dealerCards[i];
        };
        while (dealerTotal > 21 && numberOfAcesDealer > 0) {
            dealerTotal -= 10;
            numberOfAcesDealer--;
        };
    };

    for (let i = 0; i < playerCards.length; i++) {

        console.log(playerCards[i])

        if (playerCards[i] == 11 || playerCards[i] == 12 || playerCards[i] == 13) {
            playerTotal += 10;
        } else if (playerCards[i] == 1) {
            playerTotal += 11;
            numberOfAcesPlayer += 1;
        } else {
            playerTotal += playerCards[i];
        };

        while (playerTotal > 21 && numberOfAcesPlayer > 0) {
            playerTotal -= 10;
            numberOfAcesPlayer--;
        };

    };

    document.getElementById('dealerTotalText').innerHTML = `Total: ${dealerTotal}`;
    document.getElementById('playerTotalText').innerHTML = `Total: ${playerTotal}`;

}

function hit() {
    playerCards.push(pickCard());
    displayCards();
    getTotals();
    checkResult();
};

function stand() {
    while (dealerTotal <= 16) {
        dealerCards.push(pickCard());
        displayCards();
        getTotals();
    };
    checkResult();

};

function reset() {
    dealerCards = [];
    playerCards = [];
    dealerTotal = '';
    playerTotal = '';
    numberOfAcesPlayer = 0;
    numberOfAcesDealer = 0;
    result = undefined;
    totalBetAmount = 0;
    buttons = '<span id="dealButton" class="button-single">Deal</span>';
    document.getElementById('buttonRow').innerHTML = buttons;
    displayCards();
    getTotals();
    document.getElementById('playerResult').innerHTML = '';
    document.getElementById('totalBet').innerHTML = `Total Bet: ${totalBetAmount}`;
    document.getElementById('buttonsForBets').innerHTML = `<span id='betButton1' class="betButton"><img class="imgBackground" src="assets/a1.png"></span>
        <span id='betButton10' class="betButton"><img class="imgBackground" src="assets/a10.png"></span>
        <span id='betButton50' class="betButton"><img class="imgBackground" src="assets/a50.png"></span>
        <span id='betButton100' class="betButton"><img class="imgBackground" src="assets/a100.png"></span>
        <span id="cancelBetButton" class="pageButtons">cancel bet</span>`;

    var dealButton = document.getElementById('dealButton');
    dealButton.addEventListener('click', deal);

    var cancelBetButton = document.getElementById('cancelBetButton');
    cancelBetButton.addEventListener('click', cancelBet);

    var betButton1 = document.getElementById('betButton1');
    betButton1.addEventListener('click', addToBet1);

    var betButton10 = document.getElementById('betButton10');
    betButton10.addEventListener('click', addToBet10);

    var betButton50 = document.getElementById('betButton50');
    betButton50.addEventListener('click', addToBet50);

    var betButton100 = document.getElementById('betButton100');
    betButton100.addEventListener('click', addToBet100);
    document.getElementById('cancelBetButton').classList.add('invisible');
    document.getElementById('donationMessage').style.display = 'none';
    previousDealerCardCount = 0;
    previousPlayerCardCount = 0;




};

function checkResult() {
    if (playerTotal > 21) {
        document.getElementById('playerResult').innerHTML = 'Result: Player Busted, YOU LOSE';
        buttons = '<span id="continueButton" class="button-single">Continue</span>';
        document.getElementById('buttonRow').innerHTML = buttons;
        document.getElementById('donationMessage').style.display = 'block';
        result = 'lose';
        processBet();

    } else if (playerTotal === 21) {
        while (dealerTotal <= 16) {
            dealerCards.push(pickCard());
            displayCards();
            getTotals();
        };
        if (playerTotal === 21 && dealerTotal === 21) {
            document.getElementById('playerResult').innerHTML = 'Result: BOTH BlackJack, YOU TIE';
            buttons = '<span id="continueButton" class="pageButtons">continue</span>';
            document.getElementById('donationMessage').style.display = 'block';
            result = 'push';
            processBet();
        } else {
            document.getElementById('playerResult').innerHTML = 'Result: Player BlackJack, YOU WIN';
            buttons = '<span id="continueButton" class="button-single">Continue</span>';
            document.getElementById('donationMessage').style.display = 'block';

            result = 'win';
            processBet();
        };
        document.getElementById('buttonRow').innerHTML = buttons;
    } else if (dealerTotal > 21) {
        document.getElementById('playerResult').innerHTML = 'Result: Dealer Busted, YOU WIN';
        buttons = '<span id="continueButton" class="button-single">Continue</span>';
        document.getElementById('donationMessage').style.display = 'block';

        document.getElementById('buttonRow').innerHTML = buttons;
        result = 'win';
        processBet();
    } else if (dealerTotal === playerTotal) {
        document.getElementById('playerResult').innerHTML = 'Result: Same Totals, YOU TIE';
        buttons = '<span id="continueButton" class="button-single">Continue</span>';
        document.getElementById('donationMessage').style.display = 'block';

        document.getElementById('buttonRow').innerHTML = buttons;
        result = 'push';
        processBet();
    } else if (dealerTotal >= 16) {
        if (dealerTotal > playerTotal) {
            document.getElementById('playerResult').innerHTML = 'Result: Dealer has greater total, YOU LOSE';
            buttons = '<span id="continueButton" class="button-single">Continue</span>';
            document.getElementById('donationMessage').style.display = 'block';

            document.getElementById('buttonRow').innerHTML = buttons;
            result = 'lose';
            processBet();
        } else {
            document.getElementById('playerResult').innerHTML = 'Result: Player has greater total, YOU WIN';
            buttons = '<span id="continueButton" class="button-single">Continue</span>';
            document.getElementById('donationMessage').style.display = 'block';

            document.getElementById('buttonRow').innerHTML = buttons;
            result = 'win';
            processBet();
        };

    };

    var continueButton = document.getElementById('continueButton');
    continueButton.addEventListener('click', reset);



};

function addToBet1() {

    totalBetAmount += 1;
    document.getElementById('totalBet').innerHTML = `Total Bet: ${totalBetAmount}`;
    removeBetAmountFromTotalMoneyTemp();
    document.getElementById('cancelBetButton').classList.remove('invisible');

}

function addToBet10() {

    totalBetAmount += 10;
    document.getElementById('totalBet').innerHTML = `Total Bet: ${totalBetAmount}`;
    removeBetAmountFromTotalMoneyTemp();
    document.getElementById('cancelBetButton').classList.remove('invisible');

}

function addToBet50() {

    totalBetAmount += 50;
    document.getElementById('totalBet').innerHTML = `Total Bet: ${totalBetAmount}`;
    removeBetAmountFromTotalMoneyTemp();
    document.getElementById('cancelBetButton').classList.remove('invisible');

}

function addToBet100() {

    totalBetAmount += 100;
    document.getElementById('totalBet').innerHTML = `Total Bet: ${totalBetAmount}`;
    removeBetAmountFromTotalMoneyTemp();
    document.getElementById('cancelBetButton').classList.remove('invisible');

}

function cancelBet() {
    totalMoney = totalMoney + totalBetAmount;
    document.getElementById('totalMoney').innerHTML = `Total Money: ${totalMoney}`;
    totalBetAmount = 0;
    document.getElementById('totalBet').innerHTML = `Total Bet: ${totalBetAmount}`;
    document.getElementById('cancelBetButton').classList.add('invisible');



};

function removeBetAmountFromTotalMoneyTemp() {

    totalMoney = startingMoney - totalBetAmount;
    document.getElementById('totalMoney').innerHTML = `Total Money: ${totalMoney}`;

};

function processBet() {

    if (result === 'win') {
        startingMoney = startingMoney + totalBetAmount;
    } else if (result === 'lose') {
        startingMoney = startingMoney - totalBetAmount;
    } else if (result === 'push') {
        startingMoney = startingMoney;
    };
    document.getElementById('totalMoney').innerHTML = `Total Money: ${startingMoney}`;



};


// event listener for deal button

var dealButton = document.getElementById('dealButton');
dealButton.addEventListener('click', deal);

var cancelBetButton = document.getElementById('cancelBetButton');
cancelBetButton.addEventListener('click', cancelBet);

var betButton1 = document.getElementById('betButton1');
betButton1.addEventListener('click', addToBet1);

var betButton10 = document.getElementById('betButton10');
betButton10.addEventListener('click', addToBet10);

var betButton50 = document.getElementById('betButton50');
betButton50.addEventListener('click', addToBet50);

var betButton100 = document.getElementById('betButton100');
betButton100.addEventListener('click', addToBet100);

window.onload = reset;



