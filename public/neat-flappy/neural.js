class NeuralNetwork {
  constructor(inputSize, outputSize) {
    this.inputSize = inputSize;
    this.outputSize = outputSize;
    this.weights = [];
    this.xavierInitialization();
  }

  initializeWeights() {
    for (let i = 0; i < this.outputSize; i++) {
      const weights = [];

      for (let j = 0; j < this.inputSize + 1; j++) {
        // add 1 to inputSize for the bias weight
        weights.push(Math.random() * 2 - 1);
      }
      
      this.weights.push(weights);
    }
  }

  xavierInitialization() {
    const variance = 2 / (this.inputSize + this.outputSize);
    const standardDeviation = Math.sqrt(variance);

    this.weights = Array.from({ length: this.outputSize }, () =>
      Array.from({ length: this.inputSize + 1 }, () => Math.random() * standardDeviation)
    );
  }

  predict(inputs) {
    const outputs = [];

    for (let i = 0; i < this.outputSize; i++) {
      let sum = 0;
      for (let j = 0; j < this.inputSize; j++) {
        sum += inputs[j] * this.weights[i][j];
      }
      outputs.push(this.activationFunction(sum));
    }

    return outputs;
  }
  
  activationFunction(x) {
    // sigmoid activation function
    return 1 / (1 + Math.exp(-x));
  }

  crossover(parent, crossoverRate) {
    const child = new NeuralNetwork(this.inputSize, this.outputSize);

    for (let i = 0; i < this.outputSize; i++) {
      for (let j = 0; j < this.inputSize; j++) {
        if (Math.random() < crossoverRate) {
          child.weights[i][j] = parent.weights[i][j];
        } else {
          child.weights[i][j] = this.weights[i][j];
        }
      }
    }

    return child;
  }
  
  mutate(mutationRate) {
    for (let i = 0; i < this.outputSize; i++) {
      for (let j = 0; j < this.inputSize; j++) {
        if (Math.random() < mutationRate) {
          // randomly change the weight
          this.weights[i][j] += Math.random() * 2 - 1;
        }
      }
    }
  }

  isCompatible(otherNetwork) {
    let distance = 0;
    for (let i = 0; i < this.outputSize; i++) {
      for (let j = 0; j < this.inputSize; j++) {
        const weightDiff = this.weights[i][j] - otherNetwork.weights[i][j];
        distance += weightDiff * weightDiff;
      }
    }
    distance = Math.sqrt(distance);
    
    // you can adjust the compatibility threshold as needed
    const compatibilityThreshold = 0.3;
    return distance < compatibilityThreshold;
  }

}
