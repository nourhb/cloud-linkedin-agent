/** Common interface implemented by both the real Gemini client and the mock client. */
export interface AiClient {
  /**
   * Sends the system + user prompt to the model and returns the raw JSON
   * text response (not yet parsed/validated - that happens in postGenerator).
   */
  generateJson(systemPrompt: string, userPrompt: string): Promise<string>;
}
