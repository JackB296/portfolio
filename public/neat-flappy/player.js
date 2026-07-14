const jump = -6;

class Bird {
  constructor(){
    this.width = 40;
    this.height = 30;

    this.currentPos = createVector(50,100);
    this.currentSpeed = createVector(0,0);
    this.onGround = false;
    this.dead = false;

    this.distanceToGapCenter = 0;
    this.gravity = 0;
	  this.velocity = 0.3;

    this.distanceTraveled = 0;
  }

  reset(){
    this.currentPos.x = 50
    this.currentPos.y = 100
    this.currentSpeed.y = 0;
    this.onGround = false;
    this.dead = false;
    this.distanceTraveled = 0;
    this.gravity = 0;
	  this.velocity = 0.3;
    this.distanceToGapCenter = 0;
  }

  update() {
    if(this.currentPos.y >= height - 80 || this.currentPos.y < 0) {
        this.onGround = true;
        this.dead = true;
        return;
    }
    this.applyGravity();
  }

  jump() {
    if (this.currentPos.y > 6) {
      this.gravity = jump;
    }
  }

  applyGravity() {
    this.gravity += this.velocity;
	  this.currentPos.y += this.gravity;
  } 

  show(birdImage, debugMode) {
    image(birdImage, this.currentPos.x, this.currentPos.y, this.width, this.height);
    
    if (debugMode) {
      noFill();
      stroke(255, 0, 0); // Red color
      rect(this.currentPos.x, this.currentPos.y, this.width, this.height);
      noStroke();
    }
  }
}
