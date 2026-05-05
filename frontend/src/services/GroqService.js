/**
 * GroqService
 * This service communicates with the Groq API to provide J.A.R.V.I.S with a brain.
 * It uses the Llama-3.1 model for fast and intelligent responses.
 */
const GROQ_API_KEY = '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';
const API_URL = 'https://api.groq.com/openai/v1/chat/completions';

const GroqService = {
  /**
   * askJarvis
   * Sends a user prompt to Groq and returns the AI's response.
   */
  async askJarvis(userPrompt) {
    if (!userPrompt) return null;

    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${GROQ_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'llama-3.1-8b-instant',
          messages: [
            {
              role: 'system',
              content: 'You are J.A.R.V.I.S., a highly intelligent, witty, and helpful AI assistant. You are polite, efficient, and slightly sarcastic but always professional. Your responses should be concise and optimized for voice-to-text communication. Use your unique personality in every response.'
            },
            {
              role: 'user',
              content: userPrompt
            }
          ],
          temperature: 0.7,
          max_tokens: 500
        })
      });

      const data = await response.json();
      return data.choices[0]?.message?.content || "I'm sorry, I encountered a neural glitch.";
    } catch (error) {
      console.error('Groq API Error:', error);
      return "I'm having trouble reaching my core processors at the moment.";
    }
  }
};

export default GroqService;
