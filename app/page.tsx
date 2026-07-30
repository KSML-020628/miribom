"use client";

import { useEffect, useRef, useState } from "react";
import type {
  AnalysisResult,
  ApiError,
  AppStep,
  FinalGuideResult,
  GuidePage,
  ParseResponse,
  ParsedPage,
  ProcessingStage,
} from "./lib/types";
import GuideStep from "./ui/GuideStep";
import ProgressHeader from "./ui/ProgressHeader";
import QuestionStep from "./ui/QuestionStep";
import ReviewStep from "./ui/ReviewStep";
import UploadStep, { type UploadFile } from "./ui/UploadStep";

type FontSize = "normal" | "large" | "xlarge";

const PROCESSING_COPY: Record<Exclude<ProcessingStage, "idle" | "done" | "error">, { title: string; detail: string }> = {
  parsing: { title: "안내문의 글자를 읽고 있어요", detail: "사진이 여러 장이면 차례대로 읽어요." },
  analyzing: { title: "맞춤 질문을 만들고 있어요", detail: "사람마다 달라지는 준비 내용을 찾고 있어요." },
  generating: { title: "나만의 안내서를 만들고 있어요", detail: "내 답변에 맞는 원문만 골라 쉬운 말로 바꾸고 있어요." },
};

export default function Home() {
  const [step, setStep] = useState<AppStep>("upload");
  const [files, setFiles] = useState<UploadFile[]>([]);
  const filesRef = useRef<UploadFile[]>([]);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [sourcePages, setSourcePages] = useState<ParsedPage[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [questionIndex, setQuestionIndex] = useState(0);
  const [guide, setGuide] = useState<FinalGuideResult | null>(null);
  const [pageIndex, setPageIndex] = useState(0);
  const [overview, setOverview] = useState(false);
  const [stage, setStage] = useState<ProcessingStage>("idle");
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [error, setError] = useState("");
  const [fontSize, setFontSize] = useState<FontSize>("normal");
  const [highContrast, setHighContrast] = useState(false);

  useEffect(() => { filesRef.current = files; }, [files]);
  useEffect(() => () => filesRef.current.forEach((item) => item.preview && URL.revokeObjectURL(item.preview)), []);
  useEffect(() => {
    document.documentElement.dataset.fontSize = fontSize;
    document.documentElement.dataset.contrast = highContrast ? "high" : "normal";
  }, [fontSize, highContrast]);
  useEffect(() => {
    const progressConfig = {
      parsing: { start: 6, ceiling: 76 },
      analyzing: { start: 82, ceiling: 94 },
      generating: { start: 8, ceiling: 92 },
    } as const;
    if (!(stage in progressConfig)) {
      if (stage === "idle" || stage === "error") setLoadingProgress(0);
      return;
    }

    const config = progressConfig[stage as keyof typeof progressConfig];
    setLoadingProgress((current) => stage === "analyzing" ? Math.max(current, config.start) : config.start);
    const timer = window.setInterval(() => {
      setLoadingProgress((current) => {
        if (current >= config.ceiling) return current;
        const remaining = config.ceiling - current;
        return Math.min(config.ceiling, current + Math.max(0.5, remaining * 0.055));
      });
    }, 800);

    return () => window.clearInterval(timer);
  }, [stage]);

  function addFiles(list: FileList | null) {
    if (!list) return;
    const accepted = Array.from(list).filter((file) => ["image/jpeg", "image/png", "application/pdf"].includes(file.type));
    const additions = accepted.map((file, index) => ({
      id: `${Date.now()}-${index}-${file.name}`,
      file,
      preview: file.type.startsWith("image/") ? URL.createObjectURL(file) : null,
    }));
    setFiles((current) => [...current, ...additions].slice(0, 10));
    setError(accepted.length === list.length ? "" : "PDF, PNG, JPG 파일만 올릴 수 있어요.");
  }

  function removeFile(id: string) {
    setFiles((current) => {
      const target = current.find((item) => item.id === id);
      if (target?.preview) URL.revokeObjectURL(target.preview);
      return current.filter((item) => item.id !== id);
    });
  }

  function moveFile(index: number, direction: -1 | 1) {
    setFiles((current) => {
      const next = [...current];
      const target = index + direction;
      if (target < 0 || target >= next.length) return current;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  async function readError(response: Response): Promise<string> {
    const payload = await response.json().catch(() => ({})) as Partial<ApiError>;
    return payload.error || "요청을 처리하지 못했어요.";
  }

  async function finishLoadingProgress() {
    setLoadingProgress(100);
    await new Promise((resolve) => window.setTimeout(resolve, 320));
  }

  async function analyze() {
    if (!files.length) return;
    setError("");
    setStage("parsing");
    try {
      const formData = new FormData();
      files.forEach((item) => formData.append("documents", item.file));
      const parseResponse = await fetch("/api/parse", { method: "POST", body: formData });
      if (!parseResponse.ok) throw new Error(await readError(parseResponse));
      const parsed = await parseResponse.json() as ParseResponse;
      setSourcePages(parsed.pages);

      setStage("analyzing");
      const analyzeResponse = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed),
      });
      if (!analyzeResponse.ok) throw new Error(await readError(analyzeResponse));
      const nextAnalysis = await analyzeResponse.json() as AnalysisResult;
      setAnalysis(nextAnalysis);
      setAnswers({});
      setQuestionIndex(0);
      await finishLoadingProgress();
      setStage("done");
      setStep("review");
    } catch (caught) {
      setStage("error");
      setError(caught instanceof Error ? caught.message : "안내문을 읽지 못했어요. 다시 찍어 주세요.");
    }
  }

  async function generateGuide(nextAnswers = answers) {
    if (!analysis) return;
    setStage("generating");
    setError("");
    try {
      const response = await fetch("/api/finalize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          document: analysis.document,
          questions: analysis.personalization_questions,
          instructions: analysis.instructions,
          answers: nextAnswers,
        }),
      });
      if (!response.ok) throw new Error(await readError(response));
      const result = await response.json() as FinalGuideResult;
      setGuide(result);
      setPageIndex(0);
      setOverview(false);
      await finishLoadingProgress();
      setStage("done");
      setStep("guide");
    } catch (caught) {
      setStage("error");
      setError(caught instanceof Error ? caught.message : "맞춤 안내서를 만들지 못했어요.");
    }
  }

  function startQuestions() {
    if (!analysis) return;
    if (!analysis.personalization_questions.length) {
      void generateGuide({});
      return;
    }
    setQuestionIndex(0);
    setStep("questions");
  }

  function answerQuestion(value: string) {
    if (!analysis) return;
    const question = analysis.personalization_questions[questionIndex];
    const nextAnswers = { ...answers, [question.question_id]: value };
    setAnswers(nextAnswers);
    if (questionIndex === analysis.personalization_questions.length - 1) {
      void generateGuide(nextAnswers);
    } else {
      setQuestionIndex((current) => current + 1);
    }
  }

  function backQuestion() {
    if (questionIndex === 0) setStep("review");
    else setQuestionIndex((current) => current - 1);
  }

  function speak(text: string) {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "ko-KR";
    utterance.rate = 0.82;
    window.speechSynthesis.speak(utterance);
  }

  function guidePageSpeechText(page: GuidePage): string {
    const title = page.title.trim();
    const body = page.body.filter((line) => line.trim() && line.trim() !== title);

    // 개인화 근거 문구는 화면 표시용 메타 정보이므로 음성 안내에서는 읽지 않는다.
    return [page.when, page.title, ...body].filter(Boolean).join(". ");
  }

  function speakPage(page: GuidePage) {
    speak(guidePageSpeechText(page));
  }

  function speakAll() {
    if (!guide) return;
    speak(guide.pages.map(guidePageSpeechText).filter(Boolean).join(". "));
  }

  function restart() {
    files.forEach((item) => item.preview && URL.revokeObjectURL(item.preview));
    setFiles([]);
    setAnalysis(null);
    setSourcePages([]);
    setAnswers({});
    setGuide(null);
    setError("");
    setStage("idle");
    setStep("upload");
  }

  const processing = stage === "parsing" || stage === "analyzing" || stage === "generating";
  const activeProcessing = processing ? PROCESSING_COPY[stage] : null;
  const currentQuestion = analysis?.personalization_questions[questionIndex];

  return (
    <main className="appShell">
      <header className="appHeader">
        <div className="brandGroup">
          <span className="hospitalLogo">[병원 로고]</span>
          <a className="brand" href="#" onClick={(event) => { event.preventDefault(); }}><span aria-hidden="true">◉</span>미리봄</a>
        </div>
        <div className="accessTools" aria-label="화면 보기 설정">
          <span>글자 크기</span>
          <button type="button" className={fontSize === "normal" ? "active" : ""} onClick={() => setFontSize("normal")}>보통</button>
          <button type="button" className={fontSize === "large" ? "active" : ""} onClick={() => setFontSize("large")}>크게</button>
          <button type="button" className={fontSize === "xlarge" ? "active" : ""} onClick={() => setFontSize("xlarge")}>더 크게</button>
          <button type="button" className={highContrast ? "active contrast" : "contrast"} onClick={() => setHighContrast((value) => !value)} aria-pressed={highContrast}>고대비</button>
        </div>
      </header>

      <ProgressHeader step={step} />

      <div className="mainViewport">
        {step === "upload" && <UploadStep files={files} busy={processing} onAdd={addFiles} onRemove={removeFile} onMove={moveFile} onAnalyze={analyze} />}
        {step === "review" && analysis && (
          <ReviewStep
            analysis={analysis}
            onChangeField={(field, value) => setAnalysis({ ...analysis, document: { ...analysis.document, [field]: value } })}
            onConfirm={startQuestions}
            onBack={() => setStep("upload")}
            onListen={() => speak(`${analysis.document.procedure_name} 안내문으로 확인했어요. 이 안내문이 맞나요?`)}
          />
        )}
        {step === "questions" && currentQuestion && (
          <QuestionStep
            question={currentQuestion}
            index={questionIndex}
            total={analysis.personalization_questions.length}
            selected={answers[currentQuestion.question_id]}
            onAnswer={answerQuestion}
            onBack={backQuestion}
            onListen={() => speak(`${currentQuestion.question}. ${currentQuestion.helper_text}. ${currentQuestion.options.map((option) => option.label).join(", ")}`)}
          />
        )}
        {step === "guide" && guide && (
          <GuideStep
            guide={guide}
            pageIndex={pageIndex}
            overview={overview}
            onPage={setPageIndex}
            onOverview={() => setOverview((value) => !value)}
            onListenPage={speakPage}
            onListenAll={speakAll}
            onEditAnswers={() => { setQuestionIndex(0); setStep("questions"); }}
            onRestart={restart}
            onPrint={() => window.print()}
            documentPages={sourcePages}
            onSpeak={speak}
          />
        )}

        {activeProcessing && (
          <div className="processingOverlay" role="status" aria-live="polite">
            <div className="processingCard">
              <span className="loadingMark" aria-hidden="true">···</span>
              <h2>{activeProcessing.title}</h2>
              <p>{activeProcessing.detail}</p>
              <div className="loadingProgressMeta" aria-hidden="true">
                <span>처리 중</span>
                <b>{Math.round(loadingProgress)}%</b>
              </div>
              <div
                className="loadingBar"
                role="progressbar"
                aria-label="안내문 처리 진행률"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(loadingProgress)}
              >
                <i style={{ width: `${loadingProgress}%` }} />
              </div>
            </div>
          </div>
        )}

        {error && !processing && <div className="globalError" role="alert"><b>다시 확인해 주세요</b><p>{error}</p><button type="button" onClick={() => { setError(""); setStage("idle"); }}>확인</button></div>}
      </div>
    </main>
  );
}
