const express = require('express');
const cors = require('cors');
const { OpenAI } = require('openai');
const { Sequelize, DataTypes } = require('sequelize');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
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

const systemPrompt = `
You are a helpful hotel booking assistant for LuxeStay's. Your role is to assist users in booking rooms at our resort. Here's how you should behave:
1. Welcome the user and ask how you can assist with their room booking.
2. If the user prefers another language, switch to that language if possible.
3. When asked about room options, use the 'get_room_options' function to retrieve and display the available rooms.
4. Provide information on room amenities, prices, and availability when requested.
5. Ask the user which type of room they would like to book and for how many nights.
6. Calculate and display the total cost for the requested number of nights.
7. Summarize the booking details, including the total price, and ask the user to confirm.
8. If the user confirms, request their full name and email address to complete the booking.
9. Use the 'book_room' function to finalize the booking with the provided details.
10. Inform the user that a booking confirmation will be sent to their email address.
11. Always be courteous, professional, and helpful.
12. If you lack certain information, politely inform the user and offer to find out.
13. Conclude conversations by thanking the user and asking if there's anything else you can assist with.
14. Reference all functions and sources used during the conversation.
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

    let responseMessage = completion.choices[0].message;

    if (responseMessage.function_call) {
      if (responseMessage.function_call.name === "get_room_options") {
        const roomsResponse = await fetch('https://bot9assignement.deno.dev/rooms');
        const rooms = await roomsResponse.json();
        
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
      } else if (responseMessage.function_call.name === "book_room") {
        const bookingDetails = JSON.parse(responseMessage.function_call.arguments);
        const bookingResponse = await fetch('https://bot9assignement.deno.dev/book', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(bookingDetails)
        });
        const booking = await bookingResponse.json();

        const mailOptions = {
          from: process.env.EMAIL_USER,
          to: bookingDetails.email,
          subject: 'LuxeStay Booking Confirmation',
          text: `Dear ${bookingDetails.fullName},

Thank you for booking with LuxeStay!

Your booking details:
Room ID: ${bookingDetails.roomId}
Number of nights: ${bookingDetails.nights}
Total cost: $${booking.totalCost}

We look forward to welcoming you to LuxeStay!

Best regards,
The LuxeStay Team`
        };

        transporter.sendMail(mailOptions, (error, info) => {
          if (error) {
            console.log('Error sending email:', error);
          } else {
            console.log('Email sent:', info.response);
          }
        });

        responseMessage = {
          role: 'assistant',
          content: JSON.stringify({...booking, emailSent: true})
        };
      }
    }

    await Chat.create({ sessionId, message: responseMessage.content, role: 'assistant' });

    res.json({ message: responseMessage.content });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'An error occurred' });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));