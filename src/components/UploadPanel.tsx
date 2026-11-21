import { useEffect, useRef, useState } from "react";
import { Camera, ClipboardType, FileText, FileUp, ShieldCheck, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { Copy } from "@/lib/copy";
import type { DocTypeChoice } from "@/lib/explain-schema";
import { MAX_FILES, MAX_TEXT_CHARS } from "@/lib/explain-schema";
import { prepareFile, type PreparedFile } from "@/lib/file-prep";
import type { Lang } from "@/lib/mask";
import type { SampleKey } from "@/lib/samples";

export type InputMode = "files" | "text";

type Props = {
  t: Copy;
  lang: Lang;
  onLang: (l: Lang) => void;
  mode: InputMode;
  onMode: (m: InputMode) => void;
  files: PreparedFile[];
  onFiles: (f: PreparedFile[]) => void;
  text: string;
  onText: (s: string) => void;
  onSample: (k: SampleKey) => void;
  docType: DocTypeChoice;
  onDocType: (d: DocTypeChoice) => void;
  income: string;
  onIncome: (s: string) => void;
  emi: string;
  onEmi: (s: string) => void;
  question: string;
  onQuestion: (s: string) => void;
  loading: boolean;
  onSubmit: () => void;
  onError: (key: string) => void;
};

function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "rounded-full border px-4 py-1.5 text-sm font-medium transition-colors",
            value === o.value
              ? "border-primary bg-primary text-primary-foreground"
              : "border-input bg-card text-foreground hover:bg-secondary",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <p className="mb-3 mt-7 font-display text-lg font-semibold first:mt-0">
      <span className="mr-2 text-stamp">{n}.</span>
      {children}
    </p>
  );
}

const digitsOnly = (s: string) => s.replace(/[^\d]/g, "").slice(0, 10);

export function UploadPanel(p: Props) {
  const { t } = p;
  const inputRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msgIdx, setMsgIdx] = useState(0);

  useEffect(() => {
    if (!p.loading) return;
    setMsgIdx(0);
    const id = setInterval(() => setMsgIdx((i) => (i + 1) % t.reading.length), 2600);
    return () => clearInterval(id);
  }, [p.loading, t.reading.length]);

  async function addFiles(list: FileList | null) {
    if (!list || list.length === 0) return;
    const incoming = Array.from(list);
    if (p.files.length + incoming.length > MAX_FILES) {
      p.onError("max");
      return;
    }
    setBusy(true);
    try {
      const prepared: PreparedFile[] = [];
      for (const [i, f] of incoming.entries()) prepared.push(await prepareFile(f, i));
      p.onFiles([...p.files, ...prepared]);
    } catch (e) {
      p.onError(e instanceof Error ? e.message : "failed");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
      if (cameraRef.current) cameraRef.current.value = "";
    }
  }

  const disabled = p.loading || busy;
  const ready = p.mode === "files" ? p.files.length > 0 : p.text.trim().length > 0;

  return (
    <div className="paper-card relative overflow-hidden p-5 sm:p-7">
      <Step n={1}>{t.step1}</Step>

      <div className="mb-4">
        <Segmented
          label={t.step1}
          value={p.mode}
          onChange={p.onMode}
          options={[
            { value: "files", label: t.modeFiles },
            { value: "text", label: t.modeText },
          ]}
        />
      </div>

      {p.mode === "text" ? (
        <div>
          <Textarea
            value={p.text}
            onChange={(e) => p.onText(e.target.value.slice(0, MAX_TEXT_CHARS))}
            placeholder={t.textPlaceholder}
            disabled={p.loading}
            aria-label={t.modeText}
            className="paper-lines min-h-44 bg-muted text-[0.95rem] leading-8"
          />
          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
            <span className="text-muted-foreground">{t.samplesLabel}</span>
            {(["rent", "loan", "insurance"] as const).map((k) => (
              <Button key={k} variant="paper" size="sm" disabled={p.loading} onClick={() => p.onSample(k)}>
                <ClipboardType /> {t.samples[k]}
              </Button>
            ))}
          </div>
        </div>
      ) : p.files.length === 0 ? (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDrag(false);
            void addFiles(e.dataTransfer.files);
          }}
          className={cn(
            "paper-lines flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-4 py-10 text-center transition-colors",
            drag ? "border-primary bg-secondary" : "border-input bg-muted",
          )}
        >
          <FileUp className="size-9 text-primary" />
          <div>
            <p className="font-display text-lg font-semibold">{t.dropTitle}</p>
            <p className="text-sm text-muted-foreground">{t.dropHint}</p>
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            <Button variant="default" onClick={() => inputRef.current?.click()} disabled={disabled}>
              <FileText /> {t.choose}
            </Button>
            <Button variant="paper" onClick={() => cameraRef.current?.click()} disabled={disabled}>
              <Camera /> {t.camera}
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
          {p.files.map((f, i) => (
            <div key={f.id} className="relative aspect-[3/4] overflow-hidden rounded-lg border bg-muted shadow-paper">
              {f.preview ? (
                <img src={f.preview} alt={`Page ${i + 1}`} className="size-full object-cover" />
              ) : (
                <div className="flex size-full flex-col items-center justify-center gap-1 text-primary">
                  <FileText className="size-8" />
                  <span className="text-xs font-semibold">PDF</span>
                </div>
              )}
              {p.loading && (
                <div className="pointer-events-none absolute inset-x-0 top-0 h-[10%] animate-scan bg-gradient-to-b from-transparent via-accent/70 to-transparent" />
              )}
              <span className="absolute bottom-1 left-1 rounded bg-ink px-1.5 text-xs font-semibold text-paper">
                {i + 1}
              </span>
              {!p.loading && (
                <button
                  type="button"
                  aria-label={t.remove}
                  onClick={() => p.onFiles(p.files.filter((x) => x.id !== f.id))}
                  className="absolute right-1 top-1 rounded-full bg-ink p-1 text-paper hover:bg-destructive"
                >
                  <X className="size-3.5" />
                </button>
              )}
            </div>
          ))}
          {p.files.length < MAX_FILES && !p.loading && (
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={disabled}
              className="flex aspect-[3/4] flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-input text-muted-foreground hover:border-primary hover:text-primary"
            >
              <FileUp className="size-6" />
              <span className="text-xs font-medium">+</span>
            </button>
          )}
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*,application/pdf"
        multiple
        hidden
        onChange={(e) => void addFiles(e.target.files)}
      />
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={(e) => void addFiles(e.target.files)}
      />

      <Step n={2}>{t.step2}</Step>
      <Segmented
        label={t.step2}
        value={p.docType}
        onChange={p.onDocType}
        options={(["auto", "rent", "loan", "insurance"] as const).map((v) => ({ value: v, label: t.types[v] }))}
      />

      <Step n={3}>{t.stepAbout}</Step>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm font-medium">
          {t.income}
          <Input
            inputMode="numeric"
            value={p.income}
            onChange={(e) => p.onIncome(digitsOnly(e.target.value))}
            placeholder="40000"
            disabled={p.loading}
            className="mt-1.5 bg-card"
          />
        </label>
        <label className="text-sm font-medium">
          {t.emi}
          <Input
            inputMode="numeric"
            value={p.emi}
            onChange={(e) => p.onEmi(digitsOnly(e.target.value))}
            placeholder="0"
            disabled={p.loading}
            className="mt-1.5 bg-card"
          />
        </label>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">{t.aboutHint}</p>
      <label className="mt-4 block text-sm font-medium">
        {t.question}
        <Input
          value={p.question}
          onChange={(e) => p.onQuestion(e.target.value.slice(0, 500))}
          placeholder={t.questionPlaceholder}
          disabled={p.loading}
          className="mt-1.5 bg-card"
        />
      </label>

      <Step n={4}>{t.step3}</Step>
      <Segmented
        label={t.step3}
        value={p.lang}
        onChange={p.onLang}
        options={[
          { value: "en", label: "English" },
          { value: "hi", label: "हिन्दी" },
        ]}
      />

      <Button variant="hero" size="xl" className="mt-8 w-full" disabled={!ready || disabled} onClick={p.onSubmit}>
        {p.loading ? <span aria-live="polite">{t.reading[msgIdx]}</span> : t.explain}
      </Button>

      <p className="mt-4 flex items-start gap-2 text-sm text-muted-foreground">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" />
        {t.privacyLong}
      </p>
    </div>
  );
}
