const { GoogleGenerativeAI } = require("@google/generative-ai");

module.exports = function initGeminiClient() {
  console.log("🔥 Gemini initialized with API version: v1");
  return new GoogleGenerativeAI(process.env.GEMINI_API_KEY, {
    apiVersion: "v1",
  });
};
