# ChatGPT Integration Guide

This guide explains how to integrate ChatGPT into the WeLeap app's chat components.

## Overview

The integration uses OpenAI's GPT API to power chat interactions in:
- **OnboardingChat**: Chat assistant during onboarding flow
- **FinancialSidekick**: Main chat assistant in the app

## Setup Instructions

### 1. Get OpenAI API Key

1. Go to https://platform.openai.com/
2. Sign up or log in
3. Navigate to API Keys section
4. Create a new API key
5. Copy the key (starts with `sk-`)

### 2. Add Environment Variable

Create or update `.env.local` in the project root:

```bash
OPENAI_API_KEY=sk-your-api-key-here
```

**Important**: Never commit this file to git! It should be in `.gitignore`.

### 3. Install OpenAI SDK (Optional)

For better TypeScript support, you can install the official SDK:

```bash
npm install openai
```

Then uncomment the SDK usage in `app/api/chat/route.ts` and remove the direct fetch implementation.

### 4. Configure API Model

In `app/api/chat/route.ts`, you can choose the model:

- **`gpt-4o-mini`** (recommended): Faster and cheaper, great for most use cases
- **`gpt-4o`**: More capable but more expensive
- **`gpt-3.5-turbo`**: Cheapest option, good for simple queries

## Architecture

### Components

1. **API Route** (`app/api/chat/route.ts`)
   - Handles requests securely on the server
   - Calls OpenAI API with user context
   - Returns AI responses

2. **Chat Service** (`lib/chat/chatService.ts`)
   - Client-side service for making API calls
   - Handles errors gracefully

3. **Chat Components**
   - `components/onboarding/OnboardingChat.tsx` - Updated to use ChatGPT
   - `app/app/components/FinancialSidekick.tsx` - Can be updated similarly

## How It Works

1. User types a message in the chat
2. Message is sent to `/api/chat` with:
   - Conversation history
   - Current page context
   - User's financial data (if available)
3. API route builds a system prompt with context
4. OpenAI API generates a response
5. Response is displayed in the chat

## Cost Considerations

### Pricing (as of 2024)

- **gpt-4o-mini**: ~$0.15 per 1M input tokens, ~$0.60 per 1M output tokens
- **gpt-4o**: ~$2.50 per 1M input tokens, ~$10 per 1M output tokens

### Cost Optimization Tips

1. Use `gpt-4o-mini` for most queries
2. Limit `max_tokens` in API calls (currently set to 500)
3. Keep system prompts concise
4. Consider caching common responses
5. Monitor usage in OpenAI dashboard

## Security

- API keys are stored server-side only
- Never expose API keys in client-side code
- All requests go through Next.js API routes
- Consider adding rate limiting for production

## Testing

1. Start your development server: `npm run dev`
2. Open a page with chat (e.g., onboarding flow)
3. Click the chat button
4. Type a message and verify ChatGPT responds

## Troubleshooting

### "OpenAI API key not configured"
- Check that `.env.local` exists and has `OPENAI_API_KEY`
- Restart your dev server after adding env variables

### "Failed to get response from ChatGPT"
- Check your API key is valid
- Verify you have credits in your OpenAI account
- Check browser console for detailed error messages

### Responses are too long/short
- Adjust `max_tokens` parameter in `route.ts`
- Modify system prompt to request concise responses

## Advanced Features

### Custom Context

You can enhance the system prompt with more user data:

```typescript
userPlanData: {
  monthlyIncome: 5000,
  savingsRate: 0.2,
  debtTotal: 10000,
  goals: ['retirement', 'house'],
  // ... more data
}
```

### Streaming Responses

For better UX, you can implement streaming responses:

1. Use OpenAI's streaming API
2. Update chat component to handle chunks
3. Display partial responses as they arrive

### Conversation Memory

The current implementation sends full conversation history. Consider:
- Summarizing old messages for long conversations
- Using a database to store conversation history
- Implementing conversation sessions

## Next Steps

1. ✅ API route created
2. ✅ Chat service created
3. ✅ OnboardingChat updated
4. ⏳ Update FinancialSidekick component
5. ⏳ Add error handling UI
6. ⏳ Add rate limiting
7. ⏳ Monitor usage and costs

