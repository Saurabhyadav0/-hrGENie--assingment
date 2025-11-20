const initGroqClient = require("../config/groq");
const logger = require("../utils/logger");

// Define a constant for the model name, falling back to the supported stable version.
// It's best practice to define this in an environment variable (e.g., in your .env file).
const GROQ_MODEL ="llama-3.1-8b-instant";

let client;

const getClient = () => {
  if (!client) {
    // This assumes initGroqClient handles client initialization, including API key loading.
    client = initGroqClient();
  }
  return client;
};

/**
 * Executes a prompt against the configured GROQ model.
 * @param {string} prompt - The user's prompt text.
 * @param {string} fallback - A message to return on error.
 * @returns {Promise<string>} The model's response or the fallback message.
 */
const runPrompt = async (
  prompt,
  fallback = "Unable to process your request right now."
) => {
  try {
    const response = await getClient().chat.completions.create({
      // 🚨 FIX APPLIED: Using the stable model name
      model: GROQ_MODEL, // e.g., "llama3-8b-8192" or "mixtral-8x7b-32768"
      messages: [{ role: "user", content: prompt }],
      temperature: 0.4,
    });

    return response.choices[0]?.message?.content?.trim() || fallback;
  } catch (error) {
    // Log the error for debugging
    logger.error("GROQ error: %s", error.message);
    return fallback;
  }
};

// --- Helper wrappers for specific tasks ---

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
  runPrompt, // Exporting runPrompt for direct use if needed
};