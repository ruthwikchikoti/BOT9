import React, { useState, useEffect, useRef } from 'react';
import './SimpleChatbot.css';
import ReactMarkdown from 'react-markdown';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faRobot } from '@fortawesome/free-solid-svg-icons';
import { v4 as uuidv4 } from 'uuid';

const SimpleChatbot = () => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [sessionId, setSessionId] = useState('');
  const messagesEndRef = useRef(null);

  useEffect(() => {
    const newSessionId = localStorage.getItem('chatSessionId') || uuidv4();
    setSessionId(newSessionId);
    localStorage.setItem('chatSessionId', newSessionId);
    addMessage("Welcome to LuxeStay. How may I assist you with your booking today?", false);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const addMessage = (content, isUser) => {
    setMessages(prev => [...prev, { content, isUser, timestamp: new Date() }]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (input.trim()) {
      addMessage(input, true);
      setInput('');
      setIsTyping(true);

      try {
        console.log('Sending request with sessionId:', sessionId);
        const response = await fetch('http://localhost:3000/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ message: input, sessionId }),
        });

        console.log('Response status:', response.status);
        const responseText = await response.text();
        console.log('Response text:', responseText);

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = JSON.parse(responseText);
        setIsTyping(false);
        addMessage(data.message, false);
      } catch (error) {
        console.error('Error:', error);
        setIsTyping(false);
        addMessage(`An error occurred: ${error.message}. Please try again or check your connection.`, false);
      }
    }
  };

  const formatTime = (date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="chatbot-container">
      <div className="chat-header">
        <FontAwesomeIcon icon={faRobot} className="bot-icon" />
        <h2>LuxeStay Booking Assistant</h2>
      </div>
      <div className="messages-container">
        {messages.map((msg, index) => (
          <div key={index} className={`message ${msg.isUser ? 'user' : 'bot'}`}>
            <div className="message-content">
              {msg.isUser ? msg.content : <ReactMarkdown>{msg.content}</ReactMarkdown>}
            </div>
            <div className="message-time">{formatTime(msg.timestamp)}</div>
          </div>
        ))}
        {isTyping && (
          <div className="message bot">
            <div className="typing-indicator">
              <span></span>
              <span></span>
              <span></span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
      <form onSubmit={handleSubmit} className="input-area">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type your message here..."
        />
        <button type="submit">
          <svg viewBox="0 0 24 24" width="24" height="24">
            <path fill="currentColor" d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"></path>
          </svg>
        </button>
      </form>
    </div>
  );
};

export default SimpleChatbot;