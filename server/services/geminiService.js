const initGeminiClient = require("../config/gemini");
const logger = require("../utils/logger");

let model;

// Initialize and cache the Gemini model
const getModel = () => {
  if (!model) {
    const client = initGeminiClient();
    model = client.getGenerativeModel({
      model: process.env.GEMINI_MODEL || "gemini-1.5-flash", // FIXED MODEL
    });
  }
  return model;
};

// Generic prompt runner
const runPrompt = async (
  prompt,
  fallback = "Unable to process your request right now."
) => {
  try {
    const result = await getModel().generateContent(prompt);
    return result.response.text().trim();
  } catch (error) {
    logger.error("Gemini error: %s", error.message || error);
    return fallback;
  }
};

// ===== Helper wrappers ======

const grammarCheck = (text) =>
  runPrompt(
    `You are a grammar correction assistant. Fix grammar and return improved text only.\n\nText: ${text}`
  );

const enhanceText = (text) =>
  runPrompt(
    `Improve clarity, tone, and professionalism of the following content. Keep meaning intact.\n\n${text}`
  );

const summarize = (text) =>
  runPrompt(`Summarize the following text in 3 bullet points:\n\n${text}`);

const complete = (text) =>
  runPrompt(`Continue the following passage creatively but concisely:\n\n${text}`);

const suggestions = (text) =>
  runPrompt(`Provide up to 5 content suggestions for the following content:\n\n${text}`);

module.exports = {
  grammarCheck,
  enhanceText,
  summarize,
  complete,
  suggestions,
};
