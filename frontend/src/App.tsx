import { useRef, useState, type FormEvent } from "react";

const API_BASE = "http://localhost:5000";

type InquiryState = {
  userText: string;
  aiText: string;
  intent: string;
  source: string;
};

type BrowserSpeechRecognition = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
};

type SpeechRecognitionCtor = new () => BrowserSpeechRecognition;

function App() {
  const [isRecording, setIsRecording] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState("Tap phone icon to ask anything.");
  const [inquiry, setInquiry] = useState<InquiryState>({
    userText: "",
    aiText: "",
    intent: "",
    source: "",
  });
  const [typedQuestion, setTypedQuestion] = useState("");
  const [speechLang, setSpeechLang] = useState("en-IN");
  const [lastTranscript, setLastTranscript] = useState("");

  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const speechRef = useRef<SpeechSynthesisUtterance | null>(null);
  const manualStopRef = useRef(false);

  const speakText = (text: string) => {
    if (!("speechSynthesis" in window)) {
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1;
    utterance.pitch = 1;
    speechRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  };

  const sendInquiryText = async (question: string) => {
    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/text-inquiry`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ question }),
      });

      if (!response.ok) {
        let message = "Server error";
        try {
          const errorBody = await response.json();
          message = errorBody.error || message;
        } catch {
          // ignore parse failure and keep generic message
        }
        throw new Error(message);
      }

      const data = await response.json();
      setInquiry({
        userText: data.userText ?? "",
        aiText: data.aiText ?? "",
        intent: data.intent ?? "general",
        source: data.source ?? "unknown",
      });
      setStatus("Answer is ready in voice.");
      if (data.aiText) {
        speakText(data.aiText);
      }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Inquiry failed. Check backend setup.";
      setStatus(message);
      speakText(message);
    } finally {
      setIsLoading(false);
    }
  };

  const startListening = async () => {
    const Ctor = (
      window as Window & {
        webkitSpeechRecognition?: SpeechRecognitionCtor;
        SpeechRecognition?: SpeechRecognitionCtor;
      }
    ).SpeechRecognition ||
      (window as Window & { webkitSpeechRecognition?: SpeechRecognitionCtor })
        .webkitSpeechRecognition;

    if (!Ctor) {
      setStatus("Speech recognition is not supported in this browser. Use Chrome.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());
    } catch {
      setStatus("Microphone permission denied. Please allow mic access and try again.");
      return;
    }

    const recognition = new Ctor();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = speechLang;
    manualStopRef.current = false;

    recognition.onresult = async (event) => {
      const resultIndex = event.results.length - 1;
      const transcript = event.results[resultIndex]?.[0]?.transcript?.trim() || "";
      if (!transcript) {
        setStatus("Could not hear clearly. Please try again.");
        return;
      }
      setLastTranscript(transcript);
      setStatus("Processing your question...");
      await sendInquiryText(transcript);
    };

    recognition.onerror = (event) => {
      if (manualStopRef.current && event.error === "aborted") {
        return;
      }
      if (event.error === "no-speech") {
        setStatus("No speech detected. Please speak clearly and try again.");
      } else if (event.error === "not-allowed") {
        setStatus("Microphone blocked. Enable microphone permission in browser settings.");
      } else if (event.error === "network") {
        setStatus(
          "Voice service network issue. Use Chrome, keep internet on, or type your question below.",
        );
      } else {
        setStatus(`Voice input error: ${event.error}`);
      }
      setIsRecording(false);
    };

    recognition.onend = () => {
      setIsRecording(false);
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
    } catch (err) {
      console.error("recognition.start() failed", err);
      setStatus(
        "Unable to start speech recognition. Check microphone permissions and use Chrome/Chromium.",
      );
      setIsRecording(false);
      return;
    }
    setIsRecording(true);
    setStatus("Listening... tap again to stop and ask.");
  };

  const stopListening = () => {
    const recognition = recognitionRef.current;
    if (!recognition) {
      return;
    }
    manualStopRef.current = true;
    recognition.stop();
    setIsRecording(false);
  };

  const toggleRecording = async () => {
    if (isLoading) {
      return;
    }
    if (isRecording) {
      stopListening();
      return;
    }
    await startListening();
  };

  const handleTypedSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const question = typedQuestion.trim();
    if (!question || isLoading) {
      return;
    }
    setTypedQuestion("");
    setStatus("Processing your typed question...");
    await sendInquiryText(question);
  };

  return (
    <div className="page">
      <header className="hero">
        <p className="badge">Institute Super 30</p>
        <h1>Best Preparation for IIT-JEE and NEET</h1>
        <p className="subtitle">
          We train students with focused batches, expert faculty, test-series,
          and mentorship to crack top engineering and medical entrance exams.
        </p>
        <a
          className="cta"
          href="#inquiry"
          onClick={(e) => {
            e.preventDefault();
            const el = document.getElementById("inquiry");
            if (el) el.scrollIntoView({ behavior: "smooth" });
            void toggleRecording();
          }}
        >
          Start Inquiry
        </a>
      </header>

      <section className="section grid">
        <article className="card">
          <h3>IIT-JEE Program</h3>
          <p>
            Full syllabus coverage, concept drills, weekly tests, and rank
            improvement strategy sessions.
          </p>
        </article>
        <article className="card">
          <h3>NEET Program</h3>
          <p>
            Biology mastery, Physics numericals, Chemistry precision practice,
            and AI based doubt support.
          </p>
        </article>
        <article className="card">
          <h3>Why Super 30</h3>
          <p>
            Small batches, personal mentoring, scholarship support, and parent
            progress reporting.
          </p>
        </article>
      </section>

      <section id="inquiry" className="section inquiry-panel">
        <h2>Voice Inquiry Assistant</h2>
        <p>{status}</p>
        <div style={{ marginTop: 10, marginBottom: 10 }}>
          <label htmlFor="lang">Voice language: </label>
          <select
            id="lang"
            value={speechLang}
            onChange={(e) => setSpeechLang(e.target.value)}
            disabled={isRecording || isLoading}
            style={{ padding: "8px" }}
          >
            <option value="en-IN">English (India)</option>
            <option value="hi-IN">Hindi</option>
          </select>
        </div>
        {lastTranscript && (
          <p>
            <strong>Recognized text:</strong> {lastTranscript}
          </p>
        )}
        <form onSubmit={handleTypedSubmit} style={{ marginTop: 10 }}>
          <input
            type="text"
            value={typedQuestion}
            onChange={(e) => setTypedQuestion(e.target.value)}
            placeholder="If voice fails, type your question here"
            style={{ width: "70%", padding: "10px", marginRight: "8px" }}
          />
          <button type="submit" disabled={isLoading} style={{ padding: "10px 14px" }}>
            Ask
          </button>
        </form>

        {inquiry.userText && (
          <div className="conversation">
            <p>
              <strong>Your question:</strong> {inquiry.userText}
            </p>
            <p>
              <strong>AI answer:</strong> {inquiry.aiText}
            </p>
            <p>
              <strong>Topic:</strong> {inquiry.intent}
            </p>
            <p>
              <strong>Answer source:</strong> {inquiry.source}
            </p>
          </div>
        )}
      </section>

      <button
        type="button"
        className={`phone-button ${isRecording ? "recording" : ""}`}
        onClick={toggleRecording}
        aria-label="Call inquiry assistant"
      >
        {isLoading ? "..." : "📞"}
      </button>
    </div>
  );
}

export default App;
