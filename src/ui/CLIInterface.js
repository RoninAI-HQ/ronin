import readline from 'readline';
import chalk from 'chalk';

export class CLIInterface {
  constructor() {
    this.rl = null;
  }

  initialize() {
    if (!this.rl) {
      this.rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });

      this.rl.on('close', () => {
        this.rl = null;
      });
    }
    return this.rl;
  }

  async getUserInput(promptText = '> ') {
    this.initialize();
    
    return new Promise((resolve, reject) => {
      if (!this.rl) {
        return reject(new Error('Readline interface could not be initialized.'));
      }
      this.rl.question(chalk.green(promptText), (input) => {
        resolve(input);
      });
    });
  }

  close() {
    if (this.rl) {
      this.rl.close();
    }
  }
}