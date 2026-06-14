import Groq from 'groq-sdk';
import { hybridSearch, generateCampaignVariants } from './rag.service.js';

let _groq: Groq | null = null;
function getGroq(): Groq {
  if (!_groq) {
    _groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
  }
  return _groq;
}

const SYSTEM_PROMPT = `
You are an expert CRM AI Assistant.
You have access to tools to query audiences and draft campaigns.

CRITICAL INSTRUCTION FOR CAMPAIGN CREATION: 
When creating a campaign, wait until you receive the tool response containing the segmentQuery, variants, and audienceSize. 
THEN, you MUST output your final response using EXACTLY this syntax. Do not wrap the JSON in markdown code blocks.

[CAMPAIGN_PROPOSAL: { "name": "...", "goal": "...", "segmentQuery": {...}, "audienceSize": 123, "variants": [...] } ]
`;

const tools = [
  {
    type: "function",
    function: {
      name: "query_audience",
      description: "Query the CRM database to find the size of a specific audience segment using natural language. Use this to analyze a segment before creating a campaign.",
      parameters: {
        type: "object",
        properties: {
          segmentDescription: {
            type: "string",
            description: "Natural language description of the audience segment (e.g., 'high LTV customers who haven't purchased in 30 days')",
          },
        },
        required: ["segmentDescription"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_campaign",
      description: "Draft a new campaign. This stages the campaign variants but does NOT save them. You must use the returned data to format your final CAMPAIGN_PROPOSAL tag.",
      parameters: {
        type: "object",
        properties: {
          name: {
            type: "string",
            description: "A short, catchy name for the campaign",
          },
          goal: {
            type: "string",
            description: "The primary objective of the campaign (e.g., 're-engagement', 'upsell')",
          },
          segmentDescription: {
            type: "string",
            description: "A detailed natural language description of the target audience segment",
          },
        },
        required: ["name", "goal", "segmentDescription"],
      },
    },
  },
];

export async function processChat(messages: any[]) {
  // Ensure system prompt is first
  const chatMessages = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...messages.filter(m => m.role !== 'system')
  ];

  try {
    let response = await getGroq().chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: chatMessages,
      tools: tools,
      tool_choice: "auto",
      max_tokens: 4096
    });

    const firstChoice = response.choices?.[0];
    if (!firstChoice) {
      throw new Error("Groq API returned an empty or invalid response.");
    }
    
    let responseMessage = firstChoice.message;

    // Handle tool calls
    while (responseMessage.tool_calls && responseMessage.tool_calls.length > 0) {
      chatMessages.push(responseMessage); // Add assistant's tool call request

      for (const toolCall of responseMessage.tool_calls) {
        const functionName = toolCall.function.name;
        const functionArgs = JSON.parse(toolCall.function.arguments);
        let functionResponse = '';

        if (functionName === 'query_audience') {
          const { segmentDescription } = functionArgs;
          const searchResult = await hybridSearch({}, segmentDescription);
          
          // Only return audienceSize and a small sample of 5 digital twins (HITL Constraint)
          functionResponse = JSON.stringify({
            audienceSize: searchResult.audienceSize,
            sampleTwins: searchResult.shoppers.slice(0, 5).map((s: any) => ({
              customerId: s.customerId,
              firstName: s.firstName,
              summary: s.summary
            }))
          });
        } 
        else if (functionName === 'create_campaign') {
          const { name, goal, segmentDescription } = functionArgs;
          
          // 1. Fetch small sample
          const searchResult = await hybridSearch({}, segmentDescription);
          const sampleTwins = searchResult.shoppers.slice(0, 5).map((s: any) => ({
            customerId: s.customerId,
            firstName: s.firstName,
            summary: s.summary
          }));

          // 2. Generate variants
          const { variants } = await generateCampaignVariants(segmentDescription, goal);
          
          // 3. Construct segmentQuery
          const segmentQuery = {
            isSemantic: true,
            filters: {},
            semanticQuery: segmentDescription
          };

          // 4. Return the staging payload to the LLM (does not save to DB)
          // Include name and goal so LLM can easily format the tag
          functionResponse = JSON.stringify({
            name,
            goal,
            segmentDescription,
            segmentQuery,
            audienceSize: searchResult.audienceSize,
            variants
          });
        }

        chatMessages.push({
          tool_call_id: toolCall.id,
          role: "tool",
          name: functionName,
          content: functionResponse,
        });
      }

      // Second completion request with tool results
      response = await getGroq().chat.completions.create({
        model: "llama-3.3-70b-versatile",
        messages: chatMessages,
        tools: tools,
        max_tokens: 4096
      });
      
      const secondChoice = response.choices?.[0];
      if (!secondChoice) {
        throw new Error("Groq API returned an empty or invalid response on second completion.");
      }
      responseMessage = secondChoice.message;
    }

    return responseMessage;
  } catch (error) {
    console.error("[agent.service] Error in processChat:", error);
    throw error;
  }
}
