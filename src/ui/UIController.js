import chalk from 'chalk';
import { Spinner } from 'cli-spinner';

export class UIController {
  constructor() {
    this.spinner = new Spinner('%s ');
    this.spinner.setSpinnerString(18);
  }

  displayWelcome() {
    console.log(chalk.yellow("Welcome to Ronin CLI! Type '/help' for a list of commands, '/exit' or '/quit' to end the chat, '/save' to save conversation, '/load' to load a conversation, '/new' to start a new one (saves current), or '/clear' to clear screen."));
  }

  displayMessage(message) {
    console.log(chalk.yellow(message));
  }

  displayError(message) {
    console.error(chalk.red(message));
  }

  displayAssistantPrefix() {
    process.stdout.write(chalk.hex('#888')('Ronin: '));
  }

  streamAssistantResponse(chunk) {
    process.stdout.write(chalk.cyan(chunk));
  }

  displayNewLine() {
    console.log("");
  }

  displayList(title, items) {
    console.log(chalk.yellow(title));
    items.forEach(item => console.log(chalk.white(`  ${item}`)));
  }

  clearScreen() {
    console.clear();
  }

  showSpinner() {
    this.spinner.start();
  }

  hideSpinner() {
    this.spinner.stop(true);
  }

  displayCommandResult(result) {
    switch (result.type) {
      case 'help':
      case 'success':
      case 'info':
        this.displayMessage(result.message);
        if (result.additionalMessage) {
          this.displayMessage(result.additionalMessage);
        }
        break;
      case 'error':
        this.displayError(result.message);
        break;
      case 'list':
        this.displayList(result.message, result.items);
        break;
      case 'clear':
        this.clearScreen();
        this.displayMessage(result.message);
        break;
      case 'new':
        this.clearScreen();
        this.displayMessage(result.message);
        break;
      case 'exit':
        this.displayMessage('Exiting Claude CLI. Goodbye!');
        break;
    }
  }
}