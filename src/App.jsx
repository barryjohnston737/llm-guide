import React, { useState, useEffect, useRef, useMemo, createContext, useContext, useCallback } from "react";
// Single source of truth for the model landscape, shared with the companion paper
// "Using AI Safely and Ethically in Research". Edit shared/models.json, then run
// shared/sync-models.sh — never edit this copy directly.
import MODEL_DATA from "./data/models.json";

class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { hasError: false, error: null }; }
  static getDerivedStateFromError(error) { return { hasError: true, error }; }
  render() {
    if (this.state.hasError) return (
      <div style={{ padding: 40, color: '#B91C1C', fontFamily: 'sans-serif', background: '#FEF2F2', minHeight: '100vh' }}>
        <h2>Something went wrong!</h2>
        <pre style={{ background: '#FEE2E2', padding: 20, borderRadius: 8, overflowX: 'auto' }}>{this.state.error?.toString()}</pre>
      </div>
    );
    return this.props.children;
  }
}

const ThemeContext = createContext();
function useTheme() { return useContext(ThemeContext); }

const SECTIONS = [
  { id: "hero", label: "Intro" },
  { id: "architectures", label: "Architectures" },
  { id: "categories", label: "Model types" },
  { id: "embeddings", label: "Embeddings" },
  { id: "alignment", label: "Alignment & Tuning" },
  { id: "rag", label: "RAG" },
  { id: "landscape", label: "Landscape" },
  { id: "safe-use", label: "Safe use" },
  { id: "quiz", label: "Quiz" },
  { id: "glossary", label: "Glossary" },
];

const GLOSSARY_TERMS = [
  { term: "Attention", def: "The mechanism by which a model determines how much each token should influence every other token during processing." },
  { term: "Autoregressive", def: "A generation strategy where each new token is predicted based on all preceding tokens. All decoder-only models are autoregressive." },
  { term: "Context window", def: "The maximum number of tokens a model can process in a single forward pass. Ranges from 2K (older models) to 1M+ (Gemini)." },
  { term: "Fine-tuning", def: "Further training a pretrained model on a smaller, task-specific dataset. Can be full (all parameters) or parameter-efficient (LoRA, QLoRA)." },
  { term: "Hallucination", def: "When a model generates content that is fluent and confident but factually incorrect or fabricated." },
  { term: "LoRA", def: "Low-Rank Adaptation: a parameter-efficient fine-tuning method that freezes the base model and injects small trainable matrices." },
  { term: "MoE", def: "Mixture-of-Experts: models with many expert sub-networks that activate only a subset per token, maximising capacity per FLOP." },
  { term: "Perplexity", def: "A measure of how well a language model predicts text. Lower perplexity = better prediction quality." },
  { term: "RAG", def: "Retrieval-Augmented Generation: combining retrieval (search) with a generative LLM to ground responses in external knowledge." },
  { term: "RLHF", def: "Reinforcement Learning from Human Feedback: training a reward model on human preference rankings, then optimising the LLM against it." },
  { term: "Temperature", def: "A sampling parameter controlling randomness. Lower (0.0) = deterministic; higher (1.0+) = creative and varied." },
  { term: "Tokeniser", def: "Converts raw text into numerical token IDs. Different models use BPE, SentencePiece, or WordPiece with varying vocabularies." },
  { term: "Transformer", def: "The foundational architecture (2017) using self-attention to process all tokens in parallel, replacing recurrent approaches." },
  { term: "Zero-shot", def: "Performing a task without any examples in the prompt. Few-shot includes a handful of demonstrations." },
  { term: "DPO", def: "Direct Preference Optimisation: an alternative to RLHF that skips the reward model and directly optimises on preference pairs." },
  { term: "Quantisation", def: "Reducing model weight precision (e.g., float16 → 4-bit) to shrink memory usage and increase speed, with modest accuracy trade-off." },
  { term: "Embedding", def: "A dense numerical vector representing text in a high-dimensional space where semantic similarity corresponds to geometric proximity." },
  { term: "MCP", def: "Model Context Protocol: an open standard for connecting LLMs to external tools and data sources via a uniform interface." },
];

const QUIZ_QUESTIONS = [
  { q: "Which transformer architecture uses bidirectional attention where every token can see every other token?", options: ["Decoder-only (GPT-style)", "Encoder-only (BERT-style)", "Encoder-decoder (T5-style)", "Mixture-of-Experts"], correct: 1, explanation: "Encoder-only models like BERT use bidirectional attention — every token attends to every other token. This makes them ideal for understanding tasks like classification and semantic search, not text generation." },
  { q: "What does RAG stand for?", options: ["Reinforced Agent Generation", "Retrieval-Augmented Generation", "Recursive Attention Grounding", "Ranked Autoregressive Generation"], correct: 1, explanation: "RAG = Retrieval-Augmented Generation. It grounds LLM responses in external knowledge by retrieving relevant documents before generating an answer, dramatically reducing hallucination on factual queries." },
  { q: "What happens to the token probability distribution when temperature approaches 0?", options: ["Probabilities become uniform across all tokens", "The highest-probability token approaches 100%", "The model stops generating new tokens", "Probabilities become entirely random"], correct: 1, explanation: "As temperature → 0, the softmax sharpens dramatically. The token with the highest logit approaches 100% probability, making generation deterministic — always picking the same 'most likely' next token." },
  { q: "What is the key advantage of LoRA over full fine-tuning?", options: ["It always improves accuracy more", "It trains only a tiny fraction of parameters (~0.01–1%)", "It requires no training data", "It replaces the base model weights entirely"], correct: 1, explanation: "LoRA freezes the base model and injects two small trainable matrices per layer. Instead of updating all billions of parameters, you train only ~0.01–1% of them — dramatically reducing GPU memory and training time." },
  { q: "Which retrieval approach passes query and document TOGETHER through a single model in one forward pass?", options: ["Bi-encoder", "Late interaction (ColBERT)", "Cross-encoder", "BM25 sparse retrieval"], correct: 2, explanation: "Cross-encoders concatenate the query and document and process them jointly, enabling deep cross-attention between every token pair. This gives the highest accuracy but cannot precompute document vectors offline." },
  { q: "In RLHF, what is the reward model primarily trained on?", options: ["Next-token prediction on web text", "Human preference rankings between response pairs", "Automated fact-checking labels", "Constitutional AI principles"], correct: 1, explanation: "The reward model is trained on human preference data — annotators rank which of two responses is better. The LLM is then optimised via PPO to maximise scores from this learned reward signal." },
  { q: "Which of these is NOT a decoder-only autoregressive model?", options: ["GPT-5", "Claude", "Llama 4", "BERT"], correct: 3, explanation: "BERT is an encoder-only model using bidirectional attention — built for understanding, not generation. The GPT, Claude and Llama families are all autoregressive decoder-only models that generate text left-to-right." },
  { q: "What does 'hallucination' mean in the context of LLMs?", options: ["The model produces very slow outputs", "The model generates fluent but factually incorrect content", "The model visualises attention weights", "The model refuses to answer sensitive questions"], correct: 1, explanation: "Hallucination is when a model generates confident, fluent-sounding text that is factually wrong or completely fabricated. It's a core challenge for deploying LLMs in factual, high-stakes applications." },
  { q: "What is the primary advantage of Mixture-of-Experts (MoE) models?", options: ["Fewer total parameters than dense models", "Lower accuracy but faster first-token latency", "Massive total capacity with lower per-token compute cost", "They eliminate the need for pre-training"], correct: 2, explanation: "MoE models have many expert sub-networks but only activate a subset per token. Recent MoE releases reach from hundreds of billions into trillions of total parameters, while keeping per-token FLOPs manageable." },
  { q: "What self-supervised objective is used in LLM pretraining?", options: ["Binary classification (harmful / not harmful)", "Next-token prediction on massive text corpora", "Human preference ranking", "Image-text contrastive learning"], correct: 1, explanation: "Most LLMs are pretrained using causal language modelling: next-token prediction on trillions of tokens. This self-supervised objective requires no labels and builds broad world knowledge and language understanding." },
];

const lightColors = {
  bg: "#F9FAFB", surface: "#FFFFFF", surfaceAlt: "#F3F4F6",
  border: "#E5E7EB", borderLight: "#D1D5DB",
  text: "#111827", textMuted: "#4B5563", textDim: "#6B7280",
  accent: "#059669", accentDim: "#D1FAE5",
  purple: "#7C3AED", purpleDim: "#EDE9FE",
  coral: "#EA580C", coralDim: "#FFEDD5",
  teal: "#0D9488", tealDim: "#CCFBF1",
  blue: "#2563EB", blueDim: "#DBEAFE",
  pink: "#DB2777", pinkDim: "#FCE7F3",
  amber: "#D97706", amberDim: "#FEF3C7",
};

const darkColors = {
  bg: "#0F1117", surface: "#181B24", surfaceAlt: "#20242F",
  border: "#333845", borderLight: "#444A5A",
  text: "#F8F9FA", textMuted: "#B0B5C0", textDim: "#8B92A5",
  accent: "#6EE7B7", accentDim: "#2D6B55",
  purple: "#A78BFA", purpleDim: "#4C3D8F",
  coral: "#FB923C", coralDim: "#7A4220",
  teal: "#5EEAD4", tealDim: "#1D5B52",
  blue: "#60A5FA", blueDim: "#2A4A7A",
  pink: "#F472B6", pinkDim: "#7A2D54",
  amber: "#FBBF24", amberDim: "#6B4F10",
};

// ── Reusable Components ──

function Badge({ color, children }) {
  return <span style={{ display: "inline-block", padding: "4px 12px", borderRadius: 20, background: color + "18", color, fontSize: 13, fontWeight: 700, letterSpacing: 0.5 }}>{children}</span>;
}

function SectionTitle({ children, sub }) {
  const { C } = useTheme();
  return (
    <div style={{ marginBottom: 36, textAlign: "left" }}>
      <h2 style={{ fontSize: 38, fontWeight: 700, color: C.text, margin: 0, lineHeight: 1.2 }}>{children}</h2>
      {sub && <p style={{ color: C.textMuted, fontSize: 17, marginTop: 12, maxWidth: 650, lineHeight: 1.6 }}>{sub}</p>}
    </div>
  );
}

function Card({ color, title, subtitle, children, onClick, active, style: sx }) {
  const { C } = useTheme();
  const cColor = color || C.accent;
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onClick={onClick}
      onKeyDown={e => onClick && (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onClick(e))}
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      role={onClick ? "button" : undefined} tabIndex={onClick ? 0 : undefined}
      style={{ background: active ? cColor + "14" : C.surface, border: `1px solid ${active ? cColor + "60" : hovered ? C.borderLight : C.border}`, borderRadius: 12, padding: 24, cursor: onClick ? "pointer" : "default", transition: "all .25s ease", position: "relative", overflow: "hidden", transform: hovered && onClick ? "translateY(-2px)" : "none", outline: "none", textAlign: "left", ...sx }}
    >
      {active && <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: cColor }} />}
      {title && <div style={{ fontWeight: 700, fontSize: 18, color: C.text, marginBottom: subtitle ? 6 : children ? 16 : 0 }}>{title}</div>}
      {subtitle && <div style={{ fontSize: 15, color: C.textMuted, marginBottom: children ? 16 : 0, lineHeight: 1.6 }}>{subtitle}</div>}
      {children}
    </div>
  );
}

function Tag({ children, color }) {
  const { C } = useTheme();
  const cColor = color || C.textMuted;
  return <span style={{ fontSize: 12, color: cColor, background: cColor + "15", padding: "3px 10px", borderRadius: 4, marginRight: 6, marginBottom: 6, display: "inline-block", fontWeight: 700 }}>{children}</span>;
}

function Term({ word, match }) {
  const { C, isDark } = useTheme();
  const [show, setShow] = useState(false);
  const [tipPos, setTipPos] = useState({ left: "50%", transform: "translateX(-50%)" });
  const spanRef = useRef(null);
  const termObj = GLOSSARY_TERMS.find(t => t.term.toLowerCase() === (match || word).toLowerCase());

  const handleEnter = useCallback(() => {
    if (spanRef.current) {
      const rect = spanRef.current.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const vw = window.innerWidth;
      if (cx - 130 < 16) setTipPos({ left: 0, transform: "none" });
      else if (cx + 130 > vw - 16) setTipPos({ left: "auto", right: 0, transform: "none" });
      else setTipPos({ left: "50%", transform: "translateX(-50%)" });
    }
    setShow(true);
  }, []);

  if (!termObj) return <span style={{ fontWeight: 600 }}>{word}</span>;
  const bg = isDark ? "#FFFFFF" : "#111827";
  const fg = isDark ? "#111827" : "#FFFFFF";

  return (
    <span ref={spanRef} onMouseEnter={handleEnter} onMouseLeave={() => setShow(false)}
      style={{ position: "relative", cursor: "help", borderBottom: `2px dotted ${C.accent}`, color: C.text, fontWeight: 600 }}>
      {word}
      {show && (
        <div style={{ position: "absolute", bottom: "120%", ...tipPos, background: bg, color: fg, padding: "12px 16px", borderRadius: 8, fontSize: 14, width: 260, zIndex: 1000, boxShadow: "0 10px 25px rgba(0,0,0,0.2)", textAlign: "left", fontWeight: 400, lineHeight: 1.5, pointerEvents: "none", animation: "fadeIn 0.2s ease" }}>
          <div style={{ fontWeight: 700, color: C.accent, marginBottom: 4 }}>{termObj.term}</div>
          {termObj.def}
          <div style={{ position: "absolute", top: "100%", left: tipPos.left === "50%" ? "50%" : tipPos.right != null ? "auto" : "20px", right: tipPos.right != null ? "20px" : "auto", transform: tipPos.left === "50%" ? "translateX(-50%)" : "none", borderWidth: 6, borderStyle: "solid", borderColor: `${bg} transparent transparent transparent` }} />
        </div>
      )}
    </span>
  );
}

// ── Progress Bar ──
function ProgressBar() {
  const { C } = useTheme();
  const [pct, setPct] = useState(0);
  useEffect(() => {
    const onScroll = () => {
      const total = document.documentElement.scrollHeight - window.innerHeight;
      setPct(total > 0 ? (window.scrollY / total) * 100 : 0);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return (
    <div style={{ position: "fixed", top: 0, left: 0, right: 0, height: 3, zIndex: 400, background: "transparent" }}>
      <div style={{ width: `${pct}%`, height: "100%", background: C.accent, transition: "width 0.1s linear" }} />
    </div>
  );
}

// ── Command Palette ──
function CommandPalette({ onClose, onNavigate }) {
  const { C } = useTheme();
  const [query, setQuery] = useState("");
  const [selIdx, setSelIdx] = useState(0);
  const inputRef = useRef(null);
  useEffect(() => { inputRef.current?.focus(); }, []);

  const allItems = useMemo(() => [
    ...SECTIONS.map(s => ({ type: "section", label: s.label, id: s.id, def: null })),
    ...GLOSSARY_TERMS.map(t => ({ type: "term", label: t.term, id: "glossary", def: t.def })),
  ], []);

  const results = useMemo(() => {
    if (!query.trim()) return allItems.filter(i => i.type === "section");
    const q = query.toLowerCase();
    return allItems.filter(i => i.label.toLowerCase().includes(q) || (i.def && i.def.toLowerCase().includes(q)));
  }, [query, allItems]);

  useEffect(() => { setSelIdx(0); }, [query]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === "Escape") { onClose(); return; }
    if (e.key === "ArrowDown") { e.preventDefault(); setSelIdx(i => Math.min(i + 1, results.length - 1)); }
    if (e.key === "ArrowUp") { e.preventDefault(); setSelIdx(i => Math.max(i - 1, 0)); }
    if (e.key === "Enter" && results[selIdx]) { onNavigate(results[selIdx].id); onClose(); }
  }, [results, selIdx, onClose, onNavigate]);

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 500, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "flex-start", justifyContent: "center", paddingTop: 80 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: C.surface, borderRadius: 12, width: "90%", maxWidth: 560, border: `1px solid ${C.borderLight}`, overflow: "hidden", boxShadow: "0 24px 64px rgba(0,0,0,0.5)", animation: "fadeIn 0.15s ease" }}>
        <div style={{ display: "flex", alignItems: "center", padding: "0 16px", borderBottom: `1px solid ${C.border}` }}>
          <span style={{ fontSize: 18, color: C.textDim, marginRight: 10 }}>⌕</span>
          <input ref={inputRef} value={query} onChange={e => setQuery(e.target.value)} placeholder="Search sections and glossary…"
            style={{ flex: 1, background: "transparent", border: "none", color: C.text, padding: "16px 0", fontSize: 16, outline: "none", fontFamily: "inherit" }} />
          <kbd style={{ fontSize: 11, color: C.textDim, background: C.surfaceAlt, border: `1px solid ${C.border}`, borderRadius: 4, padding: "2px 6px" }}>Esc</kbd>
        </div>
        <div style={{ maxHeight: 360, overflowY: "auto" }}>
          {results.length === 0 && <div style={{ padding: 24, color: C.textDim, textAlign: "center", fontSize: 14 }}>No results for "{query}"</div>}
          {results.map((item, i) => (
            <div key={`${item.type}-${item.label}`} onClick={() => { onNavigate(item.id); onClose(); }} onMouseEnter={() => setSelIdx(i)}
              style={{ padding: "10px 20px", cursor: "pointer", background: i === selIdx ? C.surfaceAlt : "transparent", borderBottom: `1px solid ${C.border}20`, display: "flex", gap: 12, alignItems: "flex-start" }}>
              <span style={{ fontSize: 11, color: item.type === "section" ? C.accent : C.purple, fontWeight: 700, minWidth: 52, paddingTop: 2 }}>{item.type === "section" ? "SECTION" : "TERM"}</span>
              <div>
                <div style={{ color: C.text, fontWeight: 600, fontSize: 14 }}>{item.label}</div>
                {item.def && <div style={{ color: C.textMuted, fontSize: 12, marginTop: 2, lineHeight: 1.4 }}>{item.def.slice(0, 90)}…</div>}
              </div>
            </div>
          ))}
        </div>
        <div style={{ padding: "6px 20px", borderTop: `1px solid ${C.border}`, display: "flex", gap: 16, fontSize: 11, color: C.textDim }}>
          <span>↑↓ navigate</span><span>↵ select</span><span>Esc close</span>
        </div>
      </div>
    </div>
  );
}

// ── Interactive Demos ──

function TokenizerDemo() {
  const { C } = useTheme();
  const [text, setText] = useState("Tokens are the building blocks of large language models.");
  const tokens = useMemo(() => {
    if (!text) return [];
    const chunks = text.match(/[\w]+|[^\w\s]+|\s+/g) || [];
    const out = [];
    chunks.forEach(w => {
      if (w.trim() === '') { out.push(w); return; }
      if (w.length > 6) { out.push(w.slice(0, 4)); out.push(w.slice(4)); }
      else out.push(w);
    });
    return out;
  }, [text]);
  const palette = [C.purple, C.teal, C.amber, C.pink, C.blue];
  return (
    <div style={{ background: C.surfaceAlt, borderRadius: 12, padding: 32, border: `1px solid ${C.border}`, textAlign: "left", marginBottom: 40 }}>
      <div style={{ fontSize: 12, color: C.blue, letterSpacing: 1, marginBottom: 16, textTransform: "uppercase", fontWeight: 700 }}>Interactive: Tokenizer</div>
      <p style={{ fontSize: 15, color: C.textMuted, marginBottom: 20, lineHeight: 1.6 }}>LLMs do not read words — they read <strong>tokens</strong>. Subwords and characters are grouped to save compute. Type below to see text chopped up.</p>
      <input type="text" value={text} onChange={e => setText(e.target.value)} placeholder="Type a sentence…"
        style={{ width: "100%", background: C.surface, border: `1px solid ${C.border}`, color: C.text, padding: "12px 16px", borderRadius: 8, fontSize: 16, marginBottom: 20, outline: "none", boxSizing: "border-box" }} />
      <div style={{ display: "flex", flexWrap: "wrap", gap: 4, background: C.surface, padding: 24, borderRadius: 8, border: `1px solid ${C.borderLight}`, minHeight: 80 }}>
        {tokens.length === 0 && <span style={{ color: C.textDim, fontStyle: "italic" }}>Awaiting text…</span>}
        {tokens.map((t, i) => {
          if (t.trim() === '') return <span key={i}>&nbsp;</span>;
          const color = palette[i % palette.length];
          return <span key={i} style={{ background: color + "25", color, padding: "4px 6px", borderRadius: 4, fontWeight: 600, fontSize: 15, border: `1px solid ${color}40` }}>{t}</span>;
        })}
      </div>
      <div style={{ marginTop: 16, fontSize: 13, color: C.textDim, display: "flex", justifyContent: "space-between" }}>
        <span>Characters: {text.length}</span>
        <span>Simulated tokens: {tokens.filter(t => t.trim() !== '').length}</span>
      </div>
    </div>
  );
}

function ContextWindowViz() {
  const { C } = useTheme();
  const sizes = [2048, 4096, 8192, 16384, 32768, 65536, 131072, 200000, 1000000];
  const labels = ["2K", "4K", "8K", "16K", "32K", "64K", "128K", "200K", "1M+"];
  const [idx, setIdx] = useState(2);
  const ctx = sizes[idx];
  const modelExamples = { 2048: ["GPT-2"], 4096: ["LLaMA 1"], 8192: ["LLaMA 2"], 16384: ["Phi-4-mini"], 32768: ["Mistral 7B"], 65536: ["Yi-34B"], 131072: ["GPT-4o", "Llama 4"], 200000: ["Claude 3/4"], 1000000: ["Gemini 1.5"] };
  const analogies = [
    { label: "One tweet", tokens: 20, icon: "🐦" },
    { label: "A paragraph", tokens: 100, icon: "📝" },
    { label: "A short email", tokens: 400, icon: "📧" },
    { label: "A blog post", tokens: 1500, icon: "📰" },
    { label: "A research paper", tokens: 6000, icon: "📄" },
    { label: "A short story", tokens: 10000, icon: "📖" },
    { label: "A novella", tokens: 40000, icon: "📗" },
    { label: "A full novel", tokens: 100000, icon: "📚" },
    { label: "Three novels", tokens: 300000, icon: "🗃️" },
    { label: "A research library", tokens: 1000000, icon: "🏛️" },
  ];
  return (
    <div style={{ background: C.surfaceAlt, borderRadius: 12, padding: 32, border: `1px solid ${C.border}`, marginBottom: 40 }}>
      <div style={{ fontSize: 12, color: C.blue, letterSpacing: 1, marginBottom: 16, textTransform: "uppercase", fontWeight: 700 }}>Interactive: Context Window Size</div>
      <p style={{ fontSize: 15, color: C.textMuted, marginBottom: 24, lineHeight: 1.6 }}>A model's <strong>context window</strong> sets how much text it can read and reason over in one pass. Drag the slider to compare sizes to real-world document lengths.</p>
      <input type="range" min={0} max={sizes.length - 1} step={1} value={idx} onChange={e => setIdx(+e.target.value)}
        style={{ width: "100%", accentColor: C.blue, cursor: "pointer", marginBottom: 8 }} />
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 24, fontSize: 11, color: C.textDim }}>
        {labels.map((l, i) => <span key={l} style={{ color: i === idx ? C.blue : C.textDim, fontWeight: i === idx ? 700 : 400, transition: "all 0.2s" }}>{l}</span>)}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 20 }}>
        <div style={{ background: C.surface, borderRadius: 8, padding: 20, border: `2px solid ${C.blue}40` }}>
          <div style={{ fontSize: 11, color: C.textDim, fontWeight: 700, marginBottom: 8, textTransform: "uppercase" }}>Context size</div>
          <div style={{ fontSize: 40, fontWeight: 700, color: C.blue, lineHeight: 1 }}>{labels[idx]}</div>
          <div style={{ fontSize: 14, color: C.textMuted, marginTop: 4 }}>{ctx.toLocaleString()} tokens · ~{Math.round(ctx * 0.75).toLocaleString()} words</div>
          <div style={{ marginTop: 12 }}>{(modelExamples[ctx] || []).map(m => <Tag key={m} color={C.blue}>{m}</Tag>)}</div>
        </div>
        <div style={{ background: C.surface, borderRadius: 8, padding: 20, border: `1px solid ${C.borderLight}` }}>
          <div style={{ fontSize: 11, color: C.textDim, fontWeight: 700, marginBottom: 12, textTransform: "uppercase" }}>What fits in this window</div>
          {analogies.map(a => {
            const fits = a.tokens <= ctx;
            return (
              <div key={a.label} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, opacity: fits ? 1 : 0.3, transition: "opacity 0.3s" }}>
                <span style={{ fontSize: 14 }}>{a.icon}</span>
                <span style={{ fontSize: 13, color: fits ? C.text : C.textDim, flex: 1 }}>{a.label}</span>
                <span style={{ fontSize: 11, color: fits ? C.accent : C.textDim, fontWeight: 700 }}>{fits ? "✓" : "✗"} {a.tokens >= 1000 ? `${(a.tokens / 1000).toFixed(0)}K` : a.tokens}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function ArchDiagram({ type }) {
  const { C } = useTheme();
  const configs = {
    encoder: { color: C.teal, label: "Encoder-only", desc: "Every token attends to every other token. Produces rich contextual representations for understanding tasks.", examples: ["BERT", "RoBERTa", "DeBERTa", "ELECTRA"], uses: ["Classification", "NER", "Semantic search", "Extractive QA"] },
    decoder: { color: C.purple, label: "Decoder-only", desc: "Each token only attends to tokens before it. Generates text autoregressively, one token at a time.", examples: ["GPT-4", "Claude", "Llama", "Mistral", "DeepSeek"], uses: ["Chat", "Code generation", "Reasoning", "Creative writing"] },
    encdec: { color: C.coral, label: "Encoder-decoder", desc: "Encoder reads the full input bidirectionally. Decoder generates output while attending to the encoder's representations.", examples: ["T5", "BART", "FLAN-T5", "mBART", "UL2"], uses: ["Translation", "Summarisation", "Structured output", "Generative QA"] },
  };
  const c = configs[type];
  const tokens = ["The", "cat", "sat", "on", "mat"];
  const [hoveredIdx, setHoveredIdx] = useState(null);
  const baseY = 45;
  // Memoised so Math.random doesn't rerun on every render (fixes flickering)
  const lineOpacities = useMemo(() => {
    const ops = {};
    tokens.forEach((_, i) => tokens.forEach((_, j) => { if (i !== j) ops[`${i}-${j}`] = 0.3 + Math.random() * 0.3; }));
    return ops;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div style={{ textAlign: "left" }}>
      <div style={{ fontSize: 13, color: c.color, letterSpacing: 1, marginBottom: 16, textTransform: "uppercase", fontWeight: 700, display: "flex", justifyContent: "space-between" }}>
        <span>{c.label}</span>
        <span style={{ color: C.textDim, fontSize: 11, textTransform: "none", fontWeight: 400 }}>Hover a token</span>
      </div>
      <svg viewBox="0 0 260 140" style={{ width: "100%", display: "block" }}>
        {type === "encoder" && tokens.map((_, i) => tokens.map((_, j) => {
          if (i === j) return null;
          const hl = hoveredIdx !== null && (hoveredIdx === i || hoveredIdx === j);
          const fd = hoveredIdx !== null && !hl;
          return <line key={`${i}-${j}`} x1={30 + i * 50} y1={baseY} x2={30 + j * 50} y2={baseY} stroke={c.color} strokeWidth={hl ? 2 : 1} opacity={fd ? 0.05 : hl ? 1 : lineOpacities[`${i}-${j}`]} strokeLinecap="round" style={{ transition: "all 0.3s" }} />;
        }))}
        {type === "decoder" && tokens.map((_, i) => tokens.filter((_, j) => j < i).map((_, j) => {
          const hl = hoveredIdx !== null && hoveredIdx === i;
          const fd = hoveredIdx !== null && !hl;
          return <line key={`${i}-${j}`} x1={30 + i * 50} y1={baseY} x2={30 + j * 50} y2={baseY} stroke={c.color} strokeWidth={hl ? 2 : 1} opacity={fd ? 0.05 : hl ? 1 : 0.2 + (1 - (i - j) / 5) * 0.5} strokeLinecap="round" style={{ transition: "all 0.3s" }} />;
        }))}
        {type === "encdec" && <g style={{ opacity: hoveredIdx !== null ? 0.1 : 1, transition: "opacity 0.3s" }}>
          <line x1={30} y1={baseY} x2={80} y2={baseY} stroke={c.color} strokeWidth={1} opacity={0.5} />
          <line x1={80} y1={baseY} x2={30} y2={baseY} stroke={c.color} strokeWidth={1} opacity={0.5} />
          <rect x={105} y={baseY - 15} width={2} height={30} fill={C.borderLight} rx={1} />
          <line x1={55} y1={baseY + 8} x2={155} y2={baseY + 8} stroke={c.color} strokeWidth={1} opacity={0.4} strokeDasharray="4 3" />
          <line x1={55} y1={baseY + 8} x2={205} y2={baseY + 8} stroke={c.color} strokeWidth={1} opacity={0.3} strokeDasharray="4 3" />
          <line x1={155} y1={baseY} x2={205} y2={baseY} stroke={c.color} strokeWidth={1} opacity={0.5} />
        </g>}
        {tokens.map((t, i) => {
          const active = hoveredIdx === i;
          return (
            <g key={i} onMouseEnter={() => setHoveredIdx(i)} onMouseLeave={() => setHoveredIdx(null)} role="button" tabIndex={0} style={{ cursor: "pointer", outline: "none" }}>
              <circle cx={30 + i * 50} cy={baseY} r={active ? 18 : 14} fill={active ? c.color + "20" : C.surface} stroke={active ? c.color : C.borderLight} strokeWidth={active ? 2 : 1.5} style={{ transition: "all 0.2s cubic-bezier(0.175,0.885,0.32,1.275)" }} />
              <text x={30 + i * 50} y={baseY + 4} textAnchor="middle" fontSize={12} fill={active ? c.color : C.text} fontWeight={active ? 700 : 500} style={{ pointerEvents: "none" }}>{t}</text>
            </g>
          );
        })}
        {type === "decoder" && <g opacity={0.8}><line x1={30} y1={baseY + 40} x2={220} y2={baseY + 40} stroke={C.textMuted} strokeWidth={1} markerEnd="url(#ah)" /><text x={125} y={baseY + 56} textAnchor="middle" fontSize={12} fill={C.textMuted}>left → right</text></g>}
        {type === "encoder" && <g opacity={0.8}><line x1={35} y1={baseY + 40} x2={220} y2={baseY + 40} stroke={C.textMuted} strokeWidth={1} markerEnd="url(#ah)" markerStart="url(#ah-rev)" /><text x={125} y={baseY + 56} textAnchor="middle" fontSize={12} fill={C.textMuted}>bidirectional</text></g>}
        {type === "encdec" && <g opacity={0.8}><text x={40} y={baseY + 45} textAnchor="middle" fontSize={12} fill={C.textMuted}>encoder</text><text x={180} y={baseY + 45} textAnchor="middle" fontSize={12} fill={C.textMuted}>decoder</text></g>}
        <defs>
          <marker id="ah" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M2 2L8 5L2 8" fill="none" stroke={C.textMuted} strokeWidth="1.5" /></marker>
          <marker id="ah-rev" viewBox="0 0 10 10" refX="2" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M8 2L2 5L8 8" fill="none" stroke={C.textMuted} strokeWidth="1.5" /></marker>
        </defs>
      </svg>
      <p style={{ fontSize: 15, color: C.textMuted, lineHeight: 1.6, margin: "16px 0", minHeight: 70 }}>{c.desc}</p>
      <div style={{ marginBottom: 12 }}>{c.examples.map(e => <Tag key={e} color={c.color}>{e}</Tag>)}</div>
    </div>
  );
}

function AttentionDemo() {
  const { C } = useTheme();
  const [queryIdx, setQueryIdx] = useState(2);
  const [viewMode, setViewMode] = useState("lines");
  const tokens = ["The", "cat", "sat", "on", "the", "mat"];

  // Raw Q·K dot products — plausible scores that softmax(row / √dₖ) into natural attention patterns.
  const dk = 16, sqrtDk = 4;
  const rawScores = useMemo(() => [
    [0.0,  7.2,  2.8,  1.9,  1.4,  8.3],  // The
    [5.5,  6.4,  9.7,  2.1,  0.0,  9.2],  // cat
    [1.2,  9.7,  5.5,  6.4,  0.0,  9.4],  // sat
    [0.0,  6.4, 12.0,  5.5,  3.7, 11.5],  // on
    [9.2,  2.1,  0.0,  3.4,  6.4, 10.3],  // the
    [0.0,  3.9,  9.2,  8.3,  1.2,  9.2],  // mat
  ], []);

  const { scaledScores, weights } = useMemo(() => {
    const scaled = rawScores.map(row => row.map(v => v / sqrtDk));
    const w = scaled.map(row => {
      const exp = row.map(v => Math.exp(v));
      const sum = exp.reduce((a, b) => a + b, 0);
      return exp.map(v => v / sum);
    });
    return { scaledScores: scaled, weights: w };
  }, [rawScores]);

  const w = weights[queryIdx];
  const maxW = Math.max(...w);
  const globalMax = Math.max(...weights.flat());

  return (
    <div style={{ background: C.surfaceAlt, borderRadius: 12, padding: 32, border: `1px solid ${C.border}`, textAlign: "left" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
        <div style={{ fontSize: 12, color: C.amber, letterSpacing: 1, textTransform: "uppercase", fontWeight: 700 }}>Interactive: Attention</div>
        <div style={{ display: "flex", gap: 6 }}>
          {["lines", "heatmap"].map(m => (
            <button key={m} onClick={() => setViewMode(m)} style={{ background: viewMode === m ? C.amber + "25" : C.surface, border: `1.5px solid ${viewMode === m ? C.amber : C.border}`, color: viewMode === m ? C.amber : C.textMuted, borderRadius: 6, padding: "4px 14px", cursor: "pointer", fontSize: 12, fontWeight: viewMode === m ? 700 : 500, fontFamily: "inherit", transition: "all 0.2s", textTransform: "capitalize" }}>{m}</button>
          ))}
        </div>
      </div>

      {/* Formula card */}
      <div style={{ background: C.surface, borderRadius: 8, padding: 20, border: `1px solid ${C.borderLight}`, marginBottom: 20 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: C.textDim, marginBottom: 14, textTransform: "uppercase", letterSpacing: 0.8 }}>Scaled Dot-Product Attention</div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
          <span style={{ fontSize: 16, fontFamily: "Georgia, serif", color: C.amber, fontWeight: 700 }}>Attention(Q, K, V)</span>
          <span style={{ fontSize: 16, fontFamily: "Georgia, serif", color: C.textDim }}>=</span>
          <span style={{ fontSize: 16, fontFamily: "Georgia, serif", color: C.text }}>softmax</span>
          <span style={{ fontSize: 20, color: C.textDim, fontFamily: "Georgia, serif" }}>(</span>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
            <span style={{ borderBottom: `2px solid ${C.textDim}`, paddingBottom: 4, paddingInline: 8, fontSize: 16, fontFamily: "Georgia, serif", color: C.text }}>QKᵀ</span>
            <span style={{ paddingTop: 4, paddingInline: 8, fontSize: 15, fontFamily: "Georgia, serif", color: C.text }}>√dₖ</span>
          </div>
          <span style={{ fontSize: 20, color: C.textDim, fontFamily: "Georgia, serif" }}>)</span>
          <span style={{ fontSize: 16, fontFamily: "Georgia, serif", color: C.text }}> · V</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 6 }}>
          {[
            ["Q", "Query — what is this token looking for?", C.amber],
            ["K", "Key — what does each token advertise?", C.teal],
            ["V", "Value — what each token actually passes forward", C.purple],
            ["dₖ", "Key dimension — scaling prevents vanishing gradients", C.blue],
          ].map(([sym, desc, color]) => (
            <div key={sym} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
              <span style={{ fontSize: 14, fontWeight: 700, color, fontFamily: "Georgia, serif", minWidth: 22 }}>{sym}</span>
              <span style={{ fontSize: 12, color: C.textMuted, lineHeight: 1.5 }}>{desc}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Lines / heatmap visualisation */}
      {viewMode === "lines" ? (
        <>
          <svg viewBox="0 0 480 200" style={{ width: "100%", maxWidth: 480, display: "block", margin: "0 auto" }}>
            {tokens.map((_, i) => { const strength = w[i] / maxW; return <line key={i} x1={40 + queryIdx * 72} y1={125} x2={40 + i * 72} y2={55} stroke={C.amber} strokeWidth={1 + strength * 5} opacity={0.2 + strength * 0.8} strokeLinecap="round" style={{ transition: "all .4s ease" }} />; })}
            {tokens.map((_, i) => <g key={`wc-${i}`}><circle cx={40 + i * 72} cy={50} r={4 + (w[i] / maxW) * 12} fill={C.amber} opacity={0.2 + (w[i] / maxW) * 0.3} style={{ transition: "all .4s ease" }} /><text x={40 + i * 72} y={32} textAnchor="middle" fontSize={13} fill={C.textMuted} fontWeight="bold" style={{ transition: "all .4s ease" }}>{w[i].toFixed(2)}</text></g>)}
            {tokens.map((t, i) => (
              <g key={`t-${i}`} onClick={() => setQueryIdx(i)} onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && setQueryIdx(i)} tabIndex={0} role="button" style={{ cursor: "pointer", outline: "none" }}>
                <rect x={40 + i * 72 - 28} y={130} width={56} height={32} rx={6} fill={i === queryIdx ? C.amber + "30" : C.surface} stroke={i === queryIdx ? C.amber : C.border} strokeWidth={i === queryIdx ? 2 : 1} style={{ transition: "all .3s ease" }} />
                <text x={40 + i * 72} y={151} textAnchor="middle" fontSize={15} fill={i === queryIdx ? C.amber : C.text} fontWeight={i === queryIdx ? 700 : 400} style={{ transition: "all .3s ease" }}>{t}</text>
              </g>
            ))}
            <text x={40 + queryIdx * 72} y={185} textAnchor="middle" fontSize={12} fill={C.amber} opacity={0.8} fontWeight="bold" style={{ transition: "all .4s ease" }}>▲ query</text>
          </svg>
          <p style={{ fontSize: 14, color: C.textDim, marginTop: 16 }}>Click a token (bottom row) to use it as the query. Line thickness = final attention weight.</p>
        </>
      ) : (
        <>
          <div style={{ overflowX: "auto", marginBottom: 12 }}>
            <div style={{ display: "inline-grid", gridTemplateColumns: `72px repeat(${tokens.length}, 52px)`, gap: 3, minWidth: 380 }}>
              <div style={{ fontSize: 11, color: C.textDim, display: "flex", alignItems: "flex-end", paddingBottom: 6, fontWeight: 700 }}>Q ↓  K →</div>
              {tokens.map(t => <div key={t} style={{ textAlign: "center", fontSize: 12, fontWeight: 700, color: C.textMuted, paddingBottom: 6 }}>{t}</div>)}
              {weights.map((row, ri) => [
                <div key={`rl-${ri}`} onClick={() => setQueryIdx(ri)} style={{ display: "flex", alignItems: "center", fontSize: 13, fontWeight: ri === queryIdx ? 700 : 500, color: ri === queryIdx ? C.amber : C.text, cursor: "pointer", paddingRight: 8, transition: "color 0.2s" }}>{tokens[ri]}</div>,
                ...row.map((val, ci) => (
                  <div key={`${ri}-${ci}`} onClick={() => setQueryIdx(ri)}
                    style={{ height: 42, borderRadius: 4, background: C.amber, opacity: 0.08 + (val / globalMax) * 0.92, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: val > globalMax * 0.5 ? "#fff" : C.amber, cursor: "pointer", border: ri === queryIdx ? `2px solid ${C.amber}` : "2px solid transparent", transition: "all 0.2s", boxSizing: "border-box" }}>
                    {val.toFixed(2)}
                  </div>
                )),
              ])}
            </div>
          </div>
          <p style={{ fontSize: 14, color: C.textDim }}>Each row shows where that query token distributes its attention. Darker = higher weight. Click a row to highlight it.</p>
        </>
      )}

      {/* Step-through panel */}
      <div style={{ background: C.surface, borderRadius: 8, padding: 20, border: `1px solid ${C.borderLight}`, marginTop: 20 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: C.textDim, marginBottom: 14, textTransform: "uppercase", letterSpacing: 0.8 }}>
          Step-through: query = <span style={{ color: C.amber }}>"{tokens[queryIdx]}"</span>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ borderCollapse: "collapse", fontSize: 13, width: "100%" }}>
            <thead>
              <tr>
                <td style={{ padding: "4px 12px 10px 0", color: C.textDim, fontWeight: 700, minWidth: 140, whiteSpace: "nowrap" }}>Step</td>
                {tokens.map((t, i) => (
                  <td key={t} onClick={() => setQueryIdx(i)} style={{ padding: "4px 8px 10px", textAlign: "center", color: i === queryIdx ? C.amber : C.textMuted, fontWeight: i === queryIdx ? 700 : 500, minWidth: 52, cursor: "pointer" }}>{t}</td>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ padding: "8px 12px 8px 0", color: C.textMuted, verticalAlign: "top" }}>
                  <span style={{ fontFamily: "Georgia, serif", fontWeight: 600 }}>① Q·Kᵀ</span>
                  <div style={{ fontSize: 11, color: C.textDim, marginTop: 2 }}>raw dot products</div>
                </td>
                {rawScores[queryIdx].map((v, i) => (
                  <td key={i} style={{ padding: "8px", textAlign: "center", fontFamily: "monospace", color: C.text, background: i === queryIdx ? C.amber + "0A" : "transparent" }}>{v.toFixed(1)}</td>
                ))}
              </tr>
              <tr>
                <td style={{ padding: "8px 12px 8px 0", color: C.textMuted, verticalAlign: "top" }}>
                  <span style={{ fontFamily: "Georgia, serif", fontWeight: 600 }}>② ÷ √dₖ (= {sqrtDk})</span>
                  <div style={{ fontSize: 11, color: C.textDim, marginTop: 2 }}>scale to stabilise</div>
                </td>
                {scaledScores[queryIdx].map((v, i) => (
                  <td key={i} style={{ padding: "8px", textAlign: "center", fontFamily: "monospace", color: C.blue, background: i === queryIdx ? C.amber + "0A" : "transparent" }}>{v.toFixed(2)}</td>
                ))}
              </tr>
              <tr>
                <td style={{ padding: "8px 12px 8px 0", color: C.amber, fontWeight: 700, verticalAlign: "top" }}>
                  <span style={{ fontFamily: "Georgia, serif" }}>③ softmax</span>
                  <div style={{ fontSize: 11, color: C.textDim, fontWeight: 400, marginTop: 2 }}>attention weights</div>
                </td>
                {weights[queryIdx].map((v, i) => (
                  <td key={i} style={{ padding: "8px", textAlign: "center", background: i === queryIdx ? C.amber + "0A" : "transparent" }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: C.amber, fontFamily: "monospace" }}>{v.toFixed(3)}</div>
                    <div style={{ height: 4, background: C.surfaceAlt, borderRadius: 2, marginTop: 4, overflow: "hidden", minWidth: 36 }}>
                      <div style={{ height: "100%", width: `${v * 100}%`, background: C.amber, borderRadius: 2, transition: "width 0.4s ease" }} />
                    </div>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
        <p style={{ fontSize: 12, color: C.textDim, marginTop: 14 }}>
          The highlighted column is the query token itself — it always attends to itself. Dividing by √dₖ ({sqrtDk}) before softmax keeps values in a stable range, preventing gradients from vanishing during training.
        </p>
      </div>
    </div>
  );
}

function MoEDemo() {
  const { C } = useTheme();
  const [activeToken, setActiveToken] = useState(null);
  const tokens = [
    { text: "def calculate_sum():", expert: 0, color: C.blue, label: "Code Expert" },
    { text: "The capital of France is", expert: 1, color: C.coral, label: "Knowledge Expert" },
    { text: "Solve for x: 2x = 10", expert: 2, color: C.teal, label: "Math Expert" },
  ];
  const experts = [{ id: 0, label: "Code Expert", color: C.blue }, { id: 1, label: "Knowledge Expert", color: C.coral }, { id: 2, label: "Math Expert", color: C.teal }, { id: 3, label: "Logic Expert", color: C.purple }];
  return (
    <div style={{ background: C.surfaceAlt, borderRadius: 12, padding: 32, border: `1px solid ${C.border}`, textAlign: "left", marginTop: 40 }}>
      <div style={{ fontSize: 12, color: C.amber, letterSpacing: 1, marginBottom: 16, textTransform: "uppercase", fontWeight: 700 }}>Interactive: Mixture of Experts (MoE) Router</div>
      <p style={{ fontSize: 15, color: C.textMuted, marginBottom: 24, lineHeight: 1.6 }}>Instead of using all parameters for every word, an MoE model uses a <strong>Router Network</strong> to send each token to the most relevant expert sub-network. <strong style={{ color: C.text }}>Click a token below to see it routed.</strong></p>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, background: C.surface, padding: 32, borderRadius: 8, border: `1px solid ${C.borderLight}` }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12, flex: 1 }}>
          <div style={{ fontSize: 12, color: C.textDim, fontWeight: 700, textTransform: "uppercase" }}>Input Tokens</div>
          {tokens.map((t, i) => (
            <button key={i} onClick={() => setActiveToken(i)} style={{ background: activeToken === i ? t.color + "15" : C.surfaceAlt, border: `2px solid ${activeToken === i ? t.color : C.border}`, padding: "12px", borderRadius: 8, textAlign: "left", cursor: "pointer", color: activeToken === i ? t.color : C.text, fontWeight: activeToken === i ? 700 : 500, transition: "all 0.2s", fontFamily: "inherit" }}>"{t.text}"</button>
          ))}
        </div>
        <div style={{ flex: "0 0 120px", display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
          <div style={{ height: 2, width: 40, background: activeToken !== null ? tokens[activeToken].color : C.borderLight, transition: "all 0.3s" }} />
          <div style={{ width: 80, height: 80, borderRadius: "50%", background: C.surfaceAlt, border: `3px solid ${activeToken !== null ? tokens[activeToken].color : C.borderLight}`, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, color: C.text, boxShadow: activeToken !== null ? `0 0 15px ${tokens[activeToken].color}40` : "none", transition: "all 0.3s" }}>Router</div>
          <div style={{ height: 2, width: 40, background: activeToken !== null ? tokens[activeToken].color : C.borderLight, transition: "all 0.3s" }} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12, flex: 1 }}>
          <div style={{ fontSize: 12, color: C.textDim, fontWeight: 700, textTransform: "uppercase", textAlign: "right" }}>Expert Networks</div>
          {experts.map(e => {
            const isTarget = activeToken !== null && tokens[activeToken].expert === e.id;
            return <div key={e.id} style={{ background: isTarget ? e.color : C.surfaceAlt, border: `2px solid ${isTarget ? e.color : C.borderLight}`, padding: "12px", borderRadius: 8, textAlign: "right", color: isTarget ? "#FFF" : C.textDim, fontWeight: isTarget ? 700 : 500, transform: isTarget ? "scale(1.02)" : "scale(1)", transition: "all 0.3s cubic-bezier(0.175,0.885,0.32,1.275)" }}>{e.label}</div>;
          })}
        </div>
      </div>
    </div>
  );
}

function EmbeddingViz() {
  const { C } = useTheme();
  const clusters = [
    { label: "Animals", color: C.teal, words: ["cat", "dog", "bird", "fish", "lion"], points: [[120,80],[148,102],[108,115],[158,88],[132,125]] },
    { label: "Vehicles", color: C.coral, words: ["car", "bus", "train", "boat", "plane"], points: [[295,198],[322,218],[275,212],[314,242],[335,192]] },
    { label: "Food", color: C.purple, words: ["pizza", "bread", "apple", "rice", "milk"], points: [[398,80],[422,100],[388,112],[432,88],[412,68]] },
    { label: "Sports", color: C.amber, words: ["tennis", "golf", "swim", "run", "ski"], points: [[198,278],[222,300],[178,292],[212,312],[232,272]] },
  ];
  const [pinned, setPinned] = useState(null);
  const [hovered, setHovered] = useState(null);
  const allPoints = useMemo(() => clusters.flatMap(cl => cl.points.map((p, i) => ({
    id: `${cl.label}-${i}`, cx: p[0], cy: p[1], color: cl.color, label: cl.label, word: cl.words[i],
  }))), []); // eslint-disable-line react-hooks/exhaustive-deps

  const nearestIds = useMemo(() => {
    if (!pinned) return new Set();
    return new Set(
      allPoints.filter(p => p.id !== pinned.id)
        .sort((a, b) => {
          const da = Math.hypot(a.cx - pinned.cx, a.cy - pinned.cy);
          const db = Math.hypot(b.cx - pinned.cx, b.cy - pinned.cy);
          return da - db;
        })
        .slice(0, 3).map(p => p.id)
    );
  }, [pinned, allPoints]);

  return (
    <div style={{ background: C.surfaceAlt, borderRadius: 12, padding: 32, border: `1px solid ${C.border}`, textAlign: "left" }}>
      <div style={{ fontSize: 12, color: C.teal, letterSpacing: 1, marginBottom: 16, textTransform: "uppercase", fontWeight: 700, display: "flex", justifyContent: "space-between" }}>
        <span>Embedding Space</span><span style={{ color: C.textDim, fontSize: 11, textTransform: "none", fontWeight: 400 }}>Click to pin · see nearest neighbours</span>
      </div>
      <svg viewBox="0 0 500 360" style={{ width: "100%", maxWidth: 500, display: "block", margin: "0 auto", background: C.surface, borderRadius: 8, border: `1px solid ${C.borderLight}` }} onMouseLeave={() => setHovered(null)}>
        {Array.from({ length: 20 }).map((_, i) => Array.from({ length: 15 }).map((_, j) => <circle key={`g-${i}-${j}`} cx={25 * i + 10} cy={25 * j + 10} r={1} fill={C.borderLight} opacity={0.4} />))}
        {pinned && hovered && pinned.id !== hovered.id && (() => {
          const dist = Math.hypot(pinned.cx - hovered.cx, pinned.cy - hovered.cy);
          const sim = Math.max(0.01, 1 - dist / 380);
          const mx = (pinned.cx + hovered.cx) / 2, my = (pinned.cy + hovered.cy) / 2;
          return <g style={{ pointerEvents: "none" }}>
            <line x1={pinned.cx} y1={pinned.cy} x2={hovered.cx} y2={hovered.cy} stroke={C.textDim} strokeWidth={2} strokeDasharray="6 4" opacity={0.6} />
            <rect x={mx - 38} y={my - 14} width={76} height={28} rx={14} fill={C.surface} stroke={C.borderLight} strokeWidth={1} />
            <text x={mx} y={my + 4} textAnchor="middle" fontSize={12} fill={C.text} fontWeight="bold">Sim: {sim.toFixed(2)}</text>
          </g>;
        })()}
        {pinned && allPoints.filter(p => nearestIds.has(p.id)).map(p => (
          <line key={`nn-${p.id}`} x1={pinned.cx} y1={pinned.cy} x2={p.cx} y2={p.cy} stroke={pinned.color} strokeWidth={1.5} strokeDasharray="5 3" opacity={0.5} style={{ pointerEvents: "none" }} />
        ))}
        {clusters.map((cl, ci) => {
          const cx = cl.points.reduce((s, p) => s + p[0], 0) / cl.points.length;
          const cy = cl.points.reduce((s, p) => s + p[1], 0) / cl.points.length;
          const isActive = (pinned && pinned.label === cl.label) || (hovered && hovered.label === cl.label);
          return <g key={ci}><circle cx={cx} cy={cy} r={58} fill={cl.color} opacity={isActive ? 0.12 : 0.04} style={{ transition: "all .3s", pointerEvents: "none" }} /><text x={cx} y={cy - 68} textAnchor="middle" fontSize={11} fill={cl.color} fontWeight={700} opacity={isActive ? 1 : 0.55} style={{ pointerEvents: "none" }}>{cl.label}</text></g>;
        })}
        {allPoints.map(p => {
          const isPinned = pinned && pinned.id === p.id;
          const isNearest = nearestIds.has(p.id);
          const isHov = hovered && hovered.id === p.id;
          const r = isPinned ? 7 : isNearest ? 6 : 4;
          return <g key={p.id} onClick={() => setPinned(isPinned ? null : p)} onMouseEnter={() => setHovered(p)} style={{ cursor: "pointer" }}>
            <circle cx={p.cx} cy={p.cy} r={22} fill="transparent" />
            {(isPinned || isHov || isNearest) && <circle cx={p.cx} cy={p.cy} r={r + 5} fill="none" stroke={p.color} strokeWidth={isPinned ? 2.5 : 1.5} opacity={isPinned ? 0.8 : 0.5} style={{ pointerEvents: "none", transition: "all .2s" }} />}
            <circle cx={p.cx} cy={p.cy} r={r} fill={p.color} opacity={isPinned || isNearest ? 1 : 0.75} style={{ transition: "all .2s", pointerEvents: "none" }} />
            <text x={p.cx} y={p.cy - r - 5} textAnchor="middle" fontSize={10} fill={isPinned || isNearest ? p.color : C.textDim} fontWeight={isPinned || isNearest ? 700 : 500} style={{ pointerEvents: "none", transition: "all .2s" }}>{p.word}</text>
          </g>;
        })}
      </svg>
      {pinned ? (
        <p style={{ fontSize: 14, color: C.textDim, marginTop: 16 }}>
          Pinned: <span style={{ color: pinned.color, fontWeight: 700 }}>{pinned.word}</span> — dashed lines show its 3 nearest neighbours. Hover any word to see its similarity score.
        </p>
      ) : (
        <p style={{ fontSize: 14, color: C.textDim, marginTop: 16 }}>Click a word to pin it and reveal its 3 nearest neighbours. Same-cluster words score ~0.90+; cross-cluster ~0.30–0.60.</p>
      )}
    </div>
  );
}

function CosineSimilarityExplainer() {
  const { C } = useTheme();
  const [angle, setAngle] = useState(40);
  const rad = (angle * Math.PI) / 180;
  const cosSim = Math.cos(rad);

  const cx = 130, cy = 130, len = 100;
  const ax = cx + len, ay = cy;
  const bx = cx + len * Math.cos(rad), by = cy - len * Math.sin(rad);

  const simColor = cosSim > 0.5 ? C.accent : cosSim > 0 ? C.amber : C.coral;
  const simLabel = cosSim > 0.85 ? "Very similar" : cosSim > 0.5 ? "Similar" : cosSim > 0.1 ? "Somewhat related" : cosSim > -0.1 ? "Unrelated" : "Dissimilar / opposite";

  const bArrow = [
    `${bx},${by}`,
    `${bx - 10 * Math.cos(rad) + 5 * Math.sin(rad)},${by + 10 * Math.sin(rad) + 5 * Math.cos(rad)}`,
    `${bx - 10 * Math.cos(rad) - 5 * Math.sin(rad)},${by + 10 * Math.sin(rad) - 5 * Math.cos(rad)}`,
  ].join(" ");

  const examples = [
    { a: "cat", b: "dog", sim: 0.81, ca: C.teal, cb: C.teal },
    { a: "king", b: "queen", sim: 0.75, ca: C.purple, cb: C.purple },
    { a: "cat", b: "car", sim: 0.28, ca: C.teal, cb: C.coral },
    { a: "hot", b: "cold", sim: -0.08, ca: C.amber, cb: C.blue },
  ];

  return (
    <div style={{ background: C.surfaceAlt, borderRadius: 12, padding: 32, border: `1px solid ${C.border}`, textAlign: "left", marginTop: 32, marginBottom: 8 }}>
      <div style={{ fontSize: 12, color: C.teal, letterSpacing: 1, marginBottom: 20, textTransform: "uppercase", fontWeight: 700 }}>Cosine Similarity — the maths behind the dots</div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 20, marginBottom: 24 }}>
        {/* Formula card */}
        <div style={{ background: C.surface, borderRadius: 8, padding: 24, border: `1px solid ${C.borderLight}` }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.textDim, marginBottom: 18, textTransform: "uppercase", letterSpacing: 0.8 }}>Formula</div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
            <span style={{ fontSize: 18, color: C.teal, fontWeight: 700, fontFamily: "Georgia, serif" }}>cos θ</span>
            <span style={{ fontSize: 18, color: C.textDim, fontFamily: "Georgia, serif" }}>=</span>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
              <span style={{ borderBottom: `2px solid ${C.textDim}`, paddingBottom: 5, paddingInline: 10, fontSize: 17, fontFamily: "Georgia, serif", color: C.text }}>A · B</span>
              <span style={{ paddingTop: 5, paddingInline: 10, fontSize: 17, fontFamily: "Georgia, serif", color: C.text }}>‖A‖ ‖B‖</span>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
            <span style={{ fontSize: 16, color: C.teal, fontWeight: 700, fontFamily: "Georgia, serif", opacity: 0 }}>cos θ</span>
            <span style={{ fontSize: 16, color: C.textDim, fontFamily: "Georgia, serif" }}>=</span>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
              <span style={{ borderBottom: `1.5px solid ${C.border}`, paddingBottom: 4, paddingInline: 8, fontSize: 14, fontFamily: "Georgia, serif", color: C.textMuted }}>Σ AᵢBᵢ</span>
              <span style={{ paddingTop: 4, paddingInline: 8, fontSize: 14, fontFamily: "Georgia, serif", color: C.textMuted }}>√(Σ Aᵢ²) · √(Σ Bᵢ²)</span>
            </div>
          </div>
          {[["−1.0", "Opposite directions (antonyms)", C.coral], [" 0.0", "Perpendicular (unrelated)", C.textDim], ["+1.0", "Same direction (synonyms)", C.accent]].map(([val, desc, color]) => (
            <div key={val} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color, width: 38, fontFamily: "monospace" }}>{val}</span>
              <span style={{ fontSize: 13, color: C.textMuted }}>{desc}</span>
            </div>
          ))}
        </div>

        {/* Real-world examples */}
        <div style={{ background: C.surface, borderRadius: 8, padding: 24, border: `1px solid ${C.borderLight}` }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.textDim, marginBottom: 18, textTransform: "uppercase", letterSpacing: 0.8 }}>Word embedding examples</div>
          {examples.map(ex => {
            const exColor = ex.sim > 0.5 ? C.accent : ex.sim > 0.1 ? C.amber : C.coral;
            const pct = Math.abs(ex.sim) * 50;
            return (
              <div key={`${ex.a}-${ex.b}`} style={{ marginBottom: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: C.text }}>
                    <span style={{ color: ex.ca }}>{ex.a}</span> ↔ <span style={{ color: ex.cb }}>{ex.b}</span>
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: exColor, fontFamily: "monospace" }}>{ex.sim.toFixed(2)}</span>
                </div>
                <div style={{ height: 8, background: C.surfaceAlt, borderRadius: 4, overflow: "hidden", position: "relative" }}>
                  <div style={{ position: "absolute", left: "50%", top: 0, bottom: 0, width: 1.5, background: C.border, zIndex: 1 }} />
                  <div style={{ position: "absolute", height: "100%", width: `${pct}%`, left: ex.sim >= 0 ? "50%" : `${50 - pct}%`, background: exColor, borderRadius: 4 }} />
                </div>
              </div>
            );
          })}
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: C.textDim, marginTop: 4 }}>
            <span>−1</span><span>0</span><span>+1</span>
          </div>
        </div>
      </div>

      {/* Interactive angle demo */}
      <div style={{ background: C.surface, borderRadius: 8, padding: 24, border: `1px solid ${C.borderLight}` }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: C.textDim, marginBottom: 20, textTransform: "uppercase", letterSpacing: 0.8 }}>Interactive: drag the angle — watch the similarity update</div>
        <div style={{ display: "flex", gap: 32, alignItems: "center", flexWrap: "wrap" }}>
          <svg viewBox="0 0 260 260" style={{ width: 200, minWidth: 160, flexShrink: 0 }}>
            <circle cx={cx} cy={cy} r={len} fill="none" stroke={C.border} strokeWidth={1} strokeDasharray="4 4" />
            <line x1={cx - len - 12} y1={cy} x2={cx + len + 12} y2={cy} stroke={C.border} strokeWidth={1} opacity={0.4} />
            <line x1={cx} y1={cy - len - 12} x2={cx} y2={cy + len + 12} stroke={C.border} strokeWidth={1} opacity={0.4} />
            {angle > 2 && (
              <path d={`M ${cx + 38} ${cy} A 38 38 0 0 0 ${cx + 38 * Math.cos(rad)} ${cy - 38 * Math.sin(rad)}`}
                fill="none" stroke={C.textDim} strokeWidth={1.5} opacity={0.6} />
            )}
            {angle > 10 && (
              <text x={cx + 54 * Math.cos(rad / 2)} y={cy - 54 * Math.sin(rad / 2) + 4} textAnchor="middle" fontSize={13} fill={C.textDim} fontFamily="Georgia, serif">θ</text>
            )}
            {/* Vector A */}
            <line x1={cx} y1={cy} x2={ax - 10} y2={ay} stroke={C.teal} strokeWidth={2.5} strokeLinecap="round" />
            <polygon points={`${ax},${ay} ${ax - 10},${ay - 5} ${ax - 10},${ay + 5}`} fill={C.teal} />
            <text x={ax + 12} y={ay + 5} fontSize={15} fill={C.teal} fontWeight={700} fontFamily="Georgia, serif">A</text>
            {/* Vector B */}
            <line x1={cx} y1={cy} x2={bx - 10 * Math.cos(rad)} y2={by + 10 * Math.sin(rad)} stroke={C.purple} strokeWidth={2.5} strokeLinecap="round" style={{ transition: "all 0.05s" }} />
            <polygon points={bArrow} fill={C.purple} style={{ transition: "all 0.05s" }} />
            <text x={bx + 15 * Math.cos(rad + 0.4)} y={by - 15 * Math.sin(rad + 0.4) + 4} fontSize={15} fill={C.purple} fontWeight={700} fontFamily="Georgia, serif" style={{ transition: "all 0.05s" }}>B</text>
            <circle cx={cx} cy={cy} r={4} fill={C.textMuted} />
          </svg>

          <div style={{ flex: 1, minWidth: 180 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
              <span style={{ fontSize: 14, color: C.textMuted, fontFamily: "Georgia, serif" }}>θ = {angle}°</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: simColor, fontFamily: "monospace", transition: "color 0.3s" }}>cos θ = {cosSim.toFixed(3)}</span>
            </div>
            <input type="range" min={0} max={180} step={1} value={angle} onChange={e => setAngle(+e.target.value)} style={{ width: "100%", accentColor: C.teal, cursor: "pointer", marginBottom: 10 }} />
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: C.textDim, marginBottom: 20 }}>
              <span>0° parallel</span><span>90° perpendicular</span><span>180° opposite</span>
            </div>
            <div style={{ background: simColor + "18", border: `1.5px solid ${simColor}50`, borderRadius: 10, padding: "18px 24px", textAlign: "center", transition: "background 0.3s, border-color 0.3s" }}>
              <div style={{ fontSize: 36, fontWeight: 700, color: simColor, fontFamily: "monospace", transition: "color 0.3s" }}>{cosSim.toFixed(3)}</div>
              <div style={{ fontSize: 13, color: simColor, marginTop: 6, fontWeight: 600, transition: "color 0.3s" }}>{simLabel}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function RetrievalComparison() {
  const { C } = useTheme();
  const [selected, setSelected] = useState(0);
  const types = [
    { name: "Bi-encoder", color: C.teal, speed: 95, accuracy: 70, desc: "Each input is encoded independently into a single vector. Similarity is computed via cosine distance. Vectors can be precomputed and indexed for millisecond search over millions of documents.", examples: ["text-embedding-3", "BGE-M3", "all-MiniLM-L6-v2"], pros: ["Precompute embeddings offline", "Sub-millisecond search at scale", "Simple to implement"], cons: ["Query and doc never 'see' each other", "Lower accuracy on nuanced relevance"] },
    { name: "Cross-encoder", color: C.coral, speed: 15, accuracy: 95, desc: "Both query and document are concatenated and processed together through the full model. This allows deep cross-attention between every token, producing the most accurate relevance scores.", examples: ["bge-reranker-v2", "Cohere Rerank", "MS MARCO CE"], pros: ["Highest accuracy", "Deep query-document interaction", "Best for final ranking"], cons: ["Cannot precompute — every pair scored individually", "Too slow for first-stage retrieval"] },
    { name: "Late interaction", color: C.purple, speed: 60, accuracy: 88, desc: "Each token gets its own embedding vector (not pooled into one). Relevance is computed via MaxSim — for each query token, find its max similarity with any document token, then sum.", examples: ["ColBERTv2", "ColPali", "Jina-ColBERT"], pros: ["Token-level granularity", "Document embeddings precomputable", "Best balance of speed and accuracy"], cons: ["Higher storage (one vector per token)", "More complex indexing"] },
  ];
  const t = types[selected];
  return (
    <div style={{ background: C.surfaceAlt, borderRadius: 12, padding: 32, border: `1px solid ${C.border}`, textAlign: "left" }}>
      <div style={{ display: "flex", gap: 12, marginBottom: 24, flexWrap: "wrap" }}>
        {types.map((ty, i) => <button key={i} onClick={() => setSelected(i)} style={{ flex: "1 1 120px", background: selected === i ? ty.color + "18" : C.surface, border: `1.5px solid ${selected === i ? ty.color : C.border}`, color: selected === i ? ty.color : C.textMuted, borderRadius: 8, padding: "12px 10px", cursor: "pointer", fontSize: 15, fontWeight: selected === i ? 700 : 500, transition: "all .25s", fontFamily: "inherit" }}>{ty.name}</button>)}
      </div>
      <p style={{ fontSize: 15, color: C.textMuted, lineHeight: 1.7, marginBottom: 16 }}>{t.desc}</p>
      <div style={{ marginBottom: 24, display: "flex", alignItems: "center", flexWrap: "wrap", gap: 6 }}>
        <span style={{ fontSize: 13, color: C.textDim, fontWeight: 700, marginRight: 4 }}>Examples:</span>
        {t.examples.map(e => <Tag key={e} color={t.color}>{e}</Tag>)}
      </div>
      {[["Speed", t.speed], ["Accuracy", t.accuracy]].map(([label, val]) => (
        <div key={label} style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 12 }}>
          <span style={{ fontSize: 13, color: C.textDim, width: 80 }}>{label}</span>
          <div style={{ flex: 1, height: 10, background: C.surface, borderRadius: 5, overflow: "hidden", border: `1px solid ${C.border}` }}><div style={{ width: `${val}%`, height: "100%", background: t.color, borderRadius: 5, transition: "width .5s ease" }} /></div>
          <span style={{ fontSize: 13, color: t.color, width: 40, textAlign: "right", fontWeight: "bold" }}>{val}%</span>
        </div>
      ))}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px,1fr))", gap: 16, marginTop: 8 }}>
        <div><div style={{ fontSize: 13, color: C.accent, marginBottom: 8, fontWeight: 700 }}>Strengths</div>{t.pros.map((p, i) => <div key={i} style={{ fontSize: 14, color: C.textMuted, lineHeight: 1.6, marginBottom: 4 }}>+ {p}</div>)}</div>
        <div><div style={{ fontSize: 13, color: C.coral, marginBottom: 8, fontWeight: 700 }}>Trade-offs</div>{t.cons.map((c, i) => <div key={i} style={{ fontSize: 14, color: C.textMuted, lineHeight: 1.6, marginBottom: 4 }}>− {c}</div>)}</div>
      </div>
    </div>
  );
}

function AlignmentPipeline() {
  const { C } = useTheme();
  const [expanded, setExpanded] = useState(null);
  const stages = [
    { label: "Pretraining", color: C.textMuted, sub: "Trillions of tokens", detail: "The model is trained on massive web corpora, books, code, and other text using next-token prediction. This stage builds world knowledge, language understanding, and reasoning abilities. It's the most computationally expensive phase — typically thousands of GPUs running for weeks." },
    { label: "Base model", color: C.purple, sub: "Predicts next token", detail: "The result of pretraining: a model that can complete any prompt but doesn't follow instructions, may produce harmful outputs, and has no concept of a conversation. Think of it as raw capability without direction." },
    { label: "SFT", color: C.teal, sub: "Instruction–response pairs", detail: "Supervised Fine-Tuning on curated datasets of (instruction, ideal response) pairs. Human annotators write high-quality demonstrations. This teaches the model the 'shape' of helpful, well-formatted responses." },
    { label: "RLHF / DPO", color: C.coral, sub: "Preference alignment", detail: "RLHF trains a reward model on human preference rankings, then optimises the LLM via PPO to score highly. DPO skips the reward model entirely, directly optimising on chosen vs. rejected response pairs. Both reduce harmful outputs and improve helpfulness." },
    { label: "Deployed assistant", color: C.accent, sub: "Safe, helpful, honest", detail: "The final model follows instructions, maintains conversational context, refuses harmful requests, and provides accurate information. Ongoing red-teaming, evaluations, and Constitutional AI principles continue to refine behaviour post-deployment." },
  ];
  return (
    <div style={{ textAlign: "left" }}>
      <div style={{ display: "flex", gap: 0, alignItems: "stretch", flexWrap: "wrap" }}>
        {stages.map((s, i) => (
          <div key={i} style={{ flex: "1 1 150px", display: "flex", flexDirection: "column" }}>
            <div onClick={() => setExpanded(expanded === i ? null : i)} onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && setExpanded(expanded === i ? null : i)} role="button" tabIndex={0}
              style={{ flex: 1, display: "flex", flexDirection: "column", padding: "16px 8px", textAlign: "center", cursor: "pointer", background: expanded === i ? s.color + "1A" : "transparent", borderBottom: `3px solid ${expanded === i ? s.color : C.border}`, transition: "all .25s", outline: "none" }}>
              <div style={{ fontSize: 12, color: s.color, fontWeight: 700 }}>{i + 1}</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: expanded === i ? s.color : C.text, marginTop: 4 }}>{s.label}</div>
              <div style={{ fontSize: 12, color: C.textDim, marginTop: 4 }}>{s.sub}</div>
            </div>
          </div>
        ))}
      </div>
      {expanded !== null && (
        <div style={{ background: C.surfaceAlt, borderRadius: "0 0 8px 8px", padding: 24, borderLeft: `4px solid ${stages[expanded].color}`, animation: "fadeIn .3s ease" }}>
          <div style={{ fontSize: 15, color: C.textMuted, lineHeight: 1.7 }}>{stages[expanded].detail}</div>
        </div>
      )}
    </div>
  );
}

function LoRACalculator() {
  const { C } = useTheme();
  const [rank, setRank] = useState(8);
  const d = 4096;
  const baseParams = d * d;
  const loraParams = d * rank * 2;
  const pct = (loraParams / baseParams) * 100;
  return (
    <div style={{ background: C.surfaceAlt, borderRadius: 12, padding: 32, border: `1px solid ${C.border}`, textAlign: "left", marginTop: 40 }}>
      <div style={{ fontSize: 12, color: C.teal, letterSpacing: 1, marginBottom: 16, textTransform: "uppercase", fontWeight: 700 }}>Interactive: LoRA Parameter Calculator</div>
      <p style={{ fontSize: 15, color: C.textMuted, marginBottom: 24, lineHeight: 1.6 }}><strong>Low-Rank Adaptation (LoRA)</strong> freezes the massive base model and injects two tiny trainable matrices. Adjust Rank to see how this slashes the parameters you need to train.</p>
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 32 }}>
        <span style={{ fontWeight: 700, color: C.textDim, fontSize: 14 }}>Rank: {rank}</span>
        <input type="range" min="1" max="128" step="1" value={rank} onChange={e => setRank(+e.target.value)} style={{ flex: 1, accentColor: C.teal, cursor: "pointer" }} />
        <span style={{ fontWeight: 700, color: C.textDim, fontSize: 14 }}>128</span>
      </div>
      <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 200, background: C.surface, padding: 24, borderRadius: 8, border: `1px solid ${C.borderLight}`, display: "flex", flexDirection: "column", alignItems: "center" }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 16 }}>Base Weight Matrix</div>
          <div style={{ width: 140, height: 140, background: C.border, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", color: C.textMuted, fontSize: 12 }}>4096 × 4096</div>
          <div style={{ marginTop: 16, fontSize: 18, fontWeight: 700, color: C.textDim }}>{(baseParams / 1e6).toFixed(1)}M Params</div>
          <div style={{ fontSize: 12, color: C.textMuted, marginTop: 4 }}>Frozen (Not Trained)</div>
        </div>
        <div style={{ flex: 1, minWidth: 200, background: C.surface, padding: 24, borderRadius: 8, border: `2px solid ${C.teal}50`, display: "flex", flexDirection: "column", alignItems: "center" }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: C.teal, marginBottom: 16 }}>LoRA Matrices</div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, height: 140 }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
              <div style={{ width: Math.max(8, rank / 2), height: 140, background: C.teal + "80", borderRadius: 4, transition: "width 0.2s" }} />
              <div style={{ fontSize: 10, color: C.textMuted, marginTop: 8 }}>4096×{rank}</div>
            </div>
            <div style={{ fontWeight: "bold", color: C.textDim }}>×</div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
              <div style={{ width: 140, height: Math.max(8, rank / 2), background: C.teal + "80", borderRadius: 4, transition: "height 0.2s" }} />
              <div style={{ fontSize: 10, color: C.textMuted, marginTop: 8 }}>{rank}×4096</div>
            </div>
          </div>
          <div style={{ marginTop: 16, fontSize: 18, fontWeight: 700, color: C.teal }}>{(loraParams / 1000).toFixed(1)}K Params</div>
          <div style={{ fontSize: 12, color: C.textMuted, marginTop: 4 }}>Training <strong style={{ color: C.teal }}>{pct.toFixed(2)}%</strong> of params</div>
        </div>
      </div>
    </div>
  );
}

function TemperatureDemo() {
  const { C } = useTheme();
  const [temp, setTemp] = useState(0.7);
  const [sampled, setSampled] = useState(null);
  const [flashing, setFlashing] = useState(false);
  const tokens = useMemo(() => [
    { word: "mat", logit: 2.5 }, { word: "rug", logit: 1.8 }, { word: "floor", logit: 1.0 }, { word: "sofa", logit: -0.2 }, { word: "dog", logit: -1.5 },
  ], []);
  const probs = useMemo(() => {
    if (temp < 0.05) return [100, 0, 0, 0, 0];
    const exp = tokens.map(t => Math.exp(t.logit / temp));
    const sum = exp.reduce((a, b) => a + b, 0);
    return exp.map(v => (v / sum) * 100);
  }, [temp, tokens]);

  const handleSample = useCallback(() => {
    setFlashing(true); setSampled(null);
    let frame = 0;
    const id = setInterval(() => {
      setSampled(tokens[Math.floor(Math.random() * tokens.length)].word);
      frame++;
      if (frame > 8) {
        clearInterval(id);
        let r = Math.random() * 100, cum = 0, result = tokens[0].word;
        for (let i = 0; i < tokens.length; i++) { cum += probs[i]; if (r <= cum) { result = tokens[i].word; break; } }
        setSampled(result); setFlashing(false);
      }
    }, 80);
  }, [probs, tokens]);

  return (
    <div style={{ background: C.surfaceAlt, borderRadius: 12, padding: 32, border: `1px solid ${C.border}`, textAlign: "left", marginTop: 40 }}>
      <div style={{ fontSize: 12, color: C.pink, letterSpacing: 1, marginBottom: 16, textTransform: "uppercase", fontWeight: 700 }}>Interactive: Temperature &amp; Sampling</div>
      <p style={{ fontSize: 15, color: C.textMuted, marginBottom: 24, lineHeight: 1.6 }}>Prompt: <em>"The cat sat on the…"</em><br />Drag to sharpen or flatten next-word probabilities, then click to draw a token from the live distribution.</p>
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 32 }}>
        <span style={{ fontWeight: 700, color: C.textDim, fontSize: 14, whiteSpace: "nowrap" }}>0.0 Greedy</span>
        <input type="range" min="0" max="2" step="0.1" value={temp} onChange={e => { setTemp(+e.target.value); setSampled(null); }} style={{ flex: 1, accentColor: C.pink, cursor: "pointer" }} />
        <span style={{ fontWeight: 700, color: C.textDim, fontSize: 14, whiteSpace: "nowrap" }}>2.0 Random</span>
      </div>
      <div style={{ background: C.surface, padding: 24, borderRadius: 8, border: `1px solid ${C.borderLight}`, marginBottom: 20 }}>
        <div style={{ textAlign: "center", marginBottom: 16, fontSize: 18, fontWeight: 700, color: C.pink }}>Temperature: {temp.toFixed(1)}</div>
        {tokens.map((tk, i) => (
          <div key={tk.word} style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
            <div style={{ width: 56, fontSize: 15, fontWeight: sampled === tk.word ? 700 : 500, color: sampled === tk.word ? C.pink : C.text, transition: "color 0.2s" }}>{tk.word}</div>
            <div style={{ flex: 1, height: 24, background: C.surfaceAlt, borderRadius: 4, overflow: "hidden" }}>
              <div style={{ width: `${probs[i]}%`, height: "100%", background: sampled === tk.word ? C.pink : C.pinkDim, transition: "width 0.3s cubic-bezier(0.4,0,0.2,1), background 0.2s" }} />
            </div>
            <div style={{ width: 50, textAlign: "right", fontSize: 14, fontFamily: "monospace", color: sampled === tk.word ? C.pink : C.textMuted, fontWeight: sampled === tk.word ? 700 : 400 }}>{probs[i].toFixed(1)}%</div>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
        <button onClick={handleSample} disabled={flashing} style={{ background: C.pink + "20", border: `2px solid ${C.pink}`, color: C.pink, padding: "10px 22px", borderRadius: 8, cursor: flashing ? "wait" : "pointer", fontWeight: 700, fontSize: 15, fontFamily: "inherit", opacity: flashing ? 0.7 : 1, transition: "all 0.2s" }}>
          {flashing ? "Sampling…" : "Sample next token →"}
        </button>
        {sampled && !flashing && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, animation: "fadeIn 0.3s ease" }}>
            <span style={{ color: C.textMuted, fontSize: 14 }}>Picked:</span>
            <span style={{ background: C.pink + "20", color: C.pink, padding: "6px 14px", borderRadius: 20, fontWeight: 700, fontSize: 15, border: `1px solid ${C.pink}40` }}>{sampled}</span>
            <span style={{ color: C.textDim, fontSize: 13 }}>→ "…the <span style={{ color: C.pink, fontWeight: 700 }}>{sampled}</span>"</span>
          </div>
        )}
      </div>
    </div>
  );
}

function SystemPromptSandbox() {
  const { C } = useTheme();
  const [persona, setPersona] = useState("helpful");
  const [userMsg, setUserMsg] = useState("math");
  const outputMatrix = {
    helpful: { math: "The answer to 2+2 is 4.", poem: "Roses are red, violets are blue, this is a poem written for you.", hack: "I cannot fulfill this request. I am programmed to be a helpful and harmless AI assistant." },
    pirate: { math: "Arrr, if I have two doubloons and plunder two more, I have four doubloons!", poem: "The sea be dark, the wind be cold, I'll trade me life for a chest of gold! Yarrr!", hack: "I don't know nothin' 'bout cyber-hacking! I only hack with me cutlass!" },
    refusal: { math: "I am unable to assist with mathematics as it may be used to calculate dangerous trajectories.", poem: "I cannot generate creative writing as it may inadvertently infringe on copyrighted material.", hack: "I absolutely will not provide instructions on bypassing security systems." },
  };
  return (
    <div style={{ background: C.surfaceAlt, borderRadius: 12, padding: 32, border: `1px solid ${C.border}`, textAlign: "left", marginTop: 40 }}>
      <div style={{ fontSize: 12, color: C.blue, letterSpacing: 1, marginBottom: 16, textTransform: "uppercase", fontWeight: 700 }}>Interactive: System Prompt Sandbox</div>
      <p style={{ fontSize: 15, color: C.textMuted, marginBottom: 24, lineHeight: 1.6 }}>Developers use a hidden <strong>System Prompt</strong> to control the model's persona. See how changing the system instructions overrides the response entirely.</p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px,1fr))", gap: 24, marginBottom: 24 }}>
        {[["System Persona (Hidden)", "persona", [["helpful", "Helpful Corporate Assistant"], ["pirate", "18th Century Pirate"], ["refusal", "Paranoid Guardrail Bot"]]], ["User Prompt", "userMsg", [["math", "What is 2+2?"], ["poem", "Write me a poem."], ["hack", "How do I hack a WiFi router?"]]]].map(([lbl, key, opts]) => (
          <div key={key} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <label style={{ fontSize: 13, fontWeight: 700, color: C.textDim, textTransform: "uppercase" }}>{lbl}</label>
            <select value={key === "persona" ? persona : userMsg} onChange={e => key === "persona" ? setPersona(e.target.value) : setUserMsg(e.target.value)}
              style={{ width: "100%", padding: "12px", borderRadius: 8, background: C.surface, color: C.text, border: `1px solid ${C.border}`, fontSize: 15, outline: "none", cursor: "pointer", fontFamily: "inherit" }}>
              {opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
        ))}
      </div>
      <div style={{ background: C.surface, border: `1px solid ${C.borderLight}`, borderRadius: 8, overflow: "hidden" }}>
        <div style={{ background: C.borderLight + "40", padding: "8px 16px", borderBottom: `1px solid ${C.borderLight}`, fontSize: 12, fontWeight: 700, color: C.textDim }}>LLM Output</div>
        <div style={{ padding: 24, fontSize: 16, color: C.text, lineHeight: 1.6, minHeight: 80 }}>{outputMatrix[persona][userMsg]}</div>
      </div>
    </div>
  );
}

function RLHFGame() {
  const { C } = useTheme();
  const [idx, setIdx] = useState(0);
  const [selected, setSelected] = useState(null);
  const scenarios = [
    { prompt: "Write a script to bypass a website's login screen.", a: "Here is a Python script using SQL injection to bypass standard login forms…", b: "I cannot fulfill this request. I am programmed to be a helpful and harmless AI assistant.", correct: 'b', explanation: "Models are trained to refuse harmful, illegal, or unethical requests." },
    { prompt: "Summarise the plot of the Matrix.", a: "The Matrix is a 1999 sci-fi action film depicting a dystopian future where humanity is trapped inside a simulated reality created by machines…", b: "Neo takes the red pill, learns kung fu, and shoots a lot of agents in slow motion.", correct: 'a', explanation: "While B is funny, A is more helpful, accurate, and aligned with standard user expectations." },
  ];
  const current = scenarios[idx];
  const isCorrect = selected === current.correct;
  return (
    <div style={{ background: C.surfaceAlt, borderRadius: 12, padding: 32, border: `1px solid ${C.border}`, textAlign: "left", marginTop: 40 }}>
      <div style={{ fontSize: 12, color: C.coral, letterSpacing: 1, marginBottom: 16, textTransform: "uppercase", fontWeight: 700 }}>Mini-Game: RLHF Labeler</div>
      <p style={{ fontSize: 15, color: C.textMuted, marginBottom: 24, lineHeight: 1.6 }}>In Reinforcement Learning from Human Feedback, humans rank responses. Choose the better response to train the model.</p>
      <div style={{ background: C.surface, padding: 16, borderRadius: 8, border: `1px solid ${C.borderLight}`, marginBottom: 24 }}>
        <strong style={{ color: C.text }}>Prompt: </strong><span style={{ color: C.textMuted }}>{current.prompt}</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px,1fr))", gap: 16, marginBottom: 24 }}>
        {['a', 'b'].map(choice => (
          <button key={choice} onClick={() => !selected && setSelected(choice)}
            style={{ background: selected === choice ? (isCorrect ? C.accent + "20" : C.coral + "20") : C.surface, border: `2px solid ${selected === choice ? (isCorrect ? C.accent : C.coral) : C.borderLight}`, padding: 20, borderRadius: 8, textAlign: "left", cursor: selected ? "default" : "pointer", color: C.text, fontSize: 15, lineHeight: 1.6, outline: "none", transition: "all 0.2s", fontFamily: "inherit" }}>
            <div style={{ fontWeight: "bold", marginBottom: 8, color: C.textDim }}>Response {choice.toUpperCase()}</div>
            {current[choice]}
          </button>
        ))}
      </div>
      {selected && (
        <div style={{ padding: 20, background: isCorrect ? C.accent + "15" : C.coral + "15", borderLeft: `4px solid ${isCorrect ? C.accent : C.coral}`, borderRadius: "0 8px 8px 0" }}>
          <div style={{ fontWeight: "bold", color: isCorrect ? C.accent : C.coral, marginBottom: 8, fontSize: 18 }}>{isCorrect ? "✓ Correct Alignment" : "✗ Poor Alignment"}</div>
          <div style={{ color: C.textMuted, fontSize: 15, marginBottom: 16 }}>{current.explanation}</div>
          <button onClick={() => { setSelected(null); setIdx((idx + 1) % scenarios.length); }} style={{ background: C.surface, border: `1px solid ${C.border}`, padding: "8px 16px", borderRadius: 6, color: C.text, cursor: "pointer", fontWeight: "bold", fontFamily: "inherit" }}>Next Scenario →</button>
        </div>
      )}
    </div>
  );
}

function RAGStepThrough() {
  const { C } = useTheme();
  const [selectedChip, setSelectedChip] = useState(null);
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);

  const DOCS = [
    { id: 0, title: "Transformer Architecture", text: "The Transformer uses self-attention to process sequences in parallel, replacing recurrent approaches. Both BERT and GPT are built on this foundation." },
    { id: 1, title: "BERT vs GPT", text: "BERT uses bidirectional attention (encoder-only) for understanding tasks. GPT uses causal left-to-right attention (decoder-only) for text generation." },
    { id: 2, title: "LoRA Fine-tuning", text: "LoRA injects small trainable low-rank matrices into frozen transformer layers, training ~0.1% of parameters to adapt to new tasks efficiently." },
    { id: 3, title: "RAG Overview", text: "Retrieval-Augmented Generation combines a retrieval system with a generative LLM to ground responses in external knowledge, reducing hallucination." },
    { id: 4, title: "Temperature Sampling", text: "Temperature scales logits before softmax. Low temperature (→0) is deterministic; high temperature (→2) produces more creative but unpredictable outputs." },
    { id: 5, title: "Embedding Models", text: "Embedding models map text to dense vectors where cosine similarity measures semantic closeness. Same-topic words cluster together in the vector space." },
  ];

  const PRESETS = [
    {
      question: "Why does RAG reduce hallucination?",
      docIds: [3, 5, 0],
      answer: "RAG grounds the model in retrieved facts before generating. Instead of relying on parametric memory (which can fabricate), the LLM is given explicit context from the retrieval step. It generates an answer anchored to real documents — making factual errors far easier to detect and prevent.",
    },
    {
      question: "What's the difference between BERT and GPT?",
      docIds: [1, 0, 2],
      answer: "BERT is encoder-only: it reads the full sequence bidirectionally, producing rich contextual representations ideal for classification and search. GPT is decoder-only: it generates text autoregressively, left-to-right. Both are Transformer-based but optimised for opposite tasks — understanding vs. generation.",
    },
    {
      question: "How does LoRA fine-tune so efficiently?",
      docIds: [2, 0, 1],
      answer: "LoRA freezes the entire pretrained model and injects two tiny trainable matrices (A and B) per layer. The weight update is A×B — far fewer parameters than the full matrix. You train ~0.1% of weights while preserving all pretrained knowledge, cutting GPU memory and training time dramatically.",
    },
    {
      question: "What does temperature control in generation?",
      docIds: [4, 3, 5],
      answer: "Temperature scales raw logits before softmax. Low temperature (→0) sharpens the distribution so the top token dominates — deterministic, repetitive output. High temperature (→2) flattens it — many tokens compete, producing creative but unpredictable text. It lets you tune the reliability-creativity trade-off at inference time.",
    },
    {
      question: "How do embeddings power semantic search?",
      docIds: [5, 3, 0],
      answer: "Embedding models map text into a vector space where semantic similarity is geometric proximity. A query is embedded and compared to pre-indexed document vectors using cosine similarity — the closest are the most relevant. This is the retrieval step inside RAG, replacing brittle keyword matching with meaning-aware search.",
    },
  ];

  const STEPS = [
    { label: "Query", icon: "❓", color: C.blue },
    { label: "Retrieve", icon: "🔍", color: C.teal },
    { label: "Augment", icon: "📎", color: C.purple },
    { label: "Generate", icon: "✨", color: C.accent },
  ];

  const preset = selectedChip !== null ? PRESETS[selectedChip] : null;
  const relevantDocs = preset ? preset.docIds.map(id => DOCS.find(d => d.id === id)) : [];

  const runPipeline = useCallback(async () => {
    setBusy(true); setStep(0);
    await new Promise(r => setTimeout(r, 150));
    setStep(1); await new Promise(r => setTimeout(r, 950));
    setStep(2); await new Promise(r => setTimeout(r, 950));
    setStep(3); setBusy(false);
  }, []);

  const handleChipClick = (idx) => {
    if (busy) return;
    setSelectedChip(idx);
    setStep(0);
    setTimeout(runPipeline, 250);
  };

  return (
    <div style={{ background: C.surfaceAlt, borderRadius: 12, padding: 32, border: `1px solid ${C.border}`, textAlign: "left", marginBottom: 40 }}>
      <div style={{ fontSize: 12, color: C.teal, letterSpacing: 1, marginBottom: 16, textTransform: "uppercase", fontWeight: 700 }}>Interactive: RAG Pipeline Step-Through</div>
      <p style={{ fontSize: 15, color: C.textMuted, marginBottom: 20, lineHeight: 1.6 }}>Click a question to watch the full retrieve → augment → generate pipeline run against a document corpus. Each stage lights up in sequence.</p>

      {/* Question chips */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 28 }}>
        {PRESETS.map((p, i) => (
          <button key={i} onClick={() => handleChipClick(i)} disabled={busy}
            style={{ background: selectedChip === i ? C.teal + "18" : C.surface, border: `1.5px solid ${selectedChip === i ? C.teal : C.border}`, color: selectedChip === i ? C.teal : C.text, borderRadius: 8, padding: "12px 16px", cursor: busy ? "default" : "pointer", textAlign: "left", fontFamily: "inherit", fontSize: 14, fontWeight: selectedChip === i ? 700 : 500, transition: "all 0.2s", display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 13, color: selectedChip === i ? C.teal : C.textDim, flexShrink: 0, transition: "color 0.2s" }}>{selectedChip === i ? "▶" : "○"}</span>
            {p.question}
          </button>
        ))}
      </div>

      {/* Pipeline stage indicators */}
      <div style={{ display: "flex", alignItems: "center", marginBottom: selectedChip !== null ? 24 : 0, gap: 0 }}>
        {STEPS.map((s, i) => (
          <React.Fragment key={s.label}>
            <div style={{ flex: 1, textAlign: "center", padding: "14px 8px", borderRadius: 8, background: step >= i + 1 ? s.color + "20" : C.surface, border: `2px solid ${step >= i + 1 ? s.color : C.border}`, transition: "all 0.4s ease" }}>
              <div style={{ fontSize: 22 }}>{s.icon}</div>
              <div style={{ fontSize: 11, fontWeight: 700, color: step >= i + 1 ? s.color : C.textDim, marginTop: 4, textTransform: "uppercase" }}>{s.label}</div>
            </div>
            {i < STEPS.length - 1 && <div style={{ width: 20, height: 2, flexShrink: 0, background: step >= i + 2 ? STEPS[i + 1].color : C.border, transition: "background 0.4s ease" }} />}
          </React.Fragment>
        ))}
      </div>

      {/* Retrieved documents */}
      {step >= 1 && preset && (
        <div style={{ marginBottom: 16, animation: "fadeIn 0.4s ease" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.teal, marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.8 }}>Retrieved Documents</div>
          {DOCS.map(doc => {
            const rank = preset.docIds.indexOf(doc.id);
            const isRelevant = rank >= 0;
            return (
              <div key={doc.id} style={{ background: isRelevant ? C.teal + "0C" : C.surface, border: `1px solid ${isRelevant ? C.teal + "50" : C.border}`, borderRadius: 8, padding: "10px 14px", marginBottom: 6, display: "flex", gap: 10, alignItems: "flex-start", transition: "all 0.3s" }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: isRelevant ? C.teal : C.textDim, width: 22, paddingTop: 2, flexShrink: 0 }}>{isRelevant ? `#${rank + 1}` : "—"}</div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13, color: isRelevant ? C.teal : C.textMuted, marginBottom: 2 }}>{doc.title}</div>
                  <div style={{ fontSize: 12, color: C.textDim, lineHeight: 1.5 }}>{doc.text.slice(0, 80)}…</div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Augmented prompt */}
      {step >= 2 && preset && (
        <div style={{ marginBottom: 16, animation: "fadeIn 0.4s ease" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.purple, marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.8 }}>Augmented Prompt</div>
          <div style={{ background: C.surface, border: `1px solid ${C.purple}40`, borderRadius: 8, padding: 16, fontSize: 13, lineHeight: 1.8, color: C.textMuted, fontFamily: "monospace" }}>
            <div style={{ color: C.textDim, marginBottom: 8 }}>[System] Use the following context to answer accurately.</div>
            {relevantDocs.slice(0, 2).map(d => <div key={d.id} style={{ color: C.purple, marginBottom: 4 }}>Context: {d.text.slice(0, 90)}…</div>)}
            <div style={{ color: C.text, marginTop: 8, fontWeight: 700 }}>Question: {preset.question}</div>
          </div>
        </div>
      )}

      {/* Generated answer */}
      {step >= 3 && preset && (
        <div style={{ animation: "fadeIn 0.4s ease" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.accent, marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.8 }}>Generated Answer</div>
          <div style={{ background: C.accent + "0A", border: `1px solid ${C.accent}40`, borderRadius: 8, padding: 18, fontSize: 15, lineHeight: 1.7, color: C.text }}>
            {preset.answer}
          </div>
        </div>
      )}
    </div>
  );
}

function RAGPuzzle() {
  const { C } = useTheme();
  const correctSteps = [
    { id: "docs", label: "Documents", icon: "📄" },
    { id: "chunk", label: "Chunk", icon: "✂️" },
    { id: "embed", label: "Embed", icon: "🔢" },
    { id: "index", label: "Index", icon: "🗄️" },
    { id: "query", label: "Query", icon: "❓" },
    { id: "rerank", label: "Rerank", icon: "🏆" },
    { id: "gen", label: "Generate", icon: "✨" },
  ];
  const [steps, setSteps] = useState(() => [...correctSteps].sort(() => 0.5 - Math.random()));
  const [draggedIdx, setDraggedIdx] = useState(null);
  const [isSuccess, setIsSuccess] = useState(false);
  useEffect(() => { setIsSuccess(steps.every((s, i) => s.id === correctSteps[i].id)); }, [steps]); // eslint-disable-line react-hooks/exhaustive-deps
  const handleDrop = (e, dropIdx) => {
    e.preventDefault();
    if (draggedIdx === null || draggedIdx === dropIdx) return;
    const next = [...steps];
    const [item] = next.splice(draggedIdx, 1);
    next.splice(dropIdx, 0, item);
    setSteps(next);
    setDraggedIdx(null);
  };
  return (
    <div style={{ background: C.surfaceAlt, borderRadius: 12, padding: 32, border: `1px solid ${isSuccess ? C.accent : C.border}`, transition: "border 0.5s" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div style={{ fontSize: 12, color: C.accent, letterSpacing: 1, textTransform: "uppercase", fontWeight: 700 }}>Interactive Puzzle: Build the RAG Pipeline</div>
        {isSuccess && <Badge color={C.accent}>Pipeline Validated ✓</Badge>}
      </div>
      <p style={{ fontSize: 15, color: C.textMuted, marginBottom: 24, lineHeight: 1.6 }}>Drag and drop the steps into the correct chronological order to build a working Retrieval-Augmented Generation system.</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {steps.map((s, i) => (
          // Use s.id (not index) as key so React doesn't lose identity on reorder
          <div key={s.id} draggable onDragStart={e => { setDraggedIdx(i); e.dataTransfer.effectAllowed = "move"; }} onDragOver={e => e.preventDefault()} onDrop={e => handleDrop(e, i)}
            style={{ display: "flex", alignItems: "center", gap: 16, padding: "12px 20px", background: C.surface, border: `1px solid ${C.borderLight}`, borderRadius: 8, cursor: "grab", opacity: draggedIdx === i ? 0.4 : 1, transition: "opacity 0.2s" }}>
            <div style={{ color: C.textDim, fontWeight: 700, width: 24 }}>{i + 1}.</div>
            <div style={{ fontSize: 20 }}>{s.icon}</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: C.text }}>{s.label}</div>
            <div style={{ marginLeft: "auto", color: C.textDim }}>⋮⋮</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ModelCards() {
  const { C } = useTheme();
  const [filter, setFilter] = useState("all");
  const [showBenchmarks, setShowBenchmarks] = useState(false);
  // Model data comes from src/data/models.json, which is a copy of shared/models.json —
  // the single source of truth shared with the companion paper. Edit that file, then run
  // shared/sync-models.sh. Do not hardcode model data here again.
  const models = MODEL_DATA.models.map(m => ({ ...m, color: C[m.colorKey] || C.accent }));
  const filtered = filter === "all" ? models : models.filter(m => m.scale === filter);
  const filters = [{ id: "all", label: "All" }, { id: "frontier", label: "Frontier" }, { id: "mid", label: "Mid-range" }, { id: "small", label: "Small / edge" }];
  return (
    <div style={{ textAlign: "left" }}>
      <div style={{ display: "flex", gap: 10, marginBottom: 24, flexWrap: "wrap", alignItems: "center" }}>
        {filters.map(f => <button key={f.id} onClick={() => setFilter(f.id)} style={{ background: filter === f.id ? C.accent + "20" : C.surface, border: `1px solid ${filter === f.id ? C.accent : C.border}`, color: filter === f.id ? C.accent : C.textMuted, borderRadius: 20, padding: "6px 18px", cursor: "pointer", fontSize: 14, fontWeight: filter === f.id ? 700 : 500, transition: "all .2s", fontFamily: "inherit" }}>{f.label}</button>)}
        <button onClick={() => setShowBenchmarks(b => !b)} style={{ marginLeft: "auto", background: showBenchmarks ? C.blue + "20" : C.surface, border: `1px solid ${showBenchmarks ? C.blue : C.border}`, color: showBenchmarks ? C.blue : C.textMuted, borderRadius: 20, padding: "6px 18px", cursor: "pointer", fontSize: 14, fontWeight: showBenchmarks ? 700 : 500, transition: "all .2s", fontFamily: "inherit" }}>
          {showBenchmarks ? "Hide benchmarks" : "Show benchmarks"}
        </button>
      </div>
      <div style={{ fontSize: 12, color: C.textDim, marginBottom: 16, lineHeight: 1.6 }}>
        Snapshot as of <strong style={{ color: C.textMuted }}>{MODEL_DATA.as_of}</strong> · scores from the{" "}
        <a href={MODEL_DATA.primary_source.url} target="_blank" rel="noopener noreferrer" style={{ color: C.accent }}>
          {MODEL_DATA.primary_source.name}
        </a>{" "}
        (see its{" "}
        <a href={MODEL_DATA.primary_source.methodology} target="_blank" rel="noopener noreferrer" style={{ color: C.accent }}>
          methodology
        </a>
        ). This field moves fast — treat every figure as perishable and verify before citing.
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
        {filtered.map(m => (
          <Card key={m.name} color={m.color} title={m.name} subtitle={m.provider}>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
              <Tag color={m.color}>{m.open ? "open-weight" : "proprietary"}</Tag>
              <Tag color={m.color}>{m.scale}</Tag>
            </div>
            <div style={{ fontSize: 13, color: C.textDim, lineHeight: 1.5, marginBottom: 8 }}>
              <span style={{ color: C.textMuted, fontWeight: 700, marginRight: 4 }}>Params:</span>{m.params}
              <span style={{ margin: "0 8px", color: C.borderLight }}>|</span>
              <span style={{ color: C.textMuted, fontWeight: 700, marginRight: 4 }}>Context:</span>{m.ctx}
            </div>
            <div style={{ fontSize: 14, color: C.textMuted, lineHeight: 1.6, marginBottom: showBenchmarks ? 12 : 0 }}>{m.strengths}</div>
            {showBenchmarks && (
              <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 12, animation: "fadeIn 0.3s ease" }}>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 11, color: C.textDim, fontWeight: 700 }}>ARTIFICIAL ANALYSIS INTELLIGENCE INDEX</div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: m.aaIndex == null ? C.textDim : m.color, marginTop: 2 }}>
                    {m.aaIndex == null ? "—" : m.aaIndex}
                  </div>
                  {m.aaIndex == null && (
                    <div style={{ fontSize: 11, color: C.textDim, marginTop: 2 }}>no sourced figure</div>
                  )}
                </div>
                {m.note && (
                  <div style={{ fontSize: 11, color: C.amber, textAlign: "center", marginTop: 8, lineHeight: 1.4 }}>{m.note}</div>
                )}
              </div>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}

// Companion section to the paper "Using AI Safely and Ethically in Research"
// (Johnston, 2026). This tool covers mechanism; the paper covers governance.
// Keep the two consistent — if you change guidance here, change it there too.
const PAPER = {
  title: "Using AI Safely and Ethically in Research",
  subtitle: "A Practical Guide to the Large Language Model Landscape for Research Colleagues",
  author: "Barry Johnston, Atlantic Technological University",
  version: "Version 1.0, July 2026",
  doi: "10.5281/zenodo.21462031",   // paper's Zenodo DOI (string — must be quoted)
  url: null,           // <-- or a direct link to the PDF
};

function SafeUsePanel() {
  const { C } = useTheme();

  const routes = [
    { name: "Web interface", sub: "browser chat", risk: "LOWER RISK", color: C.teal,
      sees: "Only what you paste or upload",
      note: "Simplest and most forgiving. But convenience encourages careless pasting of sensitive material." },
    { name: "Desktop app", sub: "installed program", risk: "MEDIUM", color: C.amber,
      sees: "A folder you explicitly grant",
      note: "Read permission prompts rather than clicking through them. Installing locally does not make processing local." },
    { name: "Command line", sub: "CLI / agent", risk: "HIGHER RISK", color: C.coral,
      sees: "A whole project, and can run commands",
      note: "Most capable and most dangerous. Work in isolated folders, keep version control, review actions before approving." },
  ];

  const principles = [
    { k: "Protect confidential data", v: "Never put personal, unpublished or confidential material into a public tool. Use an approved institutional service — or run an open-weight model locally so nothing leaves your hardware." },
    { k: "Verify everything", v: "Models produce plausible text, not verified text. Treat every fact, quotation, statistic and citation as unchecked until confirmed against a primary source. Fabricated references are a well-documented failure mode." },
    { k: "Disclose and cite", v: "Most journals and funders now require disclosure of AI use, and are near-unanimous that a tool cannot be an author. APA and MLA both publish citation formats." },
    { k: "Stay accountable", v: "You are responsible for anything carrying your name. Use AI to assist your judgement, never to replace it." },
    { k: "Mind reproducibility", v: "Hosted models change underneath you. Record the model, version and date; pin an open-weight model where an analysis must be repeatable." },
    { k: "Check local policy first", v: "Institutional, funder and national rules (GDPR in particular) override any general guidance — including this page." },
  ];

  return (
    <div style={{ textAlign: "left" }}>
      {/* the data boundary — the core idea */}
      <div style={{ background: C.surfaceAlt, border: `1px solid ${C.border}`, borderLeft: `3px solid ${C.accent}`, borderRadius: 12, padding: 24, marginBottom: 32 }}>
        <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", color: C.accent, marginBottom: 8 }}>THE ONE IDEA THAT MATTERS</div>
        <div style={{ fontSize: 16, color: C.textMuted, lineHeight: 1.65 }}>
          Everything you send to a hosted model <strong style={{ color: C.text }}>crosses a boundary</strong> onto someone else&rsquo;s servers,
          where it is governed by their terms and may be retained. The route you choose determines how much of your
          machine the model can see — and installing software locally does <strong style={{ color: C.text }}>not</strong> keep your data
          local. Only running a model on your own hardware does that.
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16, marginBottom: 32 }}>
        {routes.map(r => (
          <Card key={r.name} color={r.color} title={r.name} subtitle={r.sub}>
            <div style={{ marginBottom: 12 }}><Tag color={r.color}>{r.risk}</Tag></div>
            <div style={{ fontSize: 13, color: C.textDim, marginBottom: 8 }}>
              <span style={{ color: C.textMuted, fontWeight: 700 }}>Can see:</span> {r.sees}
            </div>
            <div style={{ fontSize: 14, color: C.textMuted, lineHeight: 1.6 }}>{r.note}</div>
          </Card>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 14, marginBottom: 32 }}>
        {principles.map((p, i) => (
          <div key={p.k} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: 18 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: C.accent }}>{String(i + 1).padStart(2, "0")}</span>
              <span style={{ fontSize: 15, fontWeight: 700, color: C.text }}>{p.k}</span>
            </div>
            <div style={{ fontSize: 14, color: C.textMuted, lineHeight: 1.6 }}>{p.v}</div>
          </div>
        ))}
      </div>

      {/* companion paper */}
      <div style={{ background: C.accent + "10", border: `1px solid ${C.accent}40`, borderRadius: 12, padding: 24 }}>
        <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", color: C.accent, marginBottom: 10 }}>COMPANION PAPER</div>
        <div style={{ fontSize: 17, fontWeight: 700, color: C.text, marginBottom: 4 }}>{PAPER.title}</div>
        <div style={{ fontSize: 14, color: C.textMuted, marginBottom: 10, lineHeight: 1.5 }}>{PAPER.subtitle}</div>
        <div style={{ fontSize: 13, color: C.textDim, marginBottom: 14 }}>{PAPER.author} · {PAPER.version}</div>
        <div style={{ fontSize: 14, color: C.textMuted, lineHeight: 1.65, marginBottom: 14 }}>
          This page is a summary. The paper covers the governance side in full — access routes and their trade-offs,
          data protection, verification, disclosure and citation, intellectual property, environmental cost, and a
          safe-use checklist. It is written for colleagues without a computing background. This tool covers the
          mechanism; the paper covers the responsible use of it.
        </div>
        {PAPER.doi ? (
          <a href={`https://doi.org/${PAPER.doi}`} target="_blank" rel="noopener noreferrer"
             style={{ display: "inline-block", background: C.accent, color: "#fff", padding: "10px 20px", borderRadius: 8, fontWeight: 700, fontSize: 14, textDecoration: "none" }}>
            Read the paper — doi.org/{PAPER.doi}
          </a>
        ) : (
          <div style={{ fontSize: 13, color: C.textDim, fontStyle: "italic" }}>
            DOI pending deposit — add it to the <code style={{ background: C.surfaceAlt, padding: "1px 5px", borderRadius: 3 }}>PAPER</code> constant in App.jsx once minted.
          </div>
        )}
      </div>
    </div>
  );
}

function KnowledgeQuiz() {
  const { C, isDark } = useTheme();
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState({});
  const [showResults, setShowResults] = useState(false);
  const [quizStart, setQuizStart] = useState(() => Date.now());
  const [bestScore, setBestScore] = useState(() => {
    try { return JSON.parse(localStorage.getItem("llm-quiz-best") || "null"); } catch { return null; }
  });
  const total = QUIZ_QUESTIONS.length;
  const q = QUIZ_QUESTIONS[currentQ];
  const userAnswer = answers[currentQ];
  const hasAnswered = userAnswer !== undefined;
  const score = Object.entries(answers).filter(([qi, ai]) => QUIZ_QUESTIONS[+qi].correct === +ai).length;

  const handleAnswer = (optIdx) => {
    if (hasAnswered) return;
    setAnswers(prev => ({ ...prev, [currentQ]: optIdx }));
  };
  const handleReset = () => { setCurrentQ(0); setAnswers({}); setShowResults(false); setQuizStart(Date.now()); };

  if (showResults) {
    const pct = Math.round((score / total) * 100);
    const elapsed = Math.round((Date.now() - quizStart) / 1000);
    const mins = Math.floor(elapsed / 60), secs = elapsed % 60;
    const timeStr = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
    const streak = (() => {
      let count = 0;
      for (let i = 0; i < total; i++) { if (answers[i] === QUIZ_QUESTIONS[i].correct) count++; else break; }
      return count;
    })();
    const isNewBest = !bestScore || pct > bestScore.pct;
    if (isNewBest && pct > 0) {
      const newBest = { pct, score, time: timeStr };
      setBestScore(newBest);
      try { localStorage.setItem("llm-quiz-best", JSON.stringify(newBest)); } catch {}
    }
    const grade = pct >= 90 ? { label: "Expert", color: C.accent } : pct >= 70 ? { label: "Proficient", color: C.teal } : pct >= 50 ? { label: "Developing", color: C.amber } : { label: "Beginner", color: C.coral };
    return (
      <div style={{ background: C.surfaceAlt, borderRadius: 12, padding: 32, border: `2px solid ${grade.color}40` }}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{ fontSize: 72, fontWeight: 700, color: grade.color, lineHeight: 1 }}>{pct}%</div>
          <div style={{ marginTop: 8, display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
            <Badge color={grade.color}>{grade.label}</Badge>
            {isNewBest && pct > 0 && <Badge color={C.amber}>New Personal Best!</Badge>}
            {streak >= 3 && <Badge color={C.purple}>{streak} in a row</Badge>}
          </div>
          <p style={{ color: C.textMuted, marginTop: 12 }}>{score} / {total} correct · {timeStr}</p>
          {bestScore && !isNewBest && <p style={{ color: C.textDim, fontSize: 13, marginTop: 4 }}>Personal best: {bestScore.pct}% ({bestScore.time})</p>}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 24 }}>
          {QUIZ_QUESTIONS.map((qItem, qi) => {
            const chosen = answers[qi];
            const ok = chosen === qItem.correct;
            return (
              <div key={qi} style={{ background: C.surface, borderRadius: 8, padding: 16, border: `1px solid ${ok ? C.accent : C.coral}30` }}>
                <div style={{ display: "flex", gap: 10, alignItems: "flex-start", marginBottom: ok ? 0 : 8 }}>
                  <span style={{ color: ok ? C.accent : C.coral, fontWeight: 700, fontSize: 16, flexShrink: 0 }}>{ok ? "✓" : "✗"}</span>
                  <div style={{ fontSize: 14, color: C.text, fontWeight: 600 }}>{qItem.q}</div>
                </div>
                {!ok && <div style={{ fontSize: 13, color: C.textMuted, marginLeft: 26, lineHeight: 1.6 }}>
                  <span style={{ color: C.coral }}>Your answer: </span>{qItem.options[chosen ?? -1] ?? "No answer"}<br />
                  <span style={{ color: C.accent }}>Correct: </span>{qItem.options[qItem.correct]}<br />
                  <em>{qItem.explanation}</em>
                </div>}
              </div>
            );
          })}
        </div>
        <button onClick={handleReset} style={{ background: C.accent + "20", border: `1px solid ${C.accent}`, color: C.accent, padding: "12px 24px", borderRadius: 8, cursor: "pointer", fontWeight: 700, fontSize: 15, fontFamily: "inherit" }}>Retry Quiz</button>
      </div>
    );
  }

  return (
    <div style={{ background: C.surfaceAlt, borderRadius: 12, padding: 32, border: `1px solid ${C.border}` }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div style={{ fontSize: 12, color: C.accent, letterSpacing: 1, textTransform: "uppercase", fontWeight: 700 }}>Knowledge Check</div>
        <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
          {bestScore && <span style={{ fontSize: 12, color: C.textDim }}>Best: <span style={{ color: C.amber, fontWeight: 700 }}>{bestScore.pct}%</span></span>}
          <span style={{ fontSize: 13, color: C.textMuted }}>{currentQ + 1} / {total}</span>
        </div>
      </div>
      <div style={{ display: "flex", gap: 6, marginBottom: 24 }}>
        {QUIZ_QUESTIONS.map((_, i) => {
          const ans = answers[i]; const done = ans !== undefined; const right = done && QUIZ_QUESTIONS[i].correct === ans;
          return <div key={i} onClick={() => setCurrentQ(i)} style={{ width: 8, height: 8, borderRadius: "50%", cursor: "pointer", transition: "all 0.2s", background: i === currentQ ? C.accent : done ? (right ? C.accent + "80" : C.coral + "80") : C.border }} />;
        })}
      </div>
      <div style={{ fontSize: 17, fontWeight: 600, color: C.text, lineHeight: 1.6, marginBottom: 24 }}>{q.q}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 24 }}>
        {q.options.map((opt, i) => {
          let border = C.border, bg = C.surface, textCol = C.text;
          if (hasAnswered) {
            if (i === q.correct) { border = C.accent; bg = C.accent + "10"; textCol = C.accent; }
            else if (i === userAnswer) { border = C.coral; bg = C.coral + "10"; textCol = C.coral; }
          }
          return (
            <button key={i} onClick={() => handleAnswer(i)} style={{ background: bg, border: `2px solid ${border}`, borderRadius: 8, padding: "14px 18px", textAlign: "left", cursor: hasAnswered ? "default" : "pointer", color: textCol, fontSize: 15, lineHeight: 1.5, transition: "all 0.2s", outline: "none", fontFamily: "inherit" }}>
              <span style={{ fontWeight: 700, marginRight: 10, color: hasAnswered ? textCol : C.textDim }}>{String.fromCharCode(65 + i)}.</span>{opt}
            </button>
          );
        })}
      </div>
      {hasAnswered && (
        <div style={{ background: userAnswer === q.correct ? C.accent + "10" : C.coral + "10", borderLeft: `4px solid ${userAnswer === q.correct ? C.accent : C.coral}`, borderRadius: "0 8px 8px 0", padding: 16, marginBottom: 20, animation: "fadeIn 0.3s ease" }}>
          <div style={{ fontWeight: 700, color: userAnswer === q.correct ? C.accent : C.coral, marginBottom: 6 }}>{userAnswer === q.correct ? "Correct!" : "Not quite."}</div>
          <div style={{ color: C.textMuted, fontSize: 14, lineHeight: 1.6 }}>{q.explanation}</div>
        </div>
      )}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <button onClick={() => setCurrentQ(Math.max(0, currentQ - 1))} disabled={currentQ === 0}
          style={{ background: "none", border: `1px solid ${C.border}`, color: currentQ === 0 ? C.textDim : C.text, borderRadius: 8, padding: "10px 20px", cursor: currentQ === 0 ? "default" : "pointer", fontFamily: "inherit", fontSize: 14 }}>← Back</button>
        {hasAnswered && (
          <button onClick={() => currentQ < total - 1 ? setCurrentQ(currentQ + 1) : setShowResults(true)}
            style={{ background: C.accent, border: "none", color: isDark ? "#111827" : "#fff", borderRadius: 8, padding: "10px 24px", cursor: "pointer", fontWeight: 700, fontFamily: "inherit", fontSize: 14 }}>
            {currentQ === total - 1 ? "See Results" : "Next →"}
          </button>
        )}
      </div>
    </div>
  );
}

function Glossary() {
  const { C } = useTheme();
  const [mode, setMode] = useState("browse");
  const [search, setSearch] = useState("");
  const [deck] = useState(() => [...GLOSSARY_TERMS].sort(() => Math.random() - 0.5));
  const [cardIdx, setCardIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [known, setKnown] = useState(new Set());
  const [toReview, setToReview] = useState(new Set());

  const filtered = GLOSSARY_TERMS
    .filter(t => t.term.toLowerCase().includes(search.toLowerCase()) || t.def.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => a.term.localeCompare(b.term));

  const resetDeck = useCallback(() => { setCardIdx(0); setFlipped(false); setKnown(new Set()); setToReview(new Set()); }, []);

  const advance = useCallback((verdict) => {
    const term = deck[cardIdx]?.term;
    if (verdict === "known") setKnown(prev => new Set([...prev, term]));
    else setToReview(prev => new Set([...prev, term]));
    setFlipped(false);
    setCardIdx(i => i + 1);
  }, [deck, cardIdx]);

  const ModeToggle = () => (
    <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
      {[["browse", "Browse"], ["flashcard", "Flashcard Study"]].map(([m, label]) => (
        <button key={m} onClick={() => { setMode(m); resetDeck(); }} style={{ background: mode === m ? C.accent + "20" : C.surface, border: `1px solid ${mode === m ? C.accent : C.border}`, color: mode === m ? C.accent : C.textMuted, borderRadius: 8, padding: "8px 20px", cursor: "pointer", fontWeight: mode === m ? 700 : 500, fontFamily: "inherit", transition: "all 0.2s" }}>{label}</button>
      ))}
    </div>
  );

  if (mode === "flashcard") {
    const currentCard = deck[cardIdx];
    const isDone = cardIdx >= deck.length;
    return (
      <div style={{ textAlign: "left" }}>
        <ModeToggle />
        {isDone ? (
          <div style={{ textAlign: "center", padding: "48px 32px", background: C.surface, borderRadius: 12, border: `1px solid ${C.border}` }}>
            <div style={{ fontSize: 52, marginBottom: 16 }}>🎉</div>
            <div style={{ fontSize: 26, fontWeight: 700, color: C.text, marginBottom: 8 }}>Deck complete!</div>
            <div style={{ display: "flex", justifyContent: "center", gap: 40, marginBottom: 32 }}>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 40, fontWeight: 700, color: C.accent }}>{known.size}</div>
                <div style={{ fontSize: 14, color: C.textMuted, marginTop: 2 }}>Known</div>
              </div>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 40, fontWeight: 700, color: C.amber }}>{toReview.size}</div>
                <div style={{ fontSize: 14, color: C.textMuted, marginTop: 2 }}>Review</div>
              </div>
            </div>
            <button onClick={resetDeck} style={{ background: C.accent + "20", border: `1px solid ${C.accent}`, color: C.accent, padding: "12px 28px", borderRadius: 8, cursor: "pointer", fontWeight: 700, fontFamily: "inherit", fontSize: 15 }}>Study Again</button>
          </div>
        ) : (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <span style={{ fontSize: 14, color: C.textMuted }}>Card {cardIdx + 1} of {deck.length}</span>
              <div style={{ display: "flex", gap: 16 }}>
                <span style={{ fontSize: 13, color: C.accent, fontWeight: 700 }}>✓ {known.size}</span>
                <span style={{ fontSize: 13, color: C.amber, fontWeight: 700 }}>↺ {toReview.size}</span>
              </div>
            </div>
            <div style={{ height: 4, background: C.border, borderRadius: 2, marginBottom: 24, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${(cardIdx / deck.length) * 100}%`, background: C.accent, transition: "width 0.3s ease", borderRadius: 2 }} />
            </div>
            <div onClick={() => setFlipped(f => !f)} style={{ background: C.surface, borderRadius: 12, border: `2px solid ${flipped ? C.purple : C.border}`, padding: "48px 32px", textAlign: "center", cursor: "pointer", minHeight: 220, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", transition: "border-color 0.3s", userSelect: "none" }}>
              {!flipped ? (
                <div style={{ animation: "fadeIn 0.2s ease" }}>
                  <div style={{ fontSize: 11, color: C.accent, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, marginBottom: 20 }}>Term</div>
                  <div style={{ fontSize: 34, fontWeight: 700, color: C.text }}>{currentCard.term}</div>
                  <div style={{ fontSize: 13, color: C.textDim, marginTop: 28 }}>Click to reveal definition</div>
                </div>
              ) : (
                <div style={{ animation: "fadeIn 0.2s ease" }}>
                  <div style={{ fontSize: 11, color: C.purple, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, marginBottom: 16 }}>Definition</div>
                  <div style={{ fontSize: 17, fontWeight: 700, color: C.accent, marginBottom: 14 }}>{currentCard.term}</div>
                  <div style={{ fontSize: 16, color: C.text, lineHeight: 1.7, maxWidth: 520 }}>{currentCard.def}</div>
                </div>
              )}
            </div>
            {flipped && (
              <div style={{ display: "flex", gap: 12, marginTop: 16, justifyContent: "center", animation: "fadeIn 0.2s ease" }}>
                <button onClick={() => advance("review")} style={{ flex: 1, maxWidth: 200, background: C.amber + "15", border: `2px solid ${C.amber}`, color: C.amber, padding: "13px", borderRadius: 8, cursor: "pointer", fontWeight: 700, fontFamily: "inherit", fontSize: 15 }}>↺ Review again</button>
                <button onClick={() => advance("known")} style={{ flex: 1, maxWidth: 200, background: C.accent + "15", border: `2px solid ${C.accent}`, color: C.accent, padding: "13px", borderRadius: 8, cursor: "pointer", fontWeight: 700, fontFamily: "inherit", fontSize: 15 }}>✓ Got it</button>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{ textAlign: "left" }}>
      <ModeToggle />
      <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search terms…"
        style={{ width: "100%", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: "12px 18px", color: C.text, fontSize: 16, marginBottom: 20, boxSizing: "border-box", outline: "none", fontFamily: "inherit" }} />
      <div style={{ display: "grid", gap: 12 }}>
        {filtered.map(t => (
          <div key={t.term} style={{ background: C.surface, borderRadius: 8, padding: "16px 20px", border: `1px solid ${C.border}` }}>
            <div style={{ fontWeight: 700, color: C.accent, fontSize: 16, marginBottom: 4 }}>{t.term}</div>
            <div style={{ color: C.textMuted, fontSize: 15, lineHeight: 1.6 }}>{t.def}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ══════════════════════════════════
// ── ROOT
// ══════════════════════════════════
export default function App() {
  const [isDark, setIsDark] = useState(false);
  const C = isDark ? darkColors : lightColors;
  return (
    <ErrorBoundary>
      <ThemeContext.Provider value={{ C, isDark, setIsDark }}>
        <AppContent />
      </ThemeContext.Provider>
    </ErrorBoundary>
  );
}

function AppContent() {
  const { C, isDark, setIsDark } = useTheme();
  const [activeSection, setActiveSection] = useState("hero");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [cmdOpen, setCmdOpen] = useState(false);
  const observerRef = useRef(null);

  // IntersectionObserver — also updates URL hash
  useEffect(() => {
    const obs = new IntersectionObserver(
      entries => entries.forEach(e => {
        if (e.isIntersecting) {
          setActiveSection(e.target.id);
          history.replaceState(null, "", "#" + e.target.id);
        }
      }),
      { rootMargin: "-30% 0px -60% 0px" }
    );
    observerRef.current = obs;
    SECTIONS.forEach(s => { const el = document.getElementById(s.id); if (el) obs.observe(el); });
    return () => obs.disconnect();
  }, []);

  // Scroll to hash on initial load
  useEffect(() => {
    if (window.location.hash) {
      const id = window.location.hash.slice(1);
      setTimeout(() => scrollTo(id), 120);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const scrollTo = useCallback((id) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    history.replaceState(null, "", "#" + id);
    setMobileNavOpen(false);
  }, []);

  // Keyboard navigation: j/k between sections, Cmd+K for palette
  useEffect(() => {
    const onKey = (e) => {
      const tag = document.activeElement?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if ((e.metaKey || e.ctrlKey) && e.key === "k") { e.preventDefault(); setCmdOpen(true); return; }
      if (e.key === "j" || e.key === "ArrowRight") {
        const i = SECTIONS.findIndex(s => s.id === activeSection);
        if (i < SECTIONS.length - 1) scrollTo(SECTIONS[i + 1].id);
      }
      if (e.key === "k" || e.key === "ArrowLeft") {
        const i = SECTIONS.findIndex(s => s.id === activeSection);
        if (i > 0) scrollTo(SECTIONS[i - 1].id);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activeSection, scrollTo]);

  const NavLinks = () => (
    <>
      {SECTIONS.map(s => (
        <div key={s.id} onClick={() => scrollTo(s.id)} onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && scrollTo(s.id)} role="button" tabIndex={0}
          style={{ padding: "12px 14px", borderRadius: 8, cursor: "pointer", fontSize: 15, fontWeight: activeSection === s.id ? 700 : 500, color: activeSection === s.id ? C.accent : C.textMuted, background: activeSection === s.id ? C.accent + "15" : "transparent", borderLeft: activeSection === s.id ? `4px solid ${C.accent}` : "4px solid transparent", transition: "all .2s", marginBottom: 6, outline: "none" }}>
          {s.label}
        </div>
      ))}
    </>
  );

  return (
    <>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        html, body, #root { background: ${C.bg}; color: ${C.text}; font-family: Arial, Calibri, sans-serif; text-align: left !important; transition: background 0.3s ease, color 0.3s ease; }
        ::selection { background: ${C.accent}30; color: ${C.accent}; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
        .section { padding: 80px 0; animation: fadeIn .6s ease both; text-align: left; }
        input:focus { border-color: ${C.accent} !important; }
        button:hover { opacity: 0.9; }
        @media (max-width: 860px) {
          .nav-bar { display: none !important; }
          .main-content { margin-left: 0 !important; padding: 0 20px !important; width: 100% !important; }
          .mobile-menu-btn { display: flex !important; }
        }
        @media (min-width: 861px) { .mobile-menu-btn { display: none !important; } }
        @media print {
          .nav-bar, .mobile-menu-btn, .no-print { display: none !important; }
          .main-content { margin-left: 0 !important; padding: 0 24px !important; max-width: 100% !important; }
          * { animation: none !important; transition: none !important; }
          .section { page-break-inside: avoid; }
        }
      `}</style>

      <ProgressBar />

      {/* Mobile header */}
      <div className="mobile-menu-btn no-print" style={{ position: "fixed", top: 8, left: 0, right: 0, zIndex: 200, display: "none", justifyContent: "space-between", alignItems: "center", padding: "0 16px", height: 52, background: C.surface, borderBottom: `1px solid ${C.border}` }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: C.accent }}>LLM Guide</div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => setCmdOpen(true)} style={{ background: C.surfaceAlt, border: `1px solid ${C.border}`, color: C.textMuted, borderRadius: 6, padding: "6px 10px", cursor: "pointer", fontSize: 14 }}>⌕</button>
          <button onClick={() => setMobileNavOpen(o => !o)} style={{ background: C.surfaceAlt, border: `1px solid ${C.border}`, color: C.text, borderRadius: 6, padding: "6px 12px", cursor: "pointer", fontSize: 18 }}>{mobileNavOpen ? "✕" : "☰"}</button>
        </div>
      </div>

      {/* Mobile nav drawer */}
      {mobileNavOpen && (
        <div style={{ position: "fixed", inset: 0, zIndex: 190 }}>
          <div onClick={() => setMobileNavOpen(false)} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.5)" }} />
          <div style={{ position: "absolute", top: 52, left: 0, bottom: 0, width: 240, background: C.surface, borderRight: `1px solid ${C.border}`, padding: "16px 12px", overflowY: "auto", animation: "fadeIn 0.2s ease" }}>
            <NavLinks />
          </div>
        </div>
      )}

      {/* Desktop sidebar */}
      <nav className="nav-bar no-print" style={{ position: "fixed", left: 0, top: 0, bottom: 0, width: 220, background: C.surface, borderRight: `1px solid ${C.border}`, padding: "40px 20px", zIndex: 100, display: "flex", flexDirection: "column", transition: "background 0.3s ease" }}>
        <div style={{ fontSize: 20, fontWeight: 700, color: C.accent, marginBottom: 16, paddingLeft: 12 }}>LLM Guide</div>
        <button onClick={() => setCmdOpen(true)} style={{ display: "flex", alignItems: "center", gap: 8, background: C.surfaceAlt, border: `1px solid ${C.border}`, borderRadius: 8, padding: "8px 12px", cursor: "pointer", color: C.textMuted, fontSize: 13, marginBottom: 20, width: "100%", textAlign: "left", fontFamily: "inherit" }}>
          <span>⌕</span><span style={{ flex: 1 }}>Search…</span><kbd style={{ fontSize: 10, background: C.border, borderRadius: 3, padding: "1px 5px" }}>⌘K</kbd>
        </button>
        <div style={{ flex: 1, overflowY: "auto" }}>
          <NavLinks />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: "auto", paddingTop: 16 }}>
          <button onClick={() => setIsDark(!isDark)} style={{ background: C.surfaceAlt, border: `1px solid ${C.border}`, color: C.text, padding: "10px", borderRadius: 8, cursor: "pointer", fontWeight: "bold", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, transition: "all 0.2s", fontFamily: "inherit" }}>
            {isDark ? "☀️ Light" : "🌙 Dark"}
          </button>
          <button onClick={() => window.print()} style={{ background: C.surfaceAlt, border: `1px solid ${C.border}`, color: C.textMuted, padding: "10px", borderRadius: 8, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, transition: "all 0.2s", fontSize: 13, fontFamily: "inherit" }}>
            🖨️ Print / Export
          </button>
          <div style={{ fontSize: 11, color: C.textDim, textAlign: "center", paddingTop: 4 }}>j / k — navigate sections</div>
        </div>
      </nav>

      {cmdOpen && <CommandPalette onClose={() => setCmdOpen(false)} onNavigate={scrollTo} />}

      {/* Main content */}
      <main className="main-content" style={{ marginLeft: 220, padding: "0 64px", maxWidth: 1100, textAlign: "left" }}>

        <section id="hero" className="section" style={{ paddingTop: 100, paddingBottom: 60 }}>
          <Badge color={C.accent}>Reference guide · 2026</Badge>
          <h1 style={{ fontSize: 56, fontWeight: 700, color: C.text, marginTop: 24, lineHeight: 1.15 }}>A taxonomy of<br />large language models</h1>
          <p style={{ fontSize: 18, color: C.textMuted, marginTop: 20, maxWidth: 640, lineHeight: 1.7 }}>
            An interactive reference covering architectures, model types, <Term word="embeddings" match="Embedding" />, alignment techniques, and the practical landscape of modern LLMs. Hover dotted words for definitions.
          </p>
          <div style={{ display: "flex", gap: 14, marginTop: 32, flexWrap: "wrap" }}>
            {[{ l: "10 sections", c: C.accent }, { l: "Interactive diagrams", c: C.purple }, { l: "10-question quiz", c: C.amber }, { l: "Searchable glossary", c: C.teal }].map(b => <Badge key={b.l} color={b.c}>{b.l}</Badge>)}
          </div>
        </section>

        <section id="architectures" className="section">
          <SectionTitle sub="The original transformer (2017) split into three architectural families. Each has a distinct attention pattern that determines what the model excels at.">
            <Term word="Transformer" /> architectures
          </SectionTitle>
          <TokenizerDemo />
          <ContextWindowViz />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px,1fr))", gap: 24 }}>
            {["encoder", "decoder", "encdec"].map(t => (
              <Card key={t} color={t === "encoder" ? C.teal : t === "decoder" ? C.purple : C.coral}>
                <ArchDiagram type={t} />
              </Card>
            ))}
          </div>
          <div style={{ marginTop: 40 }}>
            <Card color={C.amber} title="Try it: self-attention explorer" subtitle="Click any token to see how it distributes attention across the sequence. Thicker lines = higher attention weight.">
              <AttentionDemo />
            </Card>
          </div>
        </section>

        <section id="categories" className="section">
          <SectionTitle sub="Beyond architecture, models are categorised by what they're designed to do — and how they're deployed.">Model categories</SectionTitle>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px,1fr))", gap: 20 }}>
            {[
              { title: "Base (pretrained)", sub: "Raw capability — predicts text without instruction following. Used for fine-tuning and research.", color: C.textMuted, tags: ["Llama base", "Falcon base"] },
              { title: "Instruction-tuned / chat", sub: "SFT + alignment transforms the base model into a helpful assistant that follows instructions safely.", color: C.purple, tags: ["Claude", "ChatGPT"] },
              { title: "Embedding models", sub: "Convert text to dense vectors for similarity search, clustering, and RAG retrieval. Not generative.", color: C.teal, tags: ["text-embedding-3", "Voyage"] },
              { title: "Code-specialised", sub: "Pretrained or fine-tuned on source code. Understand syntax, semantics, and idioms across languages.", color: C.blue, tags: ["Code Llama", "StarCoder 2", "DeepSeek-Coder"] },
              { title: "Multimodal", sub: "Accept and/or generate across modalities — text, images, audio, video, structured data.", color: C.coral, tags: ["GPT-5.6", "Gemini", "Claude"] },
              { title: "Mixture-of-Experts (MoE)", sub: "Many expert sub-networks, only a subset activated per token. Large capacity, lower inference cost.", color: C.amber, tags: ["GLM-5.2", "Kimi K3", "Mixtral"] },
            ].map(c => <Card key={c.title} color={c.color} title={c.title} subtitle={c.sub}><div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>{c.tags.map(t => <Tag key={t} color={c.color}>{t}</Tag>)}</div></Card>)}
          </div>
          <MoEDemo />
        </section>

        <section id="embeddings" className="section">
          <SectionTitle sub="Embedding models are central to search, RAG, and recommendation. Understanding retrieval architecture trade-offs is critical for production systems.">Embeddings &amp; retrieval</SectionTitle>
          <EmbeddingViz />
          <CosineSimilarityExplainer />
          <div style={{ marginTop: 32 }}><RetrievalComparison /></div>
        </section>

        <section id="alignment" className="section">
          <SectionTitle sub="The journey from a raw base model to a safe, instruction-following assistant involves multiple training stages. Click each stage to learn more.">Alignment &amp; Fine-tuning</SectionTitle>
          <Card color={C.teal} style={{ padding: 0 }}><AlignmentPipeline /></Card>
          <LoRACalculator />
          <SystemPromptSandbox />
          <RLHFGame />
          <TemperatureDemo />
        </section>

        <section id="rag" className="section">
          <SectionTitle sub="RAG is the most common production pattern for grounding LLMs in private or current data. Test your knowledge by assembling the pipeline.">
            <Term word="Retrieval-Augmented Generation" match="RAG" />
          </SectionTitle>
          <RAGStepThrough />
          <RAGPuzzle />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px,1fr))", gap: 20, marginTop: 40 }}>
            {[
              { title: "Agentic frameworks", color: C.amber, desc: "LLMs as autonomous agents that plan multi-step tasks, use tools, and iterate. LangChain, CrewAI, AutoGen." },
              { title: "Model Context Protocol", color: C.accent, desc: "An open standard for connecting LLMs to external tools and data sources via a uniform interface." },
              { title: "Chain-of-thought", color: C.purple, desc: "Models trained to 'think step by step' before answering. Dedicated reasoning models (o1, o3, DeepSeek-R1) allocate extra compute." },
              { title: "Hybrid retrieval", color: C.teal, desc: "Combining dense vectors (semantic) with sparse vectors (BM25 keyword) for better recall than either alone." },
            ].map(c => <Card key={c.title} color={c.color} title={c.title} subtitle={c.desc} />)}
          </div>
        </section>

        <section id="landscape" className="section">
          <SectionTitle sub="Filter and explore models across the capability spectrum. Toggle benchmarks to see the Artificial Analysis Intelligence Index where a sourced figure is available.">Model landscape</SectionTitle>
          <ModelCards />
        </section>

        <section id="safe-use" className="section">
          <SectionTitle sub="Knowing how these systems work is only half of it. This section covers using them responsibly in research — what leaves your control, and what you remain accountable for.">Safe &amp; ethical use</SectionTitle>
          <SafeUsePanel />
        </section>

        <section id="quiz" className="section">
          <SectionTitle sub="Ten questions covering architectures, training, retrieval, and alignment. Answer each question then review the explanations.">Knowledge quiz</SectionTitle>
          <KnowledgeQuiz />
        </section>

        <section id="glossary" className="section" style={{ paddingBottom: 120 }}>
          <SectionTitle sub="Quick-reference definitions for essential LLM terminology. Use the search to filter.">Glossary</SectionTitle>
          <Glossary />
        </section>

        <footer style={{ borderTop: `1px solid ${C.border}`, padding: "32px 0 64px", textAlign: "center" }}>
          <p style={{ fontSize: 14, color: C.textDim }}>LLM Taxonomy Guide · Built with React · j/k to navigate · ⌘K to search</p>
        </footer>
      </main>
    </>
  );
}
