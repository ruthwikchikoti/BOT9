# LuxeStay Booking Assistant
https://drive.google.com/file/d/15insPujHZ4b2ASNNcK5nMHFlQiy1RCVR/view
## Project Description

LuxeStay Booking Assistant is a chatbot application designed to help users book rooms at the LuxeStay resort. The project consists of a backend server built with Express.js and a frontend React application. The chatbot uses OpenAI's GPT-3.5-turbo model to provide intelligent responses and assist users throughout the booking process.

## Features

- Interactive chat interface for room bookings
- Integration with OpenAI's GPT-3.5-turbo for natural language processing
- Real-time room availability checking
- Automated email confirmation for bookings
- Persistent chat history using SQLite database
- Responsive design for various screen sizes

## Technologies Used

- Backend:
  - Node.js
  - Express.js
  - Sequelize (ORM)
  - SQLite
  - OpenAI API
  - Nodemailer for email sending
  - Axios for HTTP requests

- Frontend:
  - React.js
  - CSS for styling
  - React Markdown for rendering markdown content
  - Font Awesome for icons
  - UUID for generating unique session IDs

## Setup and Installation

1. Clone the repository:
git clone https://github.com/ruthwikchikoti/BOT9
cd luxestay-booking-assistant

2. Install dependencies for both backend and frontend:
Install backend dependencies
cd backend
npm install
Install frontend dependencies
cd ../frontend
npm install

3. Set up environment variables:
Create a `.env` file in the backend directory with the following variables:
    - SMTP_HOST=your_smtp_host
    - SMTP_PORT=your_smtp_port
    - SMTP_USER=your_smtp_username
    - SMTP_PASS=your_smtp_password
    - FROM_EMAIL=your_from_email
    - OPENAI_API_KEY=your_openai_api_key
    - SERVER_PORT=3000

4. Start the backend server:
cd backend
npm start

5. Start the frontend development server:
cd frontend
npm start

6. Open your browser and navigate to `http://localhost:3000` to use the application.

## Usage

1. Open the chat interface in your web browser.
2. Start a conversation with the booking assistant by asking about room availability or booking options.
3. Follow the assistant's prompts to select a room and provide booking details.
4. Confirm your booking and receive a confirmation message and email.
