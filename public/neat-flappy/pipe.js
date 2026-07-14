const pipeWidth = 60;
const pipeGap = 150;
const pipeSpeed = 2;

class Pipe {
  constructor(screenWidth, screenHeight) {
    this.topPipe = createVector(screenWidth, random( screenHeight / 2));
    this.bottomPipe = createVector(screenWidth, this.topPipe.y + pipeGap);
    this.pipeHeight = this.topPipe.y + pipeGap/2;
    this.screenHeight = screenHeight;
    this.screenWidth = screenWidth;
    this.pipeWidth = pipeWidth;
    this.speed = pipeSpeed; 
    this.passed = false;
  }

  update() {
    this.topPipe.x -= this.speed;
    this.bottomPipe.x -= this.speed;
  }
  
  show(debugMode, pipeTopImage, pipeBottomImage) {
    fill(0, 100, 0); // Set the fill color to dark green for the pipes

    let srcTopHeight = this.pipeWidth * (pipeTopImage.height / pipeTopImage.width);
    if (srcTopHeight > this.topPipe.y) srcTopHeight = this.topPipe.y;
    let yOffset = pipeTopImage.height - srcTopHeight;

    image(pipeTopImage, 
          this.topPipe.x, 0, this.pipeWidth, this.topPipe.y, // Destination rect
          0, yOffset, pipeTopImage.width, srcTopHeight); // Source rect
    
    // For the bottom image
    let destBottomHeight = this.screenHeight - this.bottomPipe.y - 50;
    let srcBottomHeight = this.pipeWidth * (pipeBottomImage.height / pipeBottomImage.width);
    if (srcBottomHeight > destBottomHeight) srcBottomHeight = destBottomHeight;

    image(pipeBottomImage,
          this.bottomPipe.x, this.bottomPipe.y, this.pipeWidth, destBottomHeight, // Destination rect
          0, 0, pipeBottomImage.width, srcBottomHeight); // Source rect


    if (debugMode) {
      noFill();
      stroke(255, 0, 0); // Red color
      rect(this.topPipe.x, 0, this.pipeWidth, this.topPipe.y);
      rect(this.bottomPipe.x, this.bottomPipe.y, this.pipeWidth, this.screenHeight - this.bottomPipe.y - 50);
      noStroke();
    }
  }
  
  offscreen() {
    return this.topPipe.x + pipeWidth < 0;
  }

  collides(bird) {
    if (bird.currentPos.x + bird.width > this.topPipe.x && bird.currentPos.x < this.topPipe.x + this.pipeWidth) {

      if (bird.currentPos.y <= this.topPipe.y) {
        return true;
      }
      
      // Check collision with bottom pipe
      if (bird.currentPos.y + bird.height >= this.bottomPipe.y) {
        return true;
      }

    }

    return false;
  }
}
