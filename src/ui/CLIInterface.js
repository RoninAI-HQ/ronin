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

  async askConfirmation(message) {
    // Ensure we're on a new line and preserve any previous output
    process.stdout.write('\n');

    this.initialize();

    return new Promise((resolve, reject) => {
      if (!this.rl) {
        return reject(new Error('Readline interface could not be initialized.'));
      }
      const prompt = `${chalk.yellow(message)} ${chalk.cyan('[y/N]: ')}`;
      this.rl.question(prompt, (input) => {
        const answer = input.trim().toLowerCase();
        resolve(answer === 'y' || answer === 'yes');
      });
    });
  }

  async askConfirmationWithRemember(message) {
    // Ensure we're on a new line and preserve any previous output
    process.stdout.write('\n');

    this.initialize();

    return new Promise((resolve, reject) => {
      if (!this.rl) {
        return reject(new Error('Readline interface could not be initialized.'));
      }
      const prompt = `${chalk.yellow(message)} ${chalk.cyan('[y/n/a (always)]: ')}`;
      this.rl.question(prompt, (input) => {
        const answer = input.trim().toLowerCase();
        resolve({
          approved: answer === 'y' || answer === 'yes' || answer === 'a' || answer === 'always',
          remember: answer === 'a' || answer === 'always'
        });
      });
    });
  }

  close() {
    if (this.rl) {
      this.rl.close();
    }
  }
}