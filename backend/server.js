const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const natural = require("natural");


dotenv.config({ path: "./.env", override: true });

const app = express();
const PORT = process.env.PORT || 5000;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
app.use(express.json());

const classifier = new natural.BayesClassifier();
const tfidf = new natural.TfIdf();

const trainingData = [
  { text: "what is your fees for iit", label: "fees" },
  { text: "neet coaching fees", label: "fees" },
  { text: "admission process for super 30", label: "admission" },
  { text: "how can i join institute", label: "admission" },
  { text: "admission date", label: "admission_date" },
  { text: "last date of admission", label: "admission_date" },
  { text: "when admission starts", label: "admission_date" },
  { text: "timing of classes", label: "schedule" },
  { text: "class schedule for neet", label: "schedule" },
  { text: "do you have hostel", label: "hostel" },
  { text: "hostel and mess facility", label: "hostel" },
  { text: "scholarship available", label: "scholarship" },
  { text: "how to get scholarship", label: "scholarship" },
  { text: "demo class available", label: "demo" },
  { text: "can i attend trial class", label: "demo" },
  { text: "contact number", label: "contact" },
  { text: "how to call institute", label: "contact" },
  { text: "best preparation tips for iit", label: "preparation" },
  { text: "neet preparation strategy", label: "preparation" },
];

trainingData.forEach((item) => classifier.addDocument(item.text, item.label));
classifier.train();

const faqKnowledge = [
  {
    intent: "fees",
    text: "IIT-JEE and NEET fees vary by batch. Foundation batches start near 35000 rupees and advanced or integrated batches are higher. Scholarship discounts are available based on tests.",
  },
  {
    intent: "admission",
    text: "Admission process: inquiry, counseling, screening test, document verification, then seat confirmation.",
  },
  {
    intent: "schedule",
    text: "Classes run in morning and evening slots. Weekly tests are on weekends. Daily doubt sessions are available after lectures.",
  },
  {
    intent: "hostel",
    text: "Hostel and mess support is available near campus with separate options for boys and girls.",
  },
  {
    intent: "scholarship",
    text: "Scholarship is merit-based from screening score and past academics. Higher score gives higher fee discount.",
  },
  {
    intent: "demo",
    text: "Students can attend orientation or one demo class before admission.",
  },
  {
    intent: "contact",
    text: "Inquiry desk number is 9876543210 and support timing is 9 AM to 7 PM.",
  },
  {
    intent: "preparation",
    text: "Best strategy: complete NCERT first, revise daily, solve previous year papers, and do weekly mock test analysis.",
  },
];

faqKnowledge.forEach((item) => tfidf.addDocument(item.text));

function buildFallbackReply(intent, question) {
  switch (intent) {
    case "fees":
      return "Our IIT-JEE and NEET fee depends on batch type. For regular batch it starts around 35000 rupees and for integrated batch it can go higher. You can call our office for the latest discount and scholarship offers.";
    case "admission":
      return "Admission is simple. First fill inquiry form, then counseling call, then basic screening test, and finally seat confirmation with document verification.";
    case "admission_date":
      return "Admissions are currently open for this session. New batches usually start every month based on seat availability. For exact next batch date and last date, call 9876543210 or visit the institute office.";
    case "schedule":
      return "Classes usually run in morning and evening slots. Weekly tests are conducted on weekends, and doubt classes happen daily after regular lectures.";
    case "hostel":
      return "Yes, hostel support is available near the institute with separate options for boys and girls. Mess and study hall support are also available.";
    case "scholarship":
      return "Scholarship is based on screening test performance and previous academic score. Higher marks can get up to major fee reduction.";
    case "demo":
      return "Yes, demo class is available. You can attend one orientation or demo session before final admission.";
    case "contact":
      return "You can contact Institute Super 30 inquiry desk on 9876543210 between 9 AM and 7 PM for IIT and NEET counseling.";
    case "preparation":
      return "For IIT and NEET success, follow NCERT first, maintain daily revision, solve previous year papers, and take weekly mock tests with error analysis.";
    default:
      return `I understood your question as: ${question}. For best help, please ask about fees, admission, class schedule, scholarship, demo class, hostel, or preparation strategy.`;
  }
}

function detectIntent(question) {
  const q = question.toLowerCase();
  if (
    q.includes("admission") &&
    (q.includes("date") || q.includes("last date") || q.includes("kab") || q.includes("when"))
  ) {
    return "admission_date";
  }
  return classifier.classify(q);
}

function getTopKnowledge(question, count = 3) {
  const scored = [];
  tfidf.tfidfs(question, (index, measure) => {
    scored.push({
      score: measure,
      item: faqKnowledge[index],
    });
  });

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, count)
    .map((entry) => entry.item);
}

async function askGemini(question, intent, knowledgeItems) {
  if (!GEMINI_API_KEY) {
    return null;
  }

  const context = knowledgeItems
    .map((item, index) => `${index + 1}. [${item.intent}] ${item.text}`)
    .join("\n");

  const prompt = `
You are the voice inquiry assistant for Institute Super 30.
Answer in simple, friendly Indian English.
Keep answer within 80 words.

User intent: ${intent}
User question: ${question}

Use this institute knowledge first:
${context}

If question is outside this knowledge, give a practical short guidance and ask user to call 9876543210.
`;

  const modelCandidates = [
    "gemini-2.0-flash",
    "gemini-1.5-flash-latest",
    "gemini-1.5-flash",
  ];

  for (const model of modelCandidates) {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
        }),
      },
    );

    if (!response.ok) {
      const errorBody = await response.text();
      console.warn(`Gemini model failed: ${model} -> ${response.status}`);
      if (response.status === 404) {
        continue;
      }
      throw new Error(`Gemini API error: ${response.status} ${errorBody}`);
    }

    const data = await response.json();
    const text =
      data?.candidates?.[0]?.content?.parts
        ?.map((part) => part?.text || "")
        .join(" ")
        .trim() || "";

    if (text) {
      return text;
    }
  }

  return null;
}

app.use(
  cors({
    origin: "*",
  })
);

app.get("/api/health", (req, res) => {
  res.json({ ok: true, message: "Backend is running." });
});

app.get("/", (req, res) => {
  res.send("Voice Agent Backend is Running 🚀");
});

app.post("/api/text-inquiry", async (req, res) => {
  const question = String(req.body?.question || "").trim();

  if (!question) {
    return res.status(400).json({
      error: "Question text is required.",
    });
  }

  try {
    const intent = detectIntent(question);
    const topKnowledge = getTopKnowledge(question);
    const fallbackAnswer = buildFallbackReply(intent, question);
    let geminiAnswer = null;
    try {
      geminiAnswer = await askGemini(question, intent, topKnowledge);
    } catch (geminiError) {
      console.error("gemini unavailable, using fallback", geminiError);
    }
    const answer = geminiAnswer || fallbackAnswer;

    return res.json({
      userText: question,
      aiText: answer,
      intent,
      source: geminiAnswer ? "gemini" : "local-fallback",
    });
  } catch (error) {
    console.error("text inquiry error", error);
    return res.json({
      userText: question,
      aiText:
        "I am facing a temporary issue with AI service. Please try again, or call 9876543210 for direct counseling.",
      intent: "general",
      source: "local-fallback",
    });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
