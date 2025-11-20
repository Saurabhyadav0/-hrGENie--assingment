const Groq = require("groq-sdk");

function initGroqClient() {
  return new Groq({
    apiKey: process.env.GROQ_API_KEY
  });
}

module.exports = initGroqClient;
