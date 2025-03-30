# VitaAI

VitaAI is an AI-powered platform that helps users analyze workout videos from social media. Extract exercises, techniques, and tips from fitness content to enhance your workout experience.

![VitaAI Logo](/public/platform-thumbnails/default.jpg)

## Features

- **Video Analysis**: Process both short-form and long-form fitness content
- **Smart Extraction**: Automatically identify exercises, techniques, and workout tips
- **Save & Organize**: Store analyzed workouts for future reference
- **Workout Adaptation**: Modify workouts based on your needs with AI assistance
- **Dynamic Coaching**: Get personalized workout guidance through the chat interface

## Getting Started

### Prerequisites

- Node.js 14+ installed
- Python 3.8+ installed
- [yt-dlp](https://github.com/yt-dlp/yt-dlp#installation) installed (for video downloading)

### Frontend Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/VitaAI.git
   cd VitaAI
   ```

2. Install frontend dependencies:
   ```bash
   npm install
   ```

3. Create a `.env.local` file in the root directory:
   ```
   NEXT_PUBLIC_API_URL=http://localhost:8000
   ```

4. Start the development server:
   ```bash
   npm run dev
   ```

5. Open [http://localhost:3000](http://localhost:3000) in your browser

### Backend Setup

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Install Python dependencies:
   ```bash
   pip install -r requirements.txt
   ```

3. Create a `.env` file in the backend directory:
   ```
   OPENAI_API_KEY=your_openai_api_key
   ```

4. Start the FastAPI server:
   ```bash
   cd backend/video_service
   python LangApp.py
   ```

5. Start the WebSocket server for workout chat:
   ```bash
   cd backend/workout_service
   python LangWork.py
   ```

## Project Structure

- **Frontend**
  - `components/`: React components
  - `pages/`: Next.js pages
  - `styles/`: CSS styles
  - `utils/`: Utility functions including API calls
  - `public/`: Static assets

- **Backend**
  - `LangApp.py`: Main FastAPI application for video analysis
  - `LangWork.py`: WebSocket server for workout modification chat
  - `temp_files/`: Temporary directory for video processing

## How It Works

1. **Upload a Video**: Either upload a fitness video file or paste a URL from supported platforms
2. **Analyze Content**: AI processes the video to extract exercises and techniques
3. **Review Results**: View the AI-generated summary of the workout
4. **Save for Later**: Store analyzed workouts in your personal collection
5. **Modify Workouts**: Use the chat feature to adapt workouts to your specific needs

## Technologies Used

- **Frontend**: Next.js, React, TypeScript, Bootstrap
- **Backend**: FastAPI, LangChain, OpenAI
- **Video Processing**: yt-dlp, moviepy
- **Real-time Communication**: WebSockets

## Deployment

For production deployment, follow the standard Next.js deployment procedures as described in the [Next.js documentation](https://nextjs.org/docs/deployment).

For the backend, consider using a production-ready server like Gunicorn with Uvicorn workers.
