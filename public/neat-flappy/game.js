// game variables
let debugMode = false;
let neatMode = false;
let counter = 0;
let width = 0;
let height = 0;
let canvas = null;
let highCounter = 0;
let birdImage;
let backgroundImage;
let distanceTraveled = 0;
let groundImage;

// pipe variables
const pipeSpawnInterval = 110;
let nextPipeTime = 0;
let pipes = [];
let pipeBottomImage;
let pipeTopImage;

// NEAT variables
const populationSize = 50; // Number of agents in NEAT population
const mutationRate = 0.1;
const crossoverRate = 0.5; 
const stagnationThreshold = 10; // Generation threshold for stagnation
let neat;
let generation = 0;

// music variables
let backgroundMusic;
let jumpSound;
let gameOverSound;

function setup() {
  setupCanvas();
  preload();
  frameRate(60);
  initializeGame();
}

// create canvas and set the width and height
function setupCanvas() {
  canvas = createCanvas(400, 700);
  canvas.parent('canvas');
  width = canvas.width;
  height = canvas.height;
}

// initialize the game with a new NEAT population
function initializeGame() {
  neat = new NEAT(populationSize, 2, 1, stagnationThreshold);

  neat.initializePopulation();

  neat.population.forEach(agent => {
    agent.fitness = 0;
    agent.bird = new Bird();
    agent.dead = false;
  });

  userBird = new Bird();

}

function preload() {
  // load image files
  birdImage = loadImage("img/bird.png");
  backgroundImage = loadImage("img/background.png");
  pipeTopImage = loadImage("img/pipetop.png");
  pipeBottomImage = loadImage("img/pipebottom.png");
  groundImage = loadImage("img/ground.png");

  // load sound files
  backgroundMusic = loadSound("sounds/background_music.mp3");
  jumpSound = loadSound("sounds/jump_sound.mp3");
  gameOverSound = loadSound("sounds/game_over_sounds.wav");
}

function draw() {
  drawBackground();

  if (neatMode) {
    if (!neat.areAllDead()) {
      updateBirds();
      updatePipes();
      displayScore();
      displayHighScore();
      displayGeneration();
      displayFPS();

      if (neat.areAllDead()) {
        calculateFitness();

        neat.performNaturalSelection(mutationRate, crossoverRate);
        generation++;

        resetGameState();
      }
    }
  } else {
    if (!userBird.dead) {
      updateBirds();
      updatePipes();
    } else {
      gameOverPipeShow();
      displayGameOver();
    }
    displayScore();
    displayHighScore();
  }
}

// draw the background and the floor
function drawBackground() {
  image(backgroundImage, 0, 0, width, height);
  fill(34, 139, 34); // green
  image(groundImage, 0, height - 50, width, 50);
}

function updateBirds() {
  if (neatMode) {
    neat.population.forEach(agent => {
      if (!agent.dead) {
        const foundPipe = pipes.find(pipe => !pipe.passed);
        agent.bird.distanceTraveled = distanceTraveled;
        const birdY = agent.bird.currentPos.y;

        if (foundPipe) {
          const pipeHeight = foundPipe.pipeHeight / height;
          const pipeX = foundPipe.topPipe.x;
          const inputs = [birdY / height, pipeHeight];
          const output = agent.predict(inputs);

          if (debugMode) {
            stroke(0, 255, 0); // green
            line(agent.bird.currentPos.x, agent.bird.currentPos.y, pipeX + foundPipe.pipeWidth/2, pipeHeight * height);
            noStroke();
          }

          if (output >= 0.5) {
            agent.bird.jump();
          }

          agent.bird.distanceToGapCenter = Math.abs(birdY - pipeHeight * height);
        }

        agent.bird.update();
        agent.bird.show(birdImage, debugMode);

        if (agent.bird.onGround) {
          agent.dead = true;
        }

        if (pipes.some(pipe => pipe.collides(agent.bird))) {
          agent.dead = true;
        }
      }
    });
  } else {
    userBird.update();
    userBird.show(birdImage, debugMode);

    if (pipes.some(pipe => pipe.collides(userBird))) {
      userBird.dead = true;
      gameOverSound.play();
    }
  }
}

function updatePipes() {
  distanceTraveled += 2;

  let pipesToRemove = [];

  pipes.forEach((pipe, index) => {
    pipe.update();
    pipe.show(debugMode, pipeTopImage, pipeBottomImage);

    // Remove pipes that have moved off-screen
    if (pipe.offscreen()) {
      pipesToRemove.push(index);
    }

    if (pipe.topPipe.x + pipe.pipeWidth < 50 && !pipe.passed) {
      counter++;
      pipe.passed = true;
    }

  });

  for (let i = pipesToRemove.length - 1; i >= 0; i--) {
    pipes.splice(pipesToRemove[i], 1);
  }

  if (frameCount >= nextPipeTime) {
    pipes.push(new Pipe(width, height));
    nextPipeTime = frameCount + pipeSpawnInterval;
  }
  
}

function calculateFitness() {
  neat.population.forEach(agent => {
    agent.fitness = agent.bird.distanceTraveled - Math.abs(agent.bird.distanceToGapCenter) * 0.1;
  });
}

function resetGameState() {
  if (neatMode) {
    neat.resetAgents();
  }

  pipes.length = 0;
  distanceTraveled = 0;
  
  if (counter > highCounter) {
    highCounter = counter;
  }

  counter = 0;
  nextPipeTime = frameCount - pipeSpawnInterval;
}

function keyPressed() {
  // if the space key is pressed
  if (!neatMode && keyCode === 32) {
    if (!userBird.dead) {
      userBird.jump();
      jumpSound.play();
    } else {
      userBird.reset();
      resetGameState();
    }
  }
}

function switchMode() {
  neatMode = !neatMode;
  resetGameState();
}

function switchDebugMode() {
  debugMode = !debugMode;
}

function toggleMute() {
  if (!backgroundMusic.isPlaying()) {
    backgroundMusic.loop();
  } else {
    backgroundMusic.pause(); 
  }
}

function gameOverPipeShow() {
  pipes.forEach(pipe => {
    pipe.show(debugMode, pipeTopImage, pipeBottomImage);
  });
}

function displayScore(){
  textSize(32);
  fill(0);
  textAlign(LEFT);
  text("Score: " + counter, 10, 30);
}

function displayGameOver(){
  textSize(32);
  fill(0);
  textAlign(CENTER);
  text("GAME OVER", width/2, height/2);
}

function displayHighScore(){
  textSize(32);
  fill(0);
  textAlign(LEFT);
  text("High Score: " + highCounter, 10, height - 10);
}

function displayGeneration(){
  textSize(32);
  fill(0);
  textAlign(LEFT);
  text("Generation: " + generation, 10, 62);
}

function displayFPS() {
  let fps = frameRate();
  fill(0);
  text("FPS: " + fps.toFixed(2), 10, 94);
}
