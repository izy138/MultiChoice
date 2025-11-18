# MultiChoice - AI-Powered Study Practice App

npm start
open index.html

A single-page web application for creating and practicing multiple choice questions with AI-powered spaced repetition ordering. Practice your questions repeatedly with intelligent ordering based on your performance history.

## Features

### 📝 Question Creation
- **Manual Question Input**: Create custom questions with multiple choice answers
- **AI Question Generation**: Convert study material into multiple choice questions using Claude AI
- Flexible option management (add/remove answer choices dynamically)
- Optional explanations for each question

### 🎯 Practice Modes
- **AI-Ordered Practice**: Uses Claude AI to intelligently order questions based on:
  - Performance history (times answered correctly/incorrectly)
  - Time since last practice
  - Spaced repetition principles
- **Original Order Practice**: Practice questions in the order you added them

### 📊 Performance Tracking
- Tracks how many times each question has been answered
- Records accuracy for each question
- Visual feedback with correct/incorrect highlighting
- Score tracking during practice sessions

### 💾 Data Persistence
- All questions and performance data stored locally in browser
- No backend required - everything runs client-side
- Data persists between browser sessions

## Getting Started

### Prerequisites
- A web browser (Chrome, Firefox, Safari, Edge)
- A Claude API key from [Anthropic Console](https://console.anthropic.com/)

### Installation

#### Option 1: With Backend Proxy (Recommended - Required for AI Features)

Due to CORS restrictions, the Anthropic API cannot be called directly from the browser. You need to run a simple proxy server.

1. **Install Node.js** (if not already installed) from [nodejs.org](https://nodejs.org/)

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Start the proxy server:**
   ```bash
   npm start
   ```
   The server will run on `http://localhost:3001`

4. **Open the frontend:**
   - Open `index.html` in your web browser, or
   - Use a local web server: `python -m http.server 3000` then visit `http://localhost:3000`

**Important**: The proxy server must be running for AI features (question generation and ordering) to work.

#### Option 2: Manual Questions Only

If you only want to use manual question input without AI features, you can:
1. Open `index.html` directly in your browser
2. Manual questions and practice will work without the server
3. AI features will show errors (which you can ignore if not using them)

## Usage Guide

### Initial Setup

1. **Enter Your API Key**
   - Click "Save API Key" after entering your Claude API key
   - Your API key is stored locally in your browser
   - Get your API key from [console.anthropic.com](https://console.anthropic.com/)

### Creating Questions

#### Option 1: Manual Input
1. Click "Manually Add Questions"
2. Enter your question text
3. Add answer choices (minimum 2, add more as needed)
4. Select the correct answer using the radio button
5. Optionally add an explanation
6. Click "Save Question"
7. Repeat to add more questions

#### Option 2: AI Generation
1. Click "Generate Questions from Text"
2. Paste your study material (notes, textbook content, etc.)
3. Click "Generate Multiple Choice Questions"
4. AI will create 5-10 questions from your material
5. Review and start practicing

### Practicing Questions

#### With AI Ordering (Recommended)
1. Click "Practice with AI Ordering" on the home screen
2. The AI analyzes your performance history and orders questions optimally
3. Answer each question and view feedback
4. Continue through all questions
5. View your results at the end

#### In Original Order
1. Click "Practice in Original Order" on the home screen
2. Questions appear in the order you added them
3. Answer and review feedback
4. Performance is still tracked for future AI ordering

### Understanding the Practice Session

- **Question Counter**: Shows current question number and total
- **Progress Bar**: Visual indicator of your progress
- **Performance Stats**: For manually created questions, see how many times you've answered and your accuracy
- **Answer Feedback**: 
  - ✅ Green highlight for correct answers
  - ❌ Red highlight for incorrect answers
  - Explanations shown after submission

### Reviewing Results

After completing a practice session:
- View your overall score and percentage
- Choose to practice again (with re-ordering for manual questions)
- Create new questions
- Return to the home screen

## How AI Ordering Works

The AI ordering feature uses your performance data to prioritize questions:

1. **Questions you've answered incorrectly more often** are shown first
2. **Questions you haven't practiced recently** get priority
3. **Spaced repetition timing** is considered based on when you last reviewed each question
4. The ordering adapts as you practice more, focusing on areas that need improvement

This creates an optimal learning experience that helps you focus on what you need to review most.

## Technical Details

### Technology Stack

**Frontend:**
- **React 18**: UI framework (loaded via CDN)
- **Tailwind CSS**: Styling (via CDN)
- **Babel Standalone**: JSX transformation (via CDN)
- **LocalStorage**: Client-side data persistence

**Backend (Required for AI features):**
- **Node.js/Express**: Proxy server to handle Anthropic API calls
- **CORS**: Enables cross-origin requests from browser
- **Claude API**: AI-powered question generation and ordering (via proxy)

### Why a Proxy Server?

The Anthropic API doesn't support CORS (Cross-Origin Resource Sharing) from browsers directly. This is a security measure to prevent API keys from being exposed in client-side code. The proxy server:

1. Receives requests from your browser
2. Forwards them to Anthropic API with your API key (stays on server)
3. Returns the response back to your browser

This keeps your API key secure on the server side.

### Data Storage

All data is stored in your browser's localStorage:
- `claudeApiKey`: Your API key (optional, not encrypted)
- `questions`: AI-generated questions
- `manualQuestions`: Manually created questions with performance data

**Note**: Data is stored locally in your browser. Clearing browser data will remove all questions and performance history.

### Browser Compatibility

Works in all modern browsers:
- Chrome (recommended)
- Firefox
- Safari
- Edge

## API Key Security

⚠️ **Important**: Your API key is stored in browser localStorage and not encrypted. For maximum security:
- Don't share your browser or computer access
- Use a dedicated API key for this app if possible
- Review your API usage in the Anthropic Console regularly

## Limitations

- Single-page application - no server-side storage
- Data limited to browser localStorage (~5-10MB depending on browser)
- Requires internet connection for AI features (API calls)
- API key required for AI-powered features

## Future Enhancements

Potential features for future versions:
- Export/import questions (JSON format)
- Different question types (true/false, fill-in-the-blank)
- Study decks/sets of questions
- Detailed analytics and progress charts
- Custom spaced repetition intervals
- Offline mode with basic functionality

## Troubleshooting

### CORS Error / "Failed to fetch" Error
**Problem**: You see CORS errors in the browser console when trying to use AI features.

**Solution**: 
1. Make sure the proxy server is running (`npm start`)
2. Check that the server is running on `http://localhost:3001`
3. Verify your frontend is calling the correct proxy URL
4. If using a different port, update `API_BASE_URL` in `index.html`

### API Key Not Working
- Verify your API key is correct in the Anthropic Console
- Check your API key has sufficient credits
- Ensure you're using the correct format (starts with `sk-ant-`)
- Make sure the proxy server is running

### Questions Not Saving
- Check browser localStorage is enabled
- Clear browser cache and try again
- Ensure you're not in private/incognito mode (localStorage may be limited)

### AI Ordering Not Available
- Ensure you have questions saved
- Check your API key is entered and saved
- Verify the proxy server is running
- Check internet connection for API calls

### Proxy Server Won't Start
- Ensure Node.js is installed (`node --version`)
- Run `npm install` to install dependencies
- Check if port 3001 is already in use
- Try changing the port in `server.js` (update both server.js and index.html)

## License

This project is open source. Feel free to use, modify, and distribute as needed.

## Support

For issues or questions:
- Check the troubleshooting section above
- Review browser console for error messages
- Verify API key and internet connection

---

**Happy Studying!** 🎓📚

