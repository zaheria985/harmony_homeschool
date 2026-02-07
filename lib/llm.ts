type Message = {
  role: "system" | "user" | "assistant";
  content: string;
};

type CompletionResponse = {
  content: string;
};

export async function chatCompletion(
  messages: Message[]
): Promise<CompletionResponse> {
  const provider = process.env.LLM_PROVIDER || "openai";
  const apiKey = process.env.LLM_API_KEY;
  const baseUrl =
    process.env.LLM_BASE_URL || "https://api.openai.com/v1";

  if (!apiKey) {
    throw new Error("LLM_API_KEY is not configured");
  }

  let url: string;
  let headers: Record<string, string>;
  let body: Record<string, unknown>;

  if (provider === "claude") {
    url = "https://api.anthropic.com/v1/messages";
    headers = {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    };
    const system = messages.find((m) => m.role === "system")?.content;
    body = {
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      system,
      messages: messages.filter((m) => m.role !== "system"),
    };
  } else {
    // openai or openai_compatible
    url = `${baseUrl}/chat/completions`;
    headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    };
    body = {
      model: "gpt-4o",
      messages,
    };
  }

  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`LLM request failed (${res.status}): ${text}`);
  }

  const data = await res.json();

  if (provider === "claude") {
    return { content: data.content[0].text };
  }

  return { content: data.choices[0].message.content };
}
