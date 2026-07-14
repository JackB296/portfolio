class NEAT {
  constructor(populationSize, inputSize, outputSize, stagnationThreshold) {
    this.populationSize = populationSize;
    this.inputSize = inputSize;
    this.outputSize = outputSize;
    this.stagnationThreshold = stagnationThreshold;
    this.population = [];
    this.species = [];
  }

  initializePopulation() {
    for (let i = 0; i < this.populationSize; i++) {
      const neuralNetwork = new NeuralNetwork(this.inputSize, this.outputSize);
      this.population.push(neuralNetwork);
      this.addToSpecies(neuralNetwork);
    }
  }

  addToSpecies(neuralNetwork) {
    for (let species of this.species) {
      if (neuralNetwork.isCompatible(species.individuals[0])) {
        species.individuals.push(neuralNetwork);
        return;
      }
    }
    this.species.push({ individuals: [neuralNetwork], bestFitness: 0, generation: 0 });
  }
   
  resetAgents() {
    this.population.forEach(agent => {
      if(!agent.bird) {
        agent.fitness = 0;
        agent.bird = new Bird();
        agent.dead = false;
      } else {
        agent.fitness = 0;
        agent.dead = false;
        agent.bird.reset();
      }
    });
  }
    
  areAllDead() {
    return this.population.every(agent => agent.dead === true);
  }
    
  performNaturalSelection(mutationRate, crossoverRate) {
    // Update best fitness and generation for each species
    console.log(this.species);
    for (let i = 0; i < this.species.length; i++) {
      const sortedSpecies = this.species[i].individuals.sort((a, b) => b.fitness - a.fitness);
      const fittestIndividual = sortedSpecies[0];
        
      // If this is the first generation or if the species improved, update bestFitness and reset generation
      if (!this.species[i].bestFitness || fittestIndividual.fitness > this.species[i].bestFitness) {
        this.species[i].bestFitness = fittestIndividual.fitness;
        this.species[i].generation = 0;
      } else {
        this.species[i].generation++;
      }

      const nextGeneration = [];
      nextGeneration.push(fittestIndividual); // elitism, survival of the fittest
      
      // crossover and mutation to create the rest of the population
      while (nextGeneration.length < sortedSpecies.length) {
        const parentA = this.selectParent(sortedSpecies);
        const parentB = this.selectParent(sortedSpecies);
        
        const child = parentA.crossover(parentB, crossoverRate);
        child.mutate(mutationRate);
        
        nextGeneration.push(child);
      }

      this.species[i].individuals = nextGeneration;
    }
      

    this.species = this.species.filter(species => species.generation < this.stagnationThreshold);

    if (this.species.length === 0) {
      this.initializePopulation();
      this.resetAgents();
      return;
    }
    
    this.population = [];
    for (let species of this.species) {
      for (let individual of species.individuals) {
        individual.fitness /= species.length;
        this.population.push(individual);
      }
    }
  }
    
  selectParent(sortedPopulation) {
    // select a parent using tournament selection
    const tournamentSize = 5;
    let bestFitness = -Infinity;
    let bestIndividual = null;

    for (let i = 0; i < tournamentSize; i++) {
      const randomIndex = Math.floor(Math.random() * sortedPopulation.length);
      const individual = sortedPopulation[randomIndex];

      if (individual.fitness > bestFitness) {
        bestFitness = individual.fitness;
        bestIndividual = individual;
      }
    }

    return bestIndividual;
  }
}
