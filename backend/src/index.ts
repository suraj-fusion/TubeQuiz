import { Hono } from "hono";
import { OpenAI } from "openai";

import { Supadata } from "@supadata/js";

const app = new Hono<{
  Bindings: {
    GROQ_API_KEY: string;
    SUPADATA_API_KEY:string;
  };
}>();

app.get("/generate-mcqs", async (c) => {
  const videoId = c.req.query("videoId");

  if (!videoId) {
    return c.json({ error: "Missing videoId" }, 400);
  }

  const openai = new OpenAI({
    apiKey: c.env.GROQ_API_KEY,
    baseURL: "https://api.groq.com/openai/v1",
  });

  try {
    const supadata = new Supadata({
      apiKey: c.env.SUPADATA_API_KEY,
    });
    let transcriptSegments = await supadata.youtube.transcript({
      url: `https://youtu.be/${videoId}`,
      text: false,
    });
    
    console.log(transcriptSegments);

    const transcriptText = transcriptSegments?.content?.map((seg) => decodeHtmlEntities(seg.text))
      .join(" ")
      .slice(0, 8000);

    const prompt = `
Generate 10 multiple choice questions (with 4 options each, one correct answer) based on the following video transcript:

"${transcriptText}"

Format the output as:
1. Question?
a) Option1
b) Option2
c) Option3
d) Option4
Answer: b
`;

    const completion = await openai.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        {
          role: "system",
          content:
            "You are a helpful assistant that creates educational multiple-choice questions from transcripts.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.7,
    });

    const mcqs = completion.choices[0].message.content;
    return c.json({ mcqs }, 200, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type",
    });
  } catch (err) {
    console.error("Error:", err);
    return c.json({ error: "Failed to generate MCQs" }, 500);
  }
});

// Helper function
function decodeHtmlEntities(text: string) {
  return text
    .replace(/&amp;#(\d+);/g, (_, num) => String.fromCharCode(Number(num)))
    .replace(/&amp;/g, "&")
    .replace(/&#(\d+);/g, (_, num) => String.fromCharCode(Number(num)));
}

export default app;
