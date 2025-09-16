'use server';
/**
 * @fileOverview A flow for having a conversation with an AI.
 *
 * - continueConversation - A function that continues a conversation with an AI.
 * - AiChatInput - The input type for the continueConversation function.
 * - AiChatOutput - The return type for the continueConversation function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const AiChatInputSchema = z.object({
  message: z.string().describe('The user\'s message.'),
  history: z.array(z.object({
    user: z.string().optional(),
    model: z.string().optional(),
  })).describe('The history of the conversation.'),
});
export type AiChatInput = z.infer<typeof AiChatInputSchema>;

const AiChatOutputSchema = z.object({
  reply: z.string().describe('The AI\'s reply.'),
});
export type AiChatOutput = z.infer<typeof AiChatOutputSchema>;

export async function continueConversation(input: AiChatInput): Promise<AiChatOutput> {
  return continueConversationFlow(input);
}

const prompt = ai.definePrompt({
  name: 'aiChatPrompt',
  input: {schema: AiChatInputSchema},
  output: {schema: AiChatOutputSchema},
  prompt: `You are a helpful AI assistant. Continue the conversation with the user.

  Conversation History:
  {{#each history}}
    {{#if this.user}}User: {{{this.user}}}{{/if}}
    {{#if this.model}}AI: {{{this.model}}}{{/if}}
  {{/each}}

  User: {{{message}}}
  AI:`,
});

const continueConversationFlow = ai.defineFlow(
  {
    name: 'continueConversationFlow',
    inputSchema: AiChatInputSchema,
    outputSchema: AiChatOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
