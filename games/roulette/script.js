const numbers = [
    0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27,
    13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33,
    1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26
];

const colors = {
    0: 'green',
    32: 'red', 15: 'black', 19: 'red', 4: 'black', 21: 'red', 2: 'black',
    25: 'red', 17: 'black', 34: 'red', 6: 'black', 27: 'red', 13: 'black',
    36: 'red', 11: 'black', 30: 'red', 8: 'black', 23: 'red', 10: 'black',
    5: 'red', 24: 'black', 16: 'red', 33: 'black', 1: 'red', 20: 'black',
    14: 'red', 31: 'black', 9: 'red', 22: 'black', 18: 'red', 29: 'black',
    7: 'red', 28: 'black', 12: 'red', 35: 'black', 3: 'red', 26: 'black'
};

let walletBalance = 1000;
const wheel = document.getElementById('wheel');
const ball = document.getElementById('ball');
const canvas = document.getElementById('wheelCanvas');
const ctx = canvas.getContext('2d');
const walletDiv = document.getElementById('wallet');
const resultDiv = document.getElementById('result');

const sectorAngle = 360 / numbers.length;

function drawWheel() {
    for (let i = 0; i < numbers.length; i++) {
        const angle = sectorAngle * i;
        ctx.beginPath();
        ctx.moveTo(150, 150);
        ctx.arc(150, 150, 150, angle * Math.PI / 180, (angle + sectorAngle) * Math.PI / 180);
        ctx.closePath();
        const num = numbers[i];
        ctx.fillStyle = colors[num] === 'red' ? '#d00' : colors[num] === 'black' ? '#000' : 'green';
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.font = '12px Arial';
        ctx.save();
        ctx.translate(150, 150);
        ctx.rotate((angle + sectorAngle / 2) * Math.PI / 180);
        ctx.textAlign = 'right';
        ctx.fillText(num, 140, 5);
        ctx.restore();
    }
}
drawWheel();

document.getElementById('betType').addEventListener('change', function () {
    const specific = document.getElementById('specificNumber');
    if (this.value === 'number') {
        specific.style.display = 'inline-block';
    } else {
        specific.style.display = 'none';
    }
});

function spinRoulette() {
    const betType = document.getElementById('betType').value;
    const specificNumber = parseInt(document.getElementById('specificNumber').value);
    const betAmount = parseInt(document.getElementById('betAmount').value);

    if (!betAmount || betAmount <= 0 || betAmount > walletBalance) {
        logMessage('Invalid bet amount.');
        return;
    }

    if (betType === 'number' && (isNaN(specificNumber) || specificNumber < 0 || specificNumber > 36)) {
        logMessage('Please select a valid number between 0-36.');
        return;
    }

    walletBalance -= betAmount;
    updateWallet();

    const wheelSpinDegrees = Math.floor(Math.random() * (1800 - 360 + 1)) + 360;
    const ballSpinDegrees = Math.floor(Math.random() * (1800 - 360 + 1)) + 360;

    wheel.style.transform = `rotate(${wheelSpinDegrees}deg)`;
    ball.style.transform = `rotate(${-ballSpinDegrees}deg) translate(115px) rotate(${-ballSpinDegrees}deg)`;

    setTimeout(() => {
        const finalWheelDegree = (360 - (wheelSpinDegrees % 360)) % 360;
        const finalBallDegree = (360 - (ballSpinDegrees % 360)) % 360;

        const angleOffset = sectorAngle / 2; // same as before
        let relativeDegree = (finalBallDegree + finalWheelDegree + angleOffset) % 360;

        // YOUR correct indexing system:
        let index = Math.floor((relativeDegree + sectorAngle / 2) / sectorAngle) % numbers.length;
        if (index >= numbers.length) index = 0;

        const landedNumber = numbers[index - 1];
        const landedColor = colors[landedNumber];

        speakNumber(landedNumber, landedColor);


        if ((betType === 'red' && landedColor === 'red') ||
            (betType === 'black' && landedColor === 'black')) {
            walletBalance += betAmount * 2;
            logMessage(`You won! 2x payout!`);
        } else if (betType === 'green' && landedColor === 'green') {
            walletBalance += betAmount * 35;
            logMessage(`JACKPOT! 35x payout!`);
        } else if (betType === 'even' && landedNumber !== 0 && landedNumber % 2 === 0) {
            walletBalance += betAmount * 2;
            logMessage(`You won! 2x payout!`);
        } else if (betType === 'odd' && landedNumber % 2 === 1) {
            walletBalance += betAmount * 2;
            logMessage(`You won! 2x payout!`);
        } else if (betType === 'low' && landedNumber >= 1 && landedNumber <= 18) {
            walletBalance += betAmount * 2;
            logMessage(`You won! 2x payout!`);
        } else if (betType === 'high' && landedNumber >= 19 && landedNumber <= 36) {
            walletBalance += betAmount * 2;
            logMessage(`You won! 2x payout!`);
        } else if (betType === 'number' && landedNumber === specificNumber) {
            walletBalance += betAmount * 35;
            logMessage(`JACKPOT! 35x payout!`);
        } else {
            logMessage(`You lost the bet.`);
        }


        updateWallet();
    }, 6200);
}

function speakNumber(number, color) {
    const logDiv = document.getElementById('log');
    logDiv.innerHTML = `<span style="color: #ffcf57;">Ball landed on ${number} (${color})</span>`;
}

function updateWallet() {
    walletDiv.textContent = `Wallet: $${walletBalance}`;
}

function logMessage(message) {
    const logDiv = document.getElementById('log');
    logDiv.innerHTML += `<br><span style="color: #ffcf57;">${message}</span>`;
}

document.getElementById('spinButton').addEventListener('click', spinRoulette);
