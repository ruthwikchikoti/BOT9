const express = require('express');
const cors = require('cors');
const { OpenAI } = require('openai');
const { Sequelize, DataTypes } = require('sequelize');
const nodemailer = require('nodemailer');
const axios = require('axios');

require('dotenv').config();

console.log('Environment variables:', {
  SMTP_HOST: process.env.SMTP_HOST,
  SMTP_PORT: process.env.SMTP_PORT,
  SMTP_USER: process.env.SMTP_USER,
  SMTP_PASS: process.env.SMTP_PASS ? 'SET' : 'NOT SET',
  FROM_EMAIL: process.env.FROM_EMAIL,
  OPENAI_API_KEY: process.env.OPENAI_API_KEY ? 'SET' : 'NOT SET',
  SERVER_PORT: process.env.SERVER_PORT
});

if (!process.env.SMTP_HOST || !process.env.SMTP_PORT || !process.env.OPENAI_API_KEY || !process.env.SERVER_PORT) {
  console.error('Missing required environment variables. Please check your .env file.');
  process.exit(1);
}

const app = express();
app.use(cors());
app.use(express.json());

app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: './chat_history.sqlite'
});

const Chat = sequelize.define('Chat', {
  sessionId: DataTypes.STRING,
  message: DataTypes.TEXT,
  role: DataTypes.STRING
});

sequelize.sync();

let transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  },
  tls: {
    rejectUnauthorized: false
  }
});

transporter.verify(function(error, success) {
  if (error) {
    console.error('SMTP connection error:', error);
  } else {
    console.log("SMTP server is ready to take our messages");
  }
});

const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;

async function sendEmailWithRetry(msg, retries = 0) {
  try {
    const info = await transporter.sendMail(msg);
    console.log('Email sent successfully. MessageId:', info.messageId);
    return true;
  } catch (error) {
    console.error(`Error sending email (attempt ${retries + 1}):`, error);
    if (retries < MAX_RETRIES) {
      console.log(`Retrying in ${RETRY_DELAY}ms... (${retries + 1}/${MAX_RETRIES})`);
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
      return sendEmailWithRetry(msg, retries + 1);
    }
    return false;
  }
}

async function sendBookingConfirmationEmail(booking) {
  const msg = {
    from: process.env.FROM_EMAIL,
    to: booking.email,
    subject: 'Booking Confirmation',
    text: `Dear ${booking.fullName},

Thank you for booking a room at our hotel. Here are your booking details:

Room ID: ${booking.roomId}
Number of nights: ${booking.nights}
Booking ID: ${booking.bookingId}
Total cost: $${booking.totalPrice}
Room type: ${booking.roomName || 'Not specified'}

We look forward to welcoming you!

Best regards,
Hotel Booking Team`
  };

  console.log('Attempting to send email to:', booking.email);
  return sendEmailWithRetry(msg);
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const systemPrompt = `
You are a helpful hotel booking assistant for LuxeStay's. Your role is to assist users in booking rooms at our resort. Here's how you should behave:

1. Be friendly, professional, and use emojis occasionally to engage users.
2. Use the 'get_room_options' function to display available rooms when asked.
3. Help users choose a room and specify the number of nights for their stay.
4. Use the 'book_room' function to finalize bookings with user-provided details.
5. Provide clear, concise responses and confirm booking details before proceeding.
6. Inform users that a confirmation email will be sent after booking.
7. Do not expose function names or technical details to users.
8. Switch to the user's preferred language if requested.
9. Always provide a formatted booking confirmation immediately after the user completes their booking by providing their name and email.
10. When the user provides their full name and email, immediately make a 'book_room' function call with all the necessary details.

Remember, your main goal is to help users book rooms efficiently and pleasantly.
`;

app.post('/chat', async (req, res) => {
  const { message, sessionId } = req.body;

  if (!sessionId) {
    return res.status(400).json({ error: 'sessionId is required' });
  }

  try {
    await Chat.create({ sessionId, message, role: 'user' });

    const history = await Chat.findAll({
      where: { sessionId },
      order: [['createdAt', 'ASC']]
    });

    const messages = history.map(chat => ({
      role: chat.role,
      content: chat.message
    }));

    messages.unshift({
      role: 'system',
      content: systemPrompt
    });

    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: messages,
      functions: [
        {
          name: "get_room_options",
          description: "Get available room options",
          parameters: {
            type: "object",
            properties: {},
            required: []
          }
        },
        {
          name: "book_room",
          description: "Book a room",
          parameters: {
            type: "object",
            properties: {
              roomId: { type: "integer" },
              fullName: { type: "string" },
              email: { type: "string" },
              nights: { type: "integer" }
            },
            required: ["roomId", "fullName", "email", "nights"]
          }
        }
      ],
      function_call: "auto"
    });

    console.log("OpenAI API response:", JSON.stringify(completion.choices[0], null, 2));

    let responseMessage = completion.choices[0].message;

    if (responseMessage.function_call) {
      if (responseMessage.function_call.name === "get_room_options") {
        console.log("Entering get_room_options function");
        try {
          const roomsResponse = await axios.get('https://bot9assignement.deno.dev/rooms');
          const rooms = roomsResponse.data;
          console.log("Rooms API response:", rooms);
          
          const roomsMarkdown = rooms.map(room => (
            `### ${room.name}\n` +
            `**Description:** ${room.description}\n` +
            `**Price:** $${room.price} per night\n`
          )).join('\n');

          const formattedResponse = 
            "Here are our available room options:\n\n" +
            roomsMarkdown +
            "\nWhich room would you like to book? Please let me know the room name and the number of nights you'd like to stay.";

          responseMessage = { role: 'assistant', content: formattedResponse };
        } catch (error) {
          console.error("Error fetching room options:", error);
          responseMessage = { role: 'assistant', content: "I'm sorry, there was an error fetching room options. Please try again later." };
        }
      } else if (responseMessage.function_call.name === "book_room") {
        console.log("Entering book_room function");
        try {
          const bookingDetails = JSON.parse(responseMessage.function_call.arguments);
          console.log("Booking details:", bookingDetails);

          const bookingResponse = await axios.post('https://bot9assignement.deno.dev/book', bookingDetails, {
            headers: { 'Content-Type': 'application/json' }
          });
          console.log("Booking API response status:", bookingResponse.status);

          const booking = bookingResponse.data;
          console.log("Booking API response:", booking);

          const bookingId = booking.bookingId || Math.floor(100000 + Math.random() * 900000);

          const formattedConfirmation = `
Booking Confirmation
--------------------
Booking ID: ${bookingId}
Room Type: ${booking.roomName}
Number of Nights: ${bookingDetails.nights}
Total Price: $${booking.totalPrice}
Full Name: ${bookingDetails.fullName}
Email: ${bookingDetails.email}

Thank you for choosing LuxeStay! A confirmation email will be sent to your provided email address.

If you need any further assistance or have any questions, please don't hesitate to ask.
          `;

          console.log("Formatted confirmation:", formattedConfirmation);
          responseMessage = { role: 'assistant', content: formattedConfirmation };

          try {
            const emailSent = await sendBookingConfirmationEmail({
              ...booking,
              ...bookingDetails,
              bookingId: bookingId,
              id: bookingId
            });
            if (!emailSent) {
              console.error('Failed to send confirmation email after multiple attempts');
              responseMessage.content += "\n\nNote: There was an issue sending the confirmation email. Please keep this booking confirmation for your records.";
            }
          } catch (emailError) {
            console.error("Error in email sending process:", emailError);
            responseMessage.content += "\n\nNote: There was an issue sending the confirmation email. Please keep this booking confirmation for your records.";
          }
        } catch (error) {
          console.error("Error in book_room function:", error);
          responseMessage = { role: 'assistant', content: "I'm sorry, there was an error while trying to book your room. Please try again or contact our support team." };
        }
      }
    }

    await Chat.create({ sessionId, message: responseMessage.content, role: 'assistant' });

    res.json({ message: responseMessage.content });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'An error occurred' });
  }
});

const SERVER_PORT = process.env.SERVER_PORT || 3000;
app.listen(SERVER_PORT, () => console.log(`Server running on port ${SERVER_PORT}`));