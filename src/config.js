require('dotenv').config({ path: require('path').resolve(process.cwd(), '.env') });

const apiKey = process.env.ANTHROPIC_API_KEY;

if (!apiKey) {
  console.error(
    'Error: ANTHROPIC_API_KEY not found. Please create a .env file in the project root with your API key (e.g., ANTHROPIC_API_KEY=your_key_here)'
  );
  process.exit(1); // Exit if API key is not found
}

module.exports = {
  apiKey,
}; 