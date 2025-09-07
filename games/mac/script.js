let backgroundColorMain = 'rgb(71, 71, 71)'
document.body.style.backgroundColor = backgroundColorMain;
document.getElementById('levelSelect').style.backgroundColor = backgroundColorMain;
document.getElementById('submitBtn').style.backgroundColor = backgroundColorMain;
let correctAnswer;
let score = 0;
let highScore = 0;
let highScoreAverageTime = 0;
let totalTime = 0;
let totalQuestions = 0;
let timer;
let timeLeft = 30;
let questionStartTime;



function resetGame() {

    score = 0;
    totalTime = 0;
    totalQuestions = 0;
    document.getElementById('score').textContent = `Score: 0`;
    document.getElementById('average-time').textContent = `Average Time: 0s`;


    highScore = 0;
    highScoreAverageTime = 0;
    document.getElementById('high-score').textContent = `High Score: 0`;
    document.getElementById('high-score-average').textContent = `Average Time for High Score: 0s`;


    timeLeft = 30;
    clearInterval(timer);
    document.getElementById('timer').textContent = `${timeLeft}s`;


    generateQuestion();
}

function getRandomNumber(a) {
    if (a == 4 || a == 3) {
        const type = Math.floor(Math.random() * a);
        switch (type) {
            case 0: return Math.floor(Math.random() * 10); // Integer
            case 1: return (Math.random() * 25).toFixed(1); // One decimal place
            case 2: return (Math.random() * 25).toFixed(2);
            case 3: return (Math.random() * 25).toFixed(2);
        }
    }
    else {
        switch (a) {
            case 0: return Math.floor(Math.random() * 10); // Integer
            case 1: return (Math.random() * 10).toFixed(1); // One decimal place
            case 2: return (Math.random() * 10).toFixed(2); // Two decimal places
        }

    }
}








function generateQuestion() {
    const level = document.getElementById('levelSelect').value;
    const operations = ['+', '-', '*', '/'];
    const operation = operations[Math.floor(Math.random() * operations.length)];
    let num1 = 1;
    let num2 = 1;
    if (level === '1') {
        num1 = getRandomNumber(0);
        num2 = getRandomNumber(0);
        if (operation === '/') {
            while (num2 == 0 && num1 % num2 != 0 && num2 % num1 != 0) {
                num1 = getRandomNumber(0);  // Adjust the upper limit as necessary
                num2 = getRandomNumber(0);  // Adjust the upper limit as necessary
            }
            if (operation === '/' && num2 == 0) {
                num2 = getRandomNumber(0);
            }
        }
    }

    else if (level === '2') {
        num1 = getRandomNumber(3);
        num2 = getRandomNumber(3);
        if (operation === '*') {
            num1 = getRandomNumber(0);  // Adjust the upper limit as necessary
            num2 = getRandomNumber(1);  // Adjust the upper limit as necessary

        }

        if (operation === '/') {
            num1 = getRandomNumber(0);  // Adjust the upper limit as necessary
            num2 = getRandomNumber(1);  // Adjust the upper limit as necessary
            while (num2 == 0 && num1 % num2 != 0 && num2 % num1 != 0) {
                num1 = getRandomNumber(0);  // Adjust the upper limit as necessary
                num2 = getRandomNumber(1);  // Adjust the upper limit as necessary
            }
        }
    } else {
        num1 = getRandomNumber(4);
        num2 = getRandomNumber(4);
        if (operation === '*') {
            num1 = getRandomNumber(2);  // Adjust the upper limit as necessary
            num2 = getRandomNumber(1);  // Adjust the upper limit as necessary

        }

        if (operation === '/') {
            num1 = getRandomNumber(2);  // Adjust the upper limit as necessary
            num2 = getRandomNumber(1);  // Adjust the upper limit as necessary
        }


        if (operation === '/' && num2 == 0) {
            num2 = getRandomNumber(4);
        }
    }



    let result;
    num1 = parseFloat(num1);
    num2 = parseFloat(num2);
    switch (operation) {
        case '+':
            result = num1 + num2;
            break;
        case '-':
            result = num1 - num2;
            break;
        case '*':
            result = num1 * num2;
            break;
        case '/':
            result = num1 / num2;
            break;
        default:
            // Handle invalid operation
            result = NaN;
            break;
    }
    correctAnswer = result
    if (correctAnswer % 1 !== 0) {
        if (correctAnswer % 0.001 == 0) {
            correctAnswer = (result).toFixed(3);
        } else if (correctAnswer % 0.01 == 0) {
            correctAnswer = (result).toFixed(2);
        } else if (correctAnswer % 0.1 == 0) {
            correctAnswer = (result).toFixed(1);
        } else { correctAnswer = (result).toFixed(2) }
    } else {
        correctAnswer = (result).toFixed(0)
    }
    correctAnswer = parseFloat(correctAnswer);

    // correctAnswer = parseFloat(eval(`${num1} ${operation} ${num2}`).toFixed(2));

    document.getElementById('question').textContent = `What is ${num1} ${operation} ${num2}?`;
    document.getElementById('answer').value = '';
    document.getElementById('correctAnswer').style.visibility = 'hidden';
    timeLeft = 30;
    document.getElementById('timer').textContent = `${timeLeft}s`;
    clearInterval(timer);
    timer = setInterval(updateTimer, 1000);
    questionStartTime = new Date().getTime();


}














function updateTimer() {
    timeLeft--;
    document.getElementById('timer').textContent = `${timeLeft}s`;
    if (timeLeft <= 0) {
        clearInterval(timer);
        checkAnswer(false);
    }
}

function checkAnswer(isManual = true) {
    const userAnswer = parseFloat(document.getElementById('answer').value);
    clearInterval(timer);
    const answerOneDecimalUp = correctAnswer + 0.01;
    const answerOneDecimalDown = correctAnswer - 0.01;
    let currentTime = new Date().getTime();
    let timeTaken = (currentTime - questionStartTime) / 1000;
    console.log('correctAnswer: ' + correctAnswer + ' (Type: ' + typeof correctAnswer + ')');
    console.log('userAnswer: ' + userAnswer + ' (Type: ' + typeof userAnswer + ')');
    if (!isManual || userAnswer !== correctAnswer) {
        if (userAnswer === answerOneDecimalUp || userAnswer === answerOneDecimalDown) {
            document.body.style.backgroundColor = 'rgb(201, 130, 84)';
            document.getElementById('levelSelect').style.backgroundColor = 'rgb(201, 130, 84)';
            document.getElementById('submitBtn').style.backgroundColor = 'rgb(201, 130, 84)';

        } else {
            if (score > highScore) {
                highScore = score;
                highScoreAverageTime = (totalTime / totalQuestions).toFixed(2);
                document.getElementById('high-score').textContent = `High Score: ${highScore}`;
                document.getElementById('high-score-average').textContent = `Average Time for High Score: ${highScoreAverageTime}s`;
            }
            score = 0;
            totalTime = 0;
            totalQuestions = 0;
            document.getElementById('average-time').textContent = `Average Time: 0s`;
            document.body.style.backgroundColor = 'rgb(162, 100, 100)';
            document.getElementById('levelSelect').style.backgroundColor = 'rgb(162, 100, 100)';
            document.getElementById('submitBtn').style.backgroundColor = 'rgb(162, 100, 100)';
        }
        document.getElementById('correctAnswer').textContent = `Correct Answer: ${correctAnswer}`;
        document.getElementById('correctAnswer').style.visibility = 'visible';
    } else {
        score++;
        document.body.style.backgroundColor = 'rgb(102, 152, 92)';
        document.getElementById('levelSelect').style.backgroundColor = 'rgb(102, 152, 92)';
        document.getElementById('submitBtn').style.backgroundColor = 'rgb(102, 152, 92)';
        totalTime += timeTaken;
        totalQuestions++;
        let averageTime = (totalTime / totalQuestions).toFixed(2);
        document.getElementById('average-time').textContent = `Average Time: ${averageTime}s`;
    }

    document.getElementById('score').textContent = `Score: ${score}`;
    setTimeout(() => {
        document.body.style.backgroundColor = backgroundColorMain;
        document.getElementById('levelSelect').style.backgroundColor = backgroundColorMain;
        document.getElementById('submitBtn').style.backgroundColor = backgroundColorMain;

        generateQuestion();
    }, 1000); // Increase the visibility duration
}

window.onload = function () {
    generateQuestion();
    document.getElementById('answer').addEventListener('keydown', function (event) {
        if (event.key === 'Enter') {
            checkAnswer();
        }
    });
    document.getElementById('levelSelect').addEventListener('change', resetGame);

}

var submitBtn = document.getElementById('submitBtn');
submitBtn.addEventListener('click', checkAnswer);
