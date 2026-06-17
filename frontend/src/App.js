import { useState, useEffect, useCallback, useRef } from "react";
import { jsPDF } from "jspdf";
import "@/App.css";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useNavigate,
  useLocation,
  useSearchParams,
} from "react-router-dom";
import axios from "axios";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import {
  Upload,
  FileText,
  History,
  Zap,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Trash2,
  ChevronRight,
  Target,
  Code,
  ClipboardList,
  RefreshCw,
  Loader2,
  Pencil,
  Shield,
  Cloud,
  Clock,
  TrendingUp,
  BarChart3,
  User,
  Info,
  GraduationCap,
  FileDown,
  MessageSquare,
  Copy,
  Play,
  Settings,
  LogIn,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useDropzone } from "react-dropzone";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;
const TOKEN_KEY = "resumeai_access_token";

const setAxiosToken = (token) => {
  if (token) {
    axios.defaults.headers.common.Authorization = `Bearer ${token}`;
  } else {
    delete axios.defaults.headers.common.Authorization;
  }
};

/* ─── Utilities ──────────────────────────────────────────────── */

const clamp0to100 = (n) => {
  const num = Number(n);
  if (!Number.isFinite(num)) return 0;
  return Math.max(0, Math.min(100, Math.round(num)));
};

const formatDelta = (delta) => {
  const d = Number(delta);
  if (!Number.isFinite(d) || d === 0) return "0";
  return d > 0 ? `+${d}` : `${d}`;
};

const downloadTextFile = ({ filename, text, mimeType = "text/plain" }) => {
  const blob = new Blob([text], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};

const getScoreColor = (score) => {
  if (score >= 70) return "text-emerald-400";
  if (score >= 40) return "text-yellow-400";
  return "text-red-400";
};

const getDecisionStyle = (decision) => {
  const d = (decision || "").toLowerCase();
  if (d.includes("highly") || d.includes("strong"))
    return {
      text: "text-emerald-400",
      bg: "bg-emerald-500/20",
      border: "border-emerald-500/30",
    };
  if (d.includes("likely") || d.includes("moderate") || d.includes("maybe"))
    return {
      text: "text-yellow-400",
      bg: "bg-yellow-500/20",
      border: "border-yellow-500/30",
    };
  return {
    text: "text-red-400",
    bg: "bg-red-500/20",
    border: "border-red-500/30",
  };
};

const getSignalChipStyle = (value) => {
  const v = (value || "").toLowerCase();
  if (v.includes("strong") || v.includes("high") || v.includes("matches")) {
    return "bg-emerald-500/10 border-emerald-500/40 text-emerald-200";
  }
  if (v.includes("moderate") || v.includes("medium")) {
    return "bg-amber-500/10 border-amber-500/40 text-amber-200";
  }
  if (!value) {
    return "bg-zinc-900 border-zinc-700 text-zinc-400";
  }
  return "bg-red-500/10 border-red-500/40 text-red-200";
};

const sanitizeFilenameToken = (value, fallback) => {
  const cleaned = (value || "")
    .trim()
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return (cleaned || fallback).toUpperCase();
};

const buildCoverLetterFilename = ({ companyName, targetRole }) =>
  `COVER_LETTER_${sanitizeFilenameToken(companyName, "COMPANY")}_${sanitizeFilenameToken(targetRole, "ROLE")}.pdf`;

const generateCoverLetterPdf = (
  coverLetterData,
  basics,
  { companyName = "", targetRole = "" } = {},
) => {
  const cl = coverLetterData;
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const marginLeft = 54;
  const marginRight = 54;
  const maxWidth = pageWidth - marginLeft - marginRight;
  let y = 54;

  doc.setFont("aptos", "normal");

  // Header: candidate name and contact info
  const candidateName = cl.candidate_name || basics?.name || "";
  if (candidateName) {
    doc.setFontSize(16);
    doc.setFont("aptos", "bold");
    doc.text(candidateName, pageWidth / 2, y, { align: "center" });
    y += 20;
  }

  if (basics) {
    doc.setFontSize(10);
    doc.setFont("aptos", "normal");
    const contactSegments = [basics.email, basics.phone]
      .filter(Boolean)
      .map((text) => ({ text }));
    const linkLabelFor = (l) => {
      const label = (l.label || "").trim();
      const url = (l.url || "").toLowerCase();
      if (/linkedin/.test(url) || label.toLowerCase() === "linkedin")
        return "LinkedIn";
      if (/github\.com/.test(url) || label.toLowerCase() === "github")
        return "GitHub";
      if (
        label.toLowerCase() === "website" ||
        label.toLowerCase() === "portfolio"
      )
        return "Website";
      return label || l.url;
    };
    const linkSegments = (basics.links || [])
      .map((l) => ({
        text: l.url ? linkLabelFor(l) : l.label || l.url,
        url: l.url,
      }))
      .filter((s) => s.text);
    const segments = [...contactSegments, ...linkSegments];
    if (segments.length > 0) {
      const sep = " | ";
      const sepWidth = doc.getTextWidth(sep);
      const lines = [];
      let current = [];
      for (const seg of segments) {
        const withNext = current.length
          ? current.map((s) => s.text).join(sep) + sep + seg.text
          : seg.text;
        if (doc.getTextWidth(withNext) <= maxWidth) {
          current.push(seg);
        } else {
          if (current.length) {
            lines.push(current);
            current = [seg];
          } else {
            const sublines = doc.splitTextToSize(seg.text, maxWidth);
            lines.push({ sublines, url: seg.url });
          }
        }
      }
      if (current.length) lines.push(current);
      const lineHeight = 13;
      for (const line of lines) {
        if (Array.isArray(line)) {
          const totalWidth = line.reduce(
            (acc, s) => acc + doc.getTextWidth(s.text) + sepWidth,
            -sepWidth,
          );
          let x = (pageWidth - totalWidth) / 2;
          for (const seg of line) {
            const w = doc.getTextWidth(seg.text);
            if (seg.url) {
              doc.setTextColor(0, 0, 255);
              doc.textWithLink(seg.text, x, y, { url: seg.url });
              doc.setDrawColor(0, 0, 255);
              doc.line(x, y + 1.5, x + w, y + 1.5);
              doc.setTextColor(0, 0, 0);
              doc.setDrawColor(0, 0, 0);
            } else {
              doc.text(seg.text, x, y);
            }
            x += w + sepWidth;
          }
          y += lineHeight;
        } else {
          const { sublines, url } = line;
          for (const sub of sublines) {
            const w = doc.getTextWidth(sub);
            const x = (pageWidth - w) / 2;
            if (url) {
              doc.setTextColor(0, 0, 255);
              doc.textWithLink(sub, x, y, { url });
              doc.setDrawColor(0, 0, 255);
              doc.line(x, y + 1.5, x + w, y + 1.5);
              doc.setTextColor(0, 0, 0);
              doc.setDrawColor(0, 0, 0);
            } else {
              doc.text(sub, x, y);
            }
            y += lineHeight;
          }
        }
      }
    }
  }

  y += 14;
  doc.setDrawColor(180);
  doc.line(marginLeft, y, pageWidth - marginRight, y);
  y += 14;

  // Date
  doc.setFontSize(12);
  doc.setFont("aptos", "normal");
  const today = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  doc.text(today, marginLeft, y);
  y += 24;

  // Greeting
  if (cl.greeting) {
    doc.setFont("aptos", "normal");
    doc.text(cl.greeting, marginLeft, y);
    y += 20;
  }

  const renderParagraph = (text) => {
    doc.setFontSize(12);
    doc.setFont("aptos", "normal");
    const lines = doc.splitTextToSize(text, maxWidth);
    const lineHeight = 17;
    for (const line of lines) {
      if (y + lineHeight > doc.internal.pageSize.getHeight() - 54) {
        doc.addPage();
        y = 54;
      }
      doc.text(line, marginLeft, y);
      y += lineHeight;
    }
    y += 10;
  };

  if (cl.opening_paragraph) renderParagraph(cl.opening_paragraph);
  if (cl.body_paragraphs) {
    cl.body_paragraphs.forEach((p) => renderParagraph(p));
  }
  if (cl.closing_paragraph) renderParagraph(cl.closing_paragraph);

  y += 6;
  if (cl.sign_off) {
    doc.setFont("aptos", "normal");
    doc.text(cl.sign_off, marginLeft, y);
    y += 20;
  }
  if (candidateName) {
    doc.setFont("aptos", "bold");
    doc.text(candidateName, marginLeft, y);
  }

  doc.save(buildCoverLetterFilename({ companyName, targetRole }));
};

/** Bump version to invalidate stale sessionStorage LaTeX entries after template changes. */
const LATEX_CACHE_PREFIX = "resumeai:latex_cache:v2";
/** Legacy prefix — still removed by clear helpers so old tabs drop stale LaTeX. */
const LATEX_CACHE_PREFIX_V1 = "resumeai:latex_cache:v1";
const COVER_LETTER_CACHE_PREFIX = "resumeai:cover_letter_cache:v1";
const COLD_MESSAGE_CACHE_PREFIX = "resumeai:cold_message_cache:v1";

const RESUME_GENERATION_CACHE_PREFIXES = [
  LATEX_CACHE_PREFIX,
  LATEX_CACHE_PREFIX_V1,
  COVER_LETTER_CACHE_PREFIX,
  COLD_MESSAGE_CACHE_PREFIX,
];

const stableStringify = (value) => {
  const seen = new WeakSet();
  const normalize = (v) => {
    if (v === null || typeof v !== "object") return v;
    if (v instanceof Date) return v.toISOString();
    if (Array.isArray(v)) return v.map(normalize);
    if (seen.has(v)) return "[Circular]";
    seen.add(v);
    const out = {};
    for (const key of Object.keys(v).sort()) out[key] = normalize(v[key]);
    return out;
  };
  return JSON.stringify(normalize(value));
};

const hashStringDjb2 = (str) => {
  // Fast, deterministic (non-crypto) hash for cache keys.
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h) ^ str.charCodeAt(i);
  return (h >>> 0).toString(36);
};

const computeLatexCacheKey = (
  userId,
  evalId,
  resumeJson,
  template = "1page",
) => {
  const scopedUserId = userId || "anonymous";
  const fingerprint = hashStringDjb2(stableStringify(resumeJson));
  return `${LATEX_CACHE_PREFIX}:${scopedUserId}:${evalId}:${template}:${fingerprint}`;
};

const getLatexFromCache = (key) => {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
};

const setLatexInCache = (key, latex) => {
  try {
    sessionStorage.setItem(key, latex);
  } catch {
    // ignore storage failures (quota/private mode)
  }
};

const computeCoverColdFingerprint = (resumeJson, jobDescription, targetRole) =>
  hashStringDjb2(
    stableStringify({
      resumeJson,
      job_description: jobDescription || "",
      target_role: targetRole || "Software Engineer",
    }),
  );

const computeCoverLetterCacheKey = (
  userId,
  evalId,
  resumeJson,
  jobDescription,
  targetRole,
) => {
  const scopedUserId = userId || "anonymous";
  const fp = computeCoverColdFingerprint(
    resumeJson,
    jobDescription,
    targetRole,
  );
  return `${COVER_LETTER_CACHE_PREFIX}:${scopedUserId}:${evalId}:${fp}`;
};

const computeColdMessageCacheKey = (
  userId,
  evalId,
  resumeJson,
  jobDescription,
  targetRole,
) => {
  const scopedUserId = userId || "anonymous";
  const fp = computeCoverColdFingerprint(
    resumeJson,
    jobDescription,
    targetRole,
  );
  return `${COLD_MESSAGE_CACHE_PREFIX}:${scopedUserId}:${evalId}:${fp}`;
};

const getJsonFromSessionCache = (key) => {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

const setJsonInSessionCache = (key, value) => {
  try {
    sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore
  }
};

const clearResumeGenerationCacheForEval = (userId, evalId) => {
  if (!userId || !evalId) return;
  const needle = `:${userId}:${evalId}:`;
  try {
    for (let i = sessionStorage.length - 1; i >= 0; i--) {
      const k = sessionStorage.key(i);
      if (!k) continue;
      for (const p of RESUME_GENERATION_CACHE_PREFIXES) {
        if (k.startsWith(`${p}:`) && k.includes(needle)) {
          sessionStorage.removeItem(k);
          break;
        }
      }
    }
  } catch {
    // ignore
  }
};

const clearResumeGenerationCacheForUser = (userId) => {
  if (!userId) return;
  try {
    for (let i = sessionStorage.length - 1; i >= 0; i--) {
      const k = sessionStorage.key(i);
      if (!k) continue;
      if (
        k.startsWith(`${LATEX_CACHE_PREFIX}:${userId}:`) ||
        k.startsWith(`${LATEX_CACHE_PREFIX_V1}:${userId}:`) ||
        k.startsWith(`${COVER_LETTER_CACHE_PREFIX}:${userId}:`) ||
        k.startsWith(`${COLD_MESSAGE_CACHE_PREFIX}:${userId}:`)
      ) {
        sessionStorage.removeItem(k);
      }
    }
  } catch {
    // ignore
  }
};

/** Clears LaTeX, cover letter, and cold message session caches (e.g. on logout or auth failure). */
const clearAllResumeGenerationCache = () => {
  try {
    for (let i = sessionStorage.length - 1; i >= 0; i--) {
      const k = sessionStorage.key(i);
      if (!k) continue;
      for (const p of RESUME_GENERATION_CACHE_PREFIXES) {
        if (k.startsWith(`${p}:`)) {
          sessionStorage.removeItem(k);
          break;
        }
      }
    }
  } catch {
    // ignore
  }
};

/* ─── Navigation ─────────────────────────────────────────────── */

const Navigation = ({ user, onLogin }) => {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-[#09090b]/80 backdrop-blur-xl border-b border-white/10">
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
        <div
          className="flex items-center gap-3 cursor-pointer"
          onClick={() => navigate("/")}
        >
          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-cyan-400 rounded-lg flex items-center justify-center">
            <Zap className="w-6 h-6 text-white" />
          </div>
          <span className="font-mono text-xl font-bold tracking-tight text-white">
            ResumeAI
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={location.pathname === "/" ? "default" : "ghost"}
            onClick={() => navigate("/")}
            className="gap-2"
          >
            <Target className="w-4 h-4" />
            Evaluate
          </Button>
          <Button
            variant={location.pathname === "/history" ? "default" : "ghost"}
            onClick={() => navigate("/history")}
            className="gap-2"
          >
            <History className="w-4 h-4" />
            History
          </Button>
          {user?.role === "admin" && (
            <Button
              variant={location.pathname === "/admin" ? "default" : "ghost"}
              onClick={() => navigate("/admin")}
              className="gap-2"
            >
              <Shield className="w-4 h-4" />
              Admin
            </Button>
          )}
          {!user ? (
            <Button onClick={onLogin} className="ml-2">
              Sign in with Google
            </Button>
          ) : (
            <Button
              variant={location.pathname === "/profile" ? "default" : "outline"}
              onClick={() => navigate("/profile")}
              className="ml-2 gap-2"
            >
              <User className="w-4 h-4" />
              Profile
            </Button>
          )}
        </div>
      </div>
    </nav>
  );
};

/* ─── File Upload Zone ───────────────────────────────────────── */

const FileUploadZone = ({ onFileSelect, selectedFile }) => {
  const onDrop = useCallback(
    (acceptedFiles) => {
      if (acceptedFiles[0]) onFileSelect(acceptedFiles[0]);
    },
    [onFileSelect],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "application/pdf": [".pdf"] },
    maxFiles: 1,
  });

  return (
    <div
      {...getRootProps()}
      className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-all duration-300 ${
        isDragActive
          ? "border-blue-500 bg-blue-500/10"
          : selectedFile
            ? "border-green-500 bg-green-500/10"
            : "border-zinc-700 hover:border-blue-500/50 hover:bg-blue-500/5"
      }`}
    >
      <input {...getInputProps()} />
      <Upload
        className={`w-12 h-12 mx-auto mb-4 ${selectedFile ? "text-green-500" : "text-zinc-500"}`}
      />
      {selectedFile ? (
        <div>
          <p className="text-green-400 font-medium">{selectedFile.name}</p>
          <p className="text-zinc-500 text-sm mt-1">Click or drop to replace</p>
        </div>
      ) : isDragActive ? (
        <p className="text-blue-400">Drop your resume here...</p>
      ) : (
        <div>
          <p className="text-zinc-300 font-medium">Drop your PDF resume here</p>
          <p className="text-zinc-500 text-sm mt-1">or click to browse</p>
        </div>
      )}
    </div>
  );
};

/* ─── Score Ring ──────────────────────────────────────────────── */

const ScoreRing = ({ score, label, size = "lg" }) => {
  const radius = size === "lg" ? 60 : 40;
  const stroke = size === "lg" ? 8 : 6;
  const normalizedRadius = radius - stroke * 2;
  const circumference = normalizedRadius * 2 * Math.PI;
  const strokeDashoffset = circumference - (score / 100) * circumference;
  const color = score >= 70 ? "#10b981" : score >= 40 ? "#f59e0b" : "#ef4444";

  return (
    <div className="flex flex-col items-center">
      <svg height={radius * 2} width={radius * 2}>
        <circle
          stroke="#27272a"
          fill="transparent"
          strokeWidth={stroke}
          r={normalizedRadius}
          cx={radius}
          cy={radius}
        />
        <circle
          stroke={color}
          fill="transparent"
          strokeWidth={stroke}
          strokeDasharray={circumference + " " + circumference}
          style={{
            strokeDashoffset,
            transition: "stroke-dashoffset 1s ease-out",
          }}
          strokeLinecap="round"
          r={normalizedRadius}
          cx={radius}
          cy={radius}
          transform={`rotate(-90 ${radius} ${radius})`}
        />
        <text
          x="50%"
          y="50%"
          dy=".3em"
          textAnchor="middle"
          className="fill-white font-mono font-bold"
          style={{ fontSize: size === "lg" ? "24px" : "16px" }}
        >
          {score}%
        </text>
      </svg>
      {label && (
        <span className="text-zinc-400 text-sm mt-2 font-medium">{label}</span>
      )}
    </div>
  );
};

/* ─── Small Components ───────────────────────────────────────── */

const SectionPill = ({ children }) => (
  <span className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-zinc-300">
    {children}
  </span>
);

const ScoreDeltaCard = ({ label, before, after, accent = "blue", helper }) => {
  const b = before == null ? null : clamp0to100(before);
  const a = clamp0to100(after);
  const delta = b == null ? null : a - b;

  const accentMap = {
    blue: {
      ring: "from-blue-500 to-cyan-400",
      badge: "bg-blue-500/15 text-blue-300 border-blue-500/30",
    },
    green: {
      ring: "from-emerald-500 to-lime-400",
      badge: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
    },
    violet: {
      ring: "from-violet-500 to-fuchsia-400",
      badge: "bg-violet-500/15 text-violet-300 border-violet-500/30",
    },
  };
  const styles = accentMap[accent] || accentMap.blue;

  return (
    <Card className="bg-zinc-900/60 border-zinc-800">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">
              {label}
            </p>
            <div className="mt-1.5 flex items-baseline gap-2">
              <span className="font-mono text-2xl md:text-3xl font-bold text-white">
                {a}%
              </span>
              {delta != null && (
                <Badge
                  variant="outline"
                  className={`font-mono text-xs px-2 py-0.5 border ${styles.badge}`}
                >
                  {formatDelta(delta)}
                </Badge>
              )}
            </div>
            {b != null ? (
              <>
                <div className="mt-1.5 flex items-center gap-3 text-[11px] text-zinc-500">
                  <span>Before: {b}%</span>
                  <span className="h-1 w-1 rounded-full bg-zinc-600" />
                  <span>After: {a}%</span>
                </div>
                <Progress value={a} className="mt-2 h-1.5 bg-zinc-800" />
              </>
            ) : (
              <p className="mt-2 text-xs text-zinc-400">
                {helper || "No prior baseline available for comparison."}
              </p>
            )}
          </div>
          <div
            className={`h-10 w-10 shrink-0 rounded-xl bg-gradient-to-br ${styles.ring} opacity-90`}
          />
        </div>
      </CardContent>
    </Card>
  );
};

/* ─── Loading Card ───────────────────────────────────────────── */

const LoadingCard = ({ message, stage = 0 }) => {
  const stepClasses = (idx) => {
    if (stage === idx) return "bg-blue-500";
    if (stage > idx) return "bg-blue-500/60";
    return "bg-blue-500/20";
  };

  const textClasses = (idx) => {
    if (stage === idx) return "text-zinc-200";
    if (stage > idx) return "text-zinc-300";
    return "text-zinc-500";
  };

  return (
    <div className="max-w-2xl mx-auto animate-fade-in-up">
      <Card className="bg-black/40 backdrop-blur-xl border border-white/10 overflow-hidden">
        <div className="h-1 w-full bg-zinc-800 overflow-hidden">
          <div className="h-full w-1/3 bg-gradient-to-r from-blue-500 to-cyan-400 rounded-full animate-loading-bar" />
        </div>
        <CardContent className="p-12 flex flex-col items-center gap-6">
          <div className="relative w-20 h-20">
            <div className="absolute inset-0 rounded-full border-4 border-zinc-800" />
            <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-blue-500 border-r-blue-500/30 animate-spin" />
            <div className="absolute inset-0 flex items-center justify-center">
              <Zap className="w-8 h-8 text-blue-400 animate-pulse" />
            </div>
          </div>
          <div className="text-center space-y-2">
            <h3 className="text-lg font-mono font-semibold text-white">
              Analyzing Your Resume
            </h3>
            <p className="text-sm text-zinc-400 max-w-md">
              {message || "Processing..."}
            </p>
          </div>
          <div className="w-64 space-y-3 text-xs">
            <div className="flex items-center gap-2">
              <div
                className={`w-1.5 h-1.5 rounded-full animate-pulse ${stepClasses(0)}`}
              />
              <span className={textClasses(0)}>
                Formatting resume &amp; job description
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div
                className={`w-1.5 h-1.5 rounded-full animate-pulse ${stepClasses(1)}`}
              />
              <span className={textClasses(1)}>
                Running ATS gap analysis &amp; scoring
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div
                className={`w-1.5 h-1.5 rounded-full animate-pulse ${stepClasses(2)}`}
              />
              <span className={textClasses(2)}>
                Iterating improvements until 80%+ ATS
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div
                className={`w-1.5 h-1.5 rounded-full animate-pulse ${stepClasses(3)}`}
              />
              <span className={textClasses(3)}>Evaluating hireability</span>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-zinc-600">
            <Clock className="w-3.5 h-3.5" />
            <span>This typically takes 30–60 seconds</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

/* ─── Detail Loading Skeleton ────────────────────────────────── */

const DetailSkeleton = () => (
  <div className="space-y-6 animate-pulse">
    <Card className="bg-zinc-900/50 border-zinc-800">
      <CardContent className="p-6 space-y-4">
        <Skeleton className="h-6 w-48 bg-zinc-800" />
        <Skeleton className="h-4 w-96 bg-zinc-800" />
        <div className="grid grid-cols-3 gap-4 mt-4">
          <Skeleton className="h-32 bg-zinc-800 rounded-lg" />
          <Skeleton className="h-32 bg-zinc-800 rounded-lg" />
          <Skeleton className="h-32 bg-zinc-800 rounded-lg" />
        </div>
      </CardContent>
    </Card>
    <Skeleton className="h-48 bg-zinc-800 rounded-lg" />
    <Skeleton className="h-64 bg-zinc-800 rounded-lg" />
  </div>
);

/* ─── ATS Score Breakdown Panel ──────────────────────────────── */

const PHASE_META = {
  must_have: { label: "Must-have Skills", Icon: Target },
  experience_years: { label: "Experience Years", Icon: Clock },
  experience_depth: { label: "Experience Depth", Icon: TrendingUp },
  cloud: { label: "Cloud Platform", Icon: Cloud },
  preferred: { label: "Preferred Skills", Icon: TrendingUp },
  education: { label: "Education", Icon: GraduationCap },
};

const ATSBreakdownPanel = ({ atsResult }) => {
  const [infoOpen, setInfoOpen] = useState(false);

  if (!atsResult?.score_breakdown) return null;

  return (
    <Card className="bg-zinc-900/50 border-zinc-800">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-lg font-mono flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-cyan-400" />
            ATS Score Breakdown
          </CardTitle>
          <TooltipProvider>
            <Tooltip open={infoOpen} onOpenChange={setInfoOpen}>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  aria-label="How ATS score is computed"
                  className="inline-flex items-center justify-center rounded-full border border-white/10 bg-black/40 p-1.5 hover:bg-black/70"
                  onClick={(e) => {
                    e.preventDefault();
                    setInfoOpen((prev) => !prev);
                  }}
                >
                  <Info className="w-3.5 h-3.5 text-zinc-300" />
                </button>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs text-xs">
                <p>
                  ATS score is computed from must-have skills coverage, years of
                  experience, cloud alignment, preferred skills, experience
                  depth, and education match, each weighted by importance.
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <p className="text-sm text-zinc-400">
          How your score of{" "}
          <span
            className={`font-mono font-bold ${getScoreColor(atsResult.final_score)}`}
          >
            {atsResult.final_score}%
          </span>{" "}
          was computed across 6 evaluation phases.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {Object.entries(atsResult.score_breakdown).map(([key, data]) => {
          const meta = PHASE_META[key] || { label: key, Icon: Target };
          const PhaseIcon = meta.Icon;
          const phaseScore = Math.round(
            (atsResult.phase_scores?.[key] || 0) * 100,
          );
          const weight = atsResult.normalized_weights?.[key] || 0;

          return (
            <div
              key={key}
              className="rounded-lg border border-white/10 bg-black/30 p-4"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <PhaseIcon className="w-4 h-4 text-zinc-400" />
                  <span className="text-sm font-semibold text-white">
                    {meta.label}
                  </span>
                  <Badge
                    variant="outline"
                    className="border-cyan-500/40 bg-cyan-500/10 text-cyan-200 text-[10px] font-mono"
                  >
                    {weight.toFixed(0)}% weight
                  </Badge>
                </div>
                <span
                  className={`font-mono text-sm font-bold ${getScoreColor(phaseScore)}`}
                >
                  {phaseScore}%
                </span>
              </div>
              <Progress value={phaseScore} className="h-2 bg-zinc-800" />
              <p className="mt-2 text-xs text-zinc-400">{data.reason}</p>
            </div>
          );
        })}

        {atsResult.risk_factors?.length > 0 && (
          <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-4 h-4 text-red-400" />
              <span className="text-sm font-semibold text-red-300">
                Risk Factors
              </span>
            </div>
            <ul className="space-y-1">
              {atsResult.risk_factors.map((risk, i) => (
                <li
                  key={i}
                  className="text-xs text-red-200/80 flex items-start gap-2"
                >
                  <span className="text-red-400 mt-0.5">•</span>
                  <span>{risk}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

/* ─── Skills Gap Panel ───────────────────────────────────────── */

const SkillBadgeGroup = ({ title, icon: Icon, colorClass, items }) => {
  if (!items?.length) return null;
  return (
    <div>
      <p
        className={`text-xs uppercase tracking-wider mb-2 flex items-center gap-1 ${colorClass}`}
      >
        <Icon className="w-3 h-3" /> {title}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {items.map((s, i) => (
          <Badge
            key={i}
            variant="outline"
            className={`text-xs ${
              colorClass.includes("emerald")
                ? "border-emerald-500/30 text-emerald-300"
                : colorClass.includes("amber")
                  ? "border-amber-500/30 text-amber-300"
                  : "border-red-500/30 text-red-300"
            }`}
          >
            {s}
          </Badge>
        ))}
      </div>
    </div>
  );
};

const SkillsGapPanel = ({ atsAnalysis }) => {
  if (!atsAnalysis) return null;

  const mustHave = atsAnalysis.must_have_analysis || {};
  const preferred = atsAnalysis.preferred_analysis || {};
  const experience = atsAnalysis.experience_requirement || {};
  const cloudStatus = atsAnalysis.required_cloud_status || {};

  const totalMustHave = mustHave.total_required || 0;
  const foundMustHave =
    (mustHave.found_in_experience?.length || 0) +
    (mustHave.found_in_skills_only?.length || 0);

  const hasPreferredSkills =
    (preferred.found_in_experience?.length || 0) +
      (preferred.found_in_skills_only?.length || 0) +
      (preferred.missing?.length || 0) >
    0;

  return (
    <Card className="bg-zinc-900/50 border-zinc-800">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-mono flex items-center gap-2">
          <Shield className="w-5 h-5 text-emerald-400" />
          Skill Analysis
        </CardTitle>
        <p className="text-sm text-zinc-400">
          {foundMustHave}/{totalMustHave} must-have skills covered
        </p>
      </CardHeader>
      <CardContent className="space-y-5">
        <div>
          <h4 className="text-sm font-semibold text-white mb-3">
            Must-have Skills
          </h4>
          <div className="space-y-3">
            <SkillBadgeGroup
              title="Found in Experience"
              icon={CheckCircle}
              colorClass="text-emerald-400/80"
              items={mustHave.found_in_experience}
            />
            <SkillBadgeGroup
              title="Skills Section Only"
              icon={AlertTriangle}
              colorClass="text-amber-400/80"
              items={mustHave.found_in_skills_only}
            />
            <SkillBadgeGroup
              title="Missing"
              icon={XCircle}
              colorClass="text-red-400/80"
              items={mustHave.missing}
            />
          </div>
        </div>

        <Separator className="bg-white/5" />

        {hasPreferredSkills ? (
          <div>
            <h4 className="text-sm font-semibold text-white mb-3">
              Preferred Skills
            </h4>
            <div className="space-y-3">
              <SkillBadgeGroup
                title="Found in Experience"
                icon={CheckCircle}
                colorClass="text-emerald-400/80"
                items={preferred.found_in_experience}
              />
              <SkillBadgeGroup
                title="Skills Section Only"
                icon={AlertTriangle}
                colorClass="text-amber-400/80"
                items={preferred.found_in_skills_only}
              />
              {preferred.missing?.length > 0 && (
                <div>
                  <p className="text-xs uppercase tracking-wider text-zinc-500 mb-2 flex items-center gap-1">
                    <XCircle className="w-3 h-3" /> Missing
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {preferred.missing.map((s, i) => (
                      <Badge
                        key={i}
                        variant="outline"
                        className="border-zinc-600 text-zinc-400 text-xs"
                      >
                        {s}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div>
            <h4 className="text-sm font-semibold text-white mb-1">
              Preferred Skills
            </h4>
            <p className="text-xs text-zinc-400">
              This job description does not list any preferred skills beyond the
              must-have requirements.
            </p>
          </div>
        )}

        <Separator className="bg-white/5" />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="rounded-lg border border-white/10 bg-black/30 p-3">
            <div className="flex items-center gap-2 mb-1">
              <Clock className="w-3.5 h-3.5 text-emerald-400" />
              <p className="text-xs uppercase tracking-wider text-emerald-300">
                Experience
              </p>
            </div>
            {experience.minimum_years_required ? (
              <>
                <p className="font-mono text-sm text-white">
                  {experience.candidate_total_years ?? "—"} /{" "}
                  {experience.minimum_years_required ?? "—"} years
                </p>
                <Progress
                  value={Math.min(
                    100,
                    ((experience.candidate_total_years || 0) /
                      experience.minimum_years_required) *
                      100,
                  )}
                  className="h-1.5 bg-zinc-800 mt-2"
                />
              </>
            ) : (
              <p className="font-mono text-sm text-zinc-300">Not required</p>
            )}
          </div>
          <div className="rounded-lg border border-white/10 bg-black/30 p-3">
            <div className="flex items-center gap-2 mb-1">
              <Cloud className="w-3.5 h-3.5 text-sky-400" />
              <p className="text-xs uppercase tracking-wider text-sky-300">
                Cloud
              </p>
            </div>
            {cloudStatus.required ? (
              <>
                <p className="font-mono text-sm text-white">
                  {cloudStatus.required}
                </p>
                <Badge
                  variant="outline"
                  className={`mt-1 text-[10px] ${
                    cloudStatus.present_in_experience
                      ? "border-emerald-500/30 text-emerald-300"
                      : "border-red-500/30 text-red-300"
                  }`}
                >
                  {cloudStatus.present_in_experience
                    ? "In experience"
                    : "Not found"}
                </Badge>
              </>
            ) : (
              <p className="font-mono text-sm text-zinc-300">Not required</p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

/* ─── Profile Snapshot ───────────────────────────────────────── */

const ProfileSnapshot = ({ resumeJson, onEditJson, isEdited }) => {
  const resume = resumeJson?.resume;
  const basics = resume?.basics;
  const sections = resume?.sections || {};
  const summary =
    (basics?.summary || "").trim() ||
    (resume?.summary || "").trim() ||
    (resumeJson?.summary || "").trim() ||
    "";

  const educationItems =
    sections.education?.items ||
    sections.education?.degrees ||
    sections.education ||
    [];

  const publications =
    Array.isArray(sections.publications?.items) && sections.publications.items
      ? sections.publications.items
      : [];
  const certifications =
    Array.isArray(sections.certifications?.items) && sections.certifications.items
      ? sections.certifications.items
      : [];
  const recognitions =
    Array.isArray(sections.recognitions?.items) && sections.recognitions.items
      ? sections.recognitions.items
      : [];

  const hasMeaningfulItems = (items) =>
    Array.isArray(items) &&
    items.some((item) => {
      if (!item || typeof item !== "object") return false;
      const primary = (item.title || item.name || "").trim();
      return !!primary;
    });

  const filteredPublications = (publications || []).filter((pub) =>
    hasMeaningfulItems([pub]),
  );
  const filteredCertifications = (certifications || []).filter((cert) =>
    hasMeaningfulItems([cert]),
  );
  const filteredRecognitions = (recognitions || []).filter((rec) =>
    hasMeaningfulItems([rec]),
  );

  const hasPublications = filteredPublications.length > 0;
  const hasCertifications = filteredCertifications.length > 0;
  const hasRecognitions = filteredRecognitions.length > 0;

  if (!resume) {
    return (
      <p className="text-sm text-zinc-500">
        No structured profile data available.
      </p>
    );
  }

  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-white/10 bg-black/30 p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0">
            <p className="text-white font-semibold text-lg truncate">
              {basics?.name || "—"}
            </p>
            <p className="text-sm text-zinc-400">
              {basics?.email || "—"} {basics?.phone ? `• ${basics.phone}` : ""}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {(basics?.links || [])
              .filter((l) => l?.label)
              .slice(0, 4)
              .map((l, i) => (
                <Badge
                  key={i}
                  variant="outline"
                  className="border-white/10 text-zinc-300"
                >
                  {l.label}
                </Badge>
              ))}
          </div>
        </div>

        {summary && (
          <p className="mt-3 text-sm text-zinc-300 whitespace-pre-wrap">
            {summary}
          </p>
        )}
      </div>

      <Tabs defaultValue="skills">
        <TabsList className="bg-zinc-900">
          <TabsTrigger value="skills">Skills</TabsTrigger>
          <TabsTrigger value="experience">Experience</TabsTrigger>
          <TabsTrigger value="projects">Projects</TabsTrigger>
          <TabsTrigger value="education">Education</TabsTrigger>
          {hasPublications && (
            <TabsTrigger value="publications">Publications</TabsTrigger>
          )}
          {hasCertifications && (
            <TabsTrigger value="certifications">Certifications</TabsTrigger>
          )}
          {hasRecognitions && (
            <TabsTrigger value="recognitions">Recognitions</TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="skills" className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {(sections.technical_skills?.categories || []).map((cat, i) => (
              <div
                key={i}
                className="rounded-lg border border-white/10 bg-black/30 p-4"
              >
                <p className="text-sm font-semibold text-white">{cat.name}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {(cat.items || []).map((item, j) => (
                    <Badge
                      key={j}
                      variant="outline"
                      className="border-white/10 text-zinc-300"
                    >
                      {item}
                    </Badge>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="experience" className="mt-4">
          <div className="space-y-3">
            {(sections.experience?.items || []).map((job, i) => (
              <div
                key={i}
                className="rounded-lg border border-white/10 bg-black/30 p-4"
              >
                <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                  <div className="min-w-0">
                    <p className="text-white font-semibold">
                      {job.title || "—"} {job.company ? `• ${job.company}` : ""}
                    </p>
                    <p className="text-xs text-zinc-500 font-mono mt-1">
                      {job.start_date || "—"} — {job.end_date || "—"}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {(job.tags || []).slice(0, 6).map((t, j) => (
                      <Badge
                        key={j}
                        variant="outline"
                        className="border-white/10 text-zinc-300"
                      >
                        {t}
                      </Badge>
                    ))}
                  </div>
                </div>
                {(job.highlights || []).length > 0 && (
                  <ul className="mt-3 space-y-2 text-sm text-zinc-300">
                    {job.highlights.map((h, j) => (
                      <li key={j} className="flex items-start gap-2">
                        <ChevronRight className="w-4 h-4 mt-0.5 text-cyan-300 shrink-0" />
                        <span>{h}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="projects" className="mt-4">
          <div className="space-y-3">
            {(sections.projects?.items || []).map((p, i) => (
              <div
                key={i}
                className="rounded-lg border border-white/10 bg-black/30 p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-white font-semibold">{p.name || "—"}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {((p.tech_stack || p.technologies || []) || []).map(
                        (t, j) => (
                        <Badge
                          key={j}
                          variant="outline"
                          className="border-white/10 text-zinc-300"
                        >
                          {t}
                        </Badge>
                        ),
                      )}
                    </div>
                  </div>
                </div>
                {(p.highlights || []).length > 0 && (
                  <ul className="mt-3 space-y-2 text-sm text-zinc-300">
                    {p.highlights.map((h, j) => (
                      <li key={j} className="flex items-start gap-2">
                        <ChevronRight className="w-4 h-4 mt-0.5 text-violet-300 shrink-0" />
                        <span>{h}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="education" className="mt-4">
          <div className="space-y-3">
            {(Array.isArray(educationItems) ? educationItems : []).map(
              (ed, i) => (
                <div
                  key={i}
                  className="rounded-lg border border-white/10 bg-black/30 p-4"
                >
                  <p className="text-white font-semibold">
                    {ed.institution || "—"}
                  </p>
                  <p className="text-sm text-zinc-300 mt-1">
                    {ed.degree || "—"}
                  </p>
                  <p className="text-xs text-zinc-500 font-mono mt-2">
                    {ed.start_date || "—"} — {ed.end_date || "—"}
                    {ed.gpa?.value != null
                      ? ` • GPA ${ed.gpa.value}/${ed.gpa.scale || 4}`
                      : ""}
                  </p>
                  {(ed.coursework || ed.course_works || []).length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {(ed.coursework || ed.course_works || [])
                        .slice(0, 10)
                        .map((c, j) => (
                          <Badge
                            key={j}
                            variant="outline"
                            className="border-white/10 text-zinc-300"
                          >
                            {c}
                          </Badge>
                        ))}
                    </div>
                  )}
                </div>
              ),
            )}
          </div>
        </TabsContent>

        {hasPublications && (
          <TabsContent value="publications" className="mt-4">
            <div className="space-y-3">
              {filteredPublications.map((pub, i) => {
                const title = (pub.title || pub.name || "").trim() || "Publication";
                const venue =
                  (pub.publisher_or_venue ||
                    pub.venue ||
                    pub.journal ||
                    pub.conference ||
                    "").trim();
                const date = (pub.date || "").trim();
                const topics = Array.isArray(pub.topics) ? pub.topics : [];
                const link = (pub.link || "").trim();

                return (
                  <div
                    key={i}
                    className="rounded-lg border border-white/10 bg-black/30 p-4"
                  >
                    <p className="text-white font-semibold">{title}</p>
                    {(venue || date) && (
                      <p className="text-xs text-zinc-400 mt-1">
                        {[venue, date].filter(Boolean).join(" • ")}
                      </p>
                    )}
                    {topics.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {topics.map((topic, j) => (
                          <Badge
                            key={j}
                            variant="outline"
                            className="border-white/10 text-zinc-300 text-xs"
                          >
                            {topic}
                          </Badge>
                        ))}
                      </div>
                    )}
                    {link && (
                      <p className="mt-2 text-xs">
                        <a
                          href={link}
                          target="_blank"
                          rel="noreferrer"
                          className="text-cyan-300 hover:underline break-all"
                        >
                          {link}
                        </a>
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </TabsContent>
        )}

        {hasCertifications && (
          <TabsContent value="certifications" className="mt-4">
            <div className="space-y-3">
              {filteredCertifications.map((cert, i) => {
                const title =
                  (cert.title || cert.name || "").trim() || "Certification";
                const org =
                  (cert.organization ||
                    cert.issuer ||
                    cert.provider ||
                    "").trim();
                const date = (cert.date || "").trim();

                return (
                  <div
                    key={i}
                    className="rounded-lg border border-white/10 bg-black/30 p-4"
                  >
                    <p className="text-white font-semibold">{title}</p>
                    {(org || date) && (
                      <p className="text-xs text-zinc-400 mt-1">
                        {[org, date].filter(Boolean).join(" • ")}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </TabsContent>
        )}

        {hasRecognitions && (
          <TabsContent value="recognitions" className="mt-4">
            <div className="space-y-3">
              {filteredRecognitions.map((rec, i) => {
                const title =
                  (rec.title || rec.name || "").trim() || "Recognition";
                const org =
                  (rec.organization ||
                    rec.issuer ||
                    rec.provider ||
                    "").trim();
                const date = (rec.date || "").trim();

                return (
                  <div
                    key={i}
                    className="rounded-lg border border-white/10 bg-black/30 p-4"
                  >
                    <p className="text-white font-semibold">{title}</p>
                    {(org || date) && (
                      <p className="text-xs text-zinc-400 mt-1">
                        {[org, date].filter(Boolean).join(" • ")}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
};

/* ─── JSON Editor Dialog ─────────────────────────────────────── */

const JsonEditorDialog = ({
  open,
  onOpenChange,
  draft,
  setDraft,
  error,
  saving,
  onApply,
  onReset,
}) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col bg-zinc-900 border-zinc-700 text-white">
      <DialogHeader>
        <DialogTitle className="font-mono">Edit resume JSON</DialogTitle>
        <DialogDescription className="text-zinc-400">
          Edit the structured resume data. Changes apply to the profile snapshot
          immediately after you click Apply. Copy LaTeX will send this JSON to
          generate the resume.
        </DialogDescription>
      </DialogHeader>
      <div className="flex-1 min-h-0 flex flex-col gap-2">
        <Textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          className="flex-1 min-h-[320px] font-mono text-sm bg-zinc-950 border-zinc-700 resize-none"
          placeholder='{"resume": { ... }}'
          spellCheck={false}
        />
        {error && <p className="text-sm text-red-400">{error}</p>}
      </div>
      <DialogFooter className="gap-2 sm:gap-0">
        {/* <Button
          variant="outline"
          className="border-zinc-600 text-zinc-300"
          onClick={onReset}
        >
          Reset to original
        </Button> */}
        <Button variant="ghost" onClick={() => onOpenChange(false)}>
          Cancel
        </Button>
        <Button
          onClick={onApply}
          disabled={saving}
          className="bg-blue-600 hover:bg-blue-700"
        >
          {saving ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
              Saving...
            </>
          ) : (
            "Apply"
          )}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
);

/* ─── Results Dashboard (shared) ─────────────────────────────── */

const ResultsDashboard = ({
  result,
  getCurrentResumeJson,
  isEdited,
  onOpenJsonEditor,
  headerExtra,
  heroLabel,
  heroSubLabel,
  onCopyLatex,
  copyLatexLoading,
  resumeTemplate,
  onResumeTemplateChange,
  onGenerateCoverLetter,
  coverLetterLoading,
  onGenerateColdMessage,
  coldMessageLoading,
}) => {
  const iterations = Array.isArray(result.iterations) ? result.iterations : [];
  const atsPassThreshold = result.ats_pass_threshold ?? 70;
  const firstIter = iterations[0] || null;
  const beforeAts = firstIter?.ats_score != null ? firstIter.ats_score : null;
  const afterAts = result.ats_result?.final_score ?? 0;

  const hireability = result.hireability_analysis || null;
  const hireEval = hireability?.hireability_evaluation || null;
  const hireScore = hireEval?.hireability_score ?? null;
  const shortlistDecision =
    hireability?.final_recommendation?.shortlist_decision || "N/A";
  const decisionStyle = getDecisionStyle(shortlistDecision);

  const atsResult = result.ats_result || {};
  const atsAnalysis = result.ats_analysis || {};
  const finalVerdict = result.final_verdict || {};
  const finalRecommendation = hireability?.final_recommendation || {};
  const contextualGuidance = result.contextual_alignment_guidance || null;
  const contextualSummary = contextualGuidance?.rewrite_strategy_summary || "";

  const [showFullJobDescription, setShowFullJobDescription] = useState(false);
  const [expandedIterations, setExpandedIterations] = useState([]);

  const jobDescription = result.job_description || "";
  const shouldTruncateJD =
    jobDescription.length > 500 && !showFullJobDescription;
  const jdPreview = shouldTruncateJD
    ? jobDescription.slice(0, 500) + "…"
    : jobDescription;

  const toggleIterationExpanded = (iterationNumber) => {
    setExpandedIterations((prev) =>
      prev.includes(iterationNumber)
        ? prev.filter((n) => n !== iterationNumber)
        : [...prev, iterationNumber],
    );
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard!");
  };

  const initialResumeJson = result.initial_resume_json || null;
  const updatedResumeJson = result.resume_json || null;

  const improvementsSummary = Array.isArray(result.improvements_summary)
    ? result.improvements_summary
    : [];

  const issueByImprovedText = new Map();
  improvementsSummary.forEach((imp) => {
    const improved = (imp?.improved || "").trim();
    if (!improved) return;
    if (!issueByImprovedText.has(improved)) {
      issueByImprovedText.set(improved, imp.issue || "");
    }
  });

  const highlightDiffs = [];
  if (
    initialResumeJson?.resume?.sections &&
    updatedResumeJson?.resume?.sections
  ) {
    const initialSections = initialResumeJson.resume.sections;
    const updatedSections = updatedResumeJson.resume.sections;

    const initialExp = initialSections.experience?.items || [];
    const updatedExp = updatedSections.experience?.items || [];
    const expLen = Math.max(initialExp.length, updatedExp.length);
    for (let i = 0; i < expLen; i++) {
      const beforeItem = initialExp[i];
      const afterItem = updatedExp[i];
      if (!beforeItem || !afterItem) continue;
      const beforeHighlights = beforeItem.highlights || [];
      const afterHighlights = afterItem.highlights || [];
      const hLen = Math.max(beforeHighlights.length, afterHighlights.length);
      for (let h = 0; h < hLen; h++) {
        const beforeText = beforeHighlights[h];
        const afterText = afterHighlights[h];
        if (
          typeof beforeText === "string" &&
          typeof afterText === "string" &&
          beforeText !== afterText
        ) {
          const issue =
            issueByImprovedText.get(afterText.trim()) ||
            issueByImprovedText.get(beforeText.trim()) ||
            "";
          highlightDiffs.push({
            id: `experience-${i}-${h}`,
            section: "experience",
            title: afterItem.title || beforeItem.title || "Experience",
            subtitle: afterItem.company || beforeItem.company || "",
            beforeText,
            afterText,
            issue,
          });
        }
      }
    }

    const initialProj = initialSections.projects?.items || [];
    const updatedProj = updatedSections.projects?.items || [];
    const projLen = Math.max(initialProj.length, updatedProj.length);
    for (let i = 0; i < projLen; i++) {
      const beforeItem = initialProj[i];
      const afterItem = updatedProj[i];
      if (!beforeItem || !afterItem) continue;
      const beforeHighlights = beforeItem.highlights || [];
      const afterHighlights = afterItem.highlights || [];
      const hLen = Math.max(beforeHighlights.length, afterHighlights.length);
      for (let h = 0; h < hLen; h++) {
        const beforeText = beforeHighlights[h];
        const afterText = afterHighlights[h];
        if (
          typeof beforeText === "string" &&
          typeof afterText === "string" &&
          beforeText !== afterText
        ) {
          const issue =
            issueByImprovedText.get(afterText.trim()) ||
            issueByImprovedText.get(beforeText.trim()) ||
            "";
          highlightDiffs.push({
            id: `projects-${i}-${h}`,
            section: "projects",
            title: afterItem.name || beforeItem.name || "Project",
            subtitle: "",
            beforeText,
            afterText,
            issue,
          });
        }
      }
    }
  }

  const improvementsCount = iterations.reduce(
    (sum, iter) => sum + (iter?.improvements_made?.length || 0),
    0,
  );
  const hasChanges = highlightDiffs.length > 0 || improvementsCount > 0;
  const computedHeroSubLabel =
    heroSubLabel ||
    (hasChanges
      ? iterations.length > 1
        ? `Your resume is stronger — refined over ${iterations.length} iterations`
        : "Your resume is stronger — here's exactly what changed"
      : iterations.length > 1
        ? "Your resume is already strong — no further changes were needed"
        : "Your resume is already strong — here's the analysis");

  return (
    <div className="space-y-6 stagger-children">
      {/* Hero Card */}
      <Card className="bg-black/40 backdrop-blur-xl border border-white/10">
        <CardContent className="p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <SectionPill>
                  <span className="font-mono">
                    {heroLabel || "Post-Optimization"}
                  </span>
                </SectionPill>
                <SectionPill>
                  <span className="text-zinc-400">Verdict:</span>{" "}
                  <span className={`font-semibold ${decisionStyle.text}`}>
                    {shortlistDecision}
                  </span>
                </SectionPill>
                {iterations.length > 1 && (
                  <Badge
                    variant="outline"
                    className="text-cyan-400 border-cyan-400/30"
                  >
                    <RefreshCw className="w-3 h-3 mr-1" />
                    {iterations.length} iterations
                  </Badge>
                )}
              </div>
              <h2 className="mt-4 text-2xl font-mono font-bold text-white">
                {computedHeroSubLabel}
              </h2>
              <p className="mt-2 text-zinc-400 max-w-3xl text-sm">
                {hasChanges
                  ? "We applied targeted improvements and re-evaluated until your score stabilized. Review the detailed breakdown below."
                  : "Your resume already meets the bar for this job description. Review the detailed breakdown below."}
              </p>
            </div>
            <div className="flex flex-col gap-2 lg:items-end shrink-0">
              {headerExtra}
              <div className="flex items-center gap-2">
                <Select
                  value={resumeTemplate}
                  onValueChange={onResumeTemplateChange}
                >
                  <SelectTrigger className="w-[120px] bg-zinc-900 border-zinc-800 h-9 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1page">1 Page</SelectItem>
                    <SelectItem value="2page">2 Page</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  onClick={onCopyLatex}
                  className="gap-2"
                  disabled={copyLatexLoading}
                >
                  {copyLatexLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <ClipboardList className="w-4 h-4" />
                  )}
                  {copyLatexLoading ? "Generating..." : "Copy LaTeX"}
                </Button>
              </div>
              <Button
                variant="outline"
                onClick={onGenerateCoverLetter}
                className="gap-2"
                disabled={coverLetterLoading}
              >
                {coverLetterLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <FileDown className="w-4 h-4" />
                )}
                {coverLetterLoading ? "Generating..." : "Cover Letter PDF"}
              </Button>
              <Button
                variant="outline"
                onClick={onGenerateColdMessage}
                className="gap-2"
                disabled={coldMessageLoading}
              >
                {coldMessageLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <MessageSquare className="w-4 h-4" />
                )}
                {coldMessageLoading ? "Generating..." : "Cold Message"}
              </Button>
            </div>
          </div>

          <Separator className="my-6 bg-white/10" />

          {jobDescription && (
            <Card className="bg-zinc-900/40 border-zinc-800 mb-4">
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs uppercase tracking-wider text-zinc-500">
                    Job Description
                  </p>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={() => setShowFullJobDescription((prev) => !prev)}
                  >
                    {showFullJobDescription ? "Show less" : "Show more details"}
                  </Button>
                </div>
                {showFullJobDescription ? (
                  <ScrollArea className="h-40 rounded border border-white/5 bg-black/30 px-3 py-2">
                    <p className="text-xs text-zinc-300 whitespace-pre-wrap">
                      {jobDescription}
                    </p>
                  </ScrollArea>
                ) : (
                  <p className="text-xs text-zinc-400">{jdPreview}</p>
                )}
              </CardContent>
            </Card>
          )}

          {contextualSummary && (
            <Card className="bg-zinc-900/40 border-zinc-800 mb-4">
              <CardContent className="p-4 space-y-2">
                <p className="text-xs uppercase tracking-wider text-zinc-500">
                  Role Alignment Guidance
                </p>
                <p className="text-xs text-zinc-300 whitespace-pre-wrap leading-relaxed">
                  {contextualSummary}
                </p>
              </CardContent>
            </Card>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <ScoreDeltaCard
              label="ATS Score"
              before={beforeAts}
              after={afterAts}
              accent="green"
              helper="Deterministic score computed from gap analysis."
            />
            <ScoreDeltaCard
              label="Hireability Score"
              before={null}
              after={hireScore ?? 0}
              accent="violet"
              helper={
                hireability
                  ? "LLM-assessed probability of interview call."
                  : "Hireability analysis was not available for this run."
              }
            />
            <Card className="bg-zinc-900/50 border-zinc-800">
              <CardContent className="p-5">
                <p className="text-xs uppercase tracking-wider text-zinc-500">
                  Shortlist Decision
                </p>
                <div className="mt-2">
                  <Badge
                    className={`text-lg font-mono font-bold px-3 py-1 ${decisionStyle.bg} ${decisionStyle.text} ${decisionStyle.border} border`}
                  >
                    {shortlistDecision}
                  </Badge>
                </div>
                <p className="mt-3 text-sm text-zinc-400">
                  {hireEval
                    ? "Driven by hireability evaluation signals rather than raw ATS math."
                    : "Hireability analysis not available."}
                </p>
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>

      {/* Updated Profile Snapshot */}
      <Card className="bg-black/40 backdrop-blur-xl border border-white/10">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle className="text-lg font-mono">
                Updated Profile Snapshot
              </CardTitle>
              <p className="text-sm text-zinc-400 mt-1">
                A structured view of your resume after optimization.
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {isEdited && (
                <Badge
                  variant="outline"
                  className="border-amber-500/40 text-amber-400 text-xs font-normal"
                >
                  Edited
                </Badge>
              )}
              <Button
                variant="outline"
                size="sm"
                className="gap-2 border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:text-white"
                onClick={onOpenJsonEditor}
              >
                <Pencil className="w-4 h-4" />
                Edit JSON
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <ProfileSnapshot resumeJson={getCurrentResumeJson()} />
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          {/* ATS Breakdown */}
          <ATSBreakdownPanel atsResult={atsResult} />
        </div>
        {/* Right column */}
        <div className="lg:col-span-1 space-y-4">
          {/* Skills Gap */}
          <SkillsGapPanel atsAnalysis={atsAnalysis} />

          {/* Download CTA */}
          {/* <Card className="bg-emerald-500/5 border border-emerald-500/20">
            <CardContent className="p-5">
              <h4 className="text-white font-semibold">
                Ready to use your improved resume?
              </h4>
              <p className="text-sm text-zinc-300 mt-1">
                Copy the optimized LaTeX output to paste in Overleaf.
              </p>
              <div className="mt-4 flex flex-col gap-2">
                <Button
                  variant="outline"
                  onClick={onCopyLatex}
                  className="gap-2"
                  disabled={copyLatexLoading}
                >
                  {copyLatexLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Code className="w-4 h-4" />
                  )}
                  {copyLatexLoading ? "Generating..." : "Copy LaTeX"}
                </Button>
                <Button
                  variant="outline"
                  onClick={() =>
                    copyToClipboard(result.original_resume_text || "")
                  }
                  className="gap-2"
                >
                  <FileText className="w-4 h-4" />
                  Copy Resume Text
                </Button>
              </div>
            </CardContent>
          </Card> */}
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column */}
        <div className="lg:col-span-3 space-y-4">
          {/* Hireability Analysis Detail */}
          {hireability && (
            <Card className="bg-zinc-900/50 border-zinc-800">
              <CardContent className="p-6 space-y-4">
                <h3 className="font-mono font-semibold text-white flex items-center gap-2">
                  <Target className="w-5 h-5 text-violet-400" />
                  Hireability Analysis
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="rounded-lg border border-white/10 bg-black/30 p-4">
                    <p className="text-xs uppercase tracking-wider text-zinc-500">
                      Hireability Score
                    </p>
                    <div className="mt-2 flex items-center gap-3">
                      <span
                        className={`font-mono text-3xl font-bold ${getScoreColor(hireScore || 0)}`}
                      >
                        {hireScore ?? "—"}%
                      </span>
                      <Progress
                        value={hireScore || 0}
                        className="h-2 bg-zinc-800 flex-1"
                      />
                    </div>
                  </div>
                  <div className="rounded-lg border border-white/10 bg-black/30 p-4">
                    <p className="text-xs uppercase tracking-wider text-zinc-500">
                      Shortlist Decision
                    </p>
                    <Badge
                      className={`mt-2 text-sm font-semibold px-3 py-1 ${decisionStyle.bg} ${decisionStyle.text} ${decisionStyle.border} border`}
                    >
                      {shortlistDecision}
                    </Badge>
                  </div>
                  {hireEval && (
                    <div className="rounded-lg border border-white/10 bg-black/30 p-4 space-y-2">
                      <p className="text-xs uppercase tracking-wider text-zinc-500">
                        Signals
                      </p>
                      <div className="flex flex-wrap gap-1.5 text-[11px]">
                        <span
                          className={`inline-flex items-center rounded-full border px-2.5 py-0.5 font-mono ${getSignalChipStyle(
                            hireEval.technical_signal_strength,
                          )}`}
                        >
                          <span className="mr-1 text-zinc-400">Tech</span>
                          {hireEval.technical_signal_strength || "—"}
                        </span>
                        <span
                          className={`inline-flex items-center rounded-full border px-2.5 py-0.5 font-mono ${getSignalChipStyle(
                            hireEval.ownership_signal,
                          )}`}
                        >
                          <span className="mr-1 text-zinc-400">Owner</span>
                          {hireEval.ownership_signal || "—"}
                        </span>
                        <span
                          className={`inline-flex items-center rounded-full border px-2.5 py-0.5 font-mono ${getSignalChipStyle(
                            hireEval.impact_visibility,
                          )}`}
                        >
                          <span className="mr-1 text-zinc-400">Impact</span>
                          {hireEval.impact_visibility || "—"}
                        </span>
                        <span
                          className={`inline-flex items-center rounded-full border px-2.5 py-0.5 font-mono ${getSignalChipStyle(
                            hireEval.interview_readiness,
                          )}`}
                        >
                          <span className="mr-1 text-zinc-400">Ready</span>
                          {hireEval.interview_readiness || "—"}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {Object.keys(finalVerdict).length > 0 && (
                  <div className="rounded-lg border border-cyan-400/20 bg-cyan-500/5 p-4">
                    <p className="text-xs uppercase tracking-wider text-cyan-200/80 mb-2">
                      Final Verdict
                    </p>
                    <div className="space-y-1 text-sm text-zinc-200 leading-relaxed">
                      <p className="font-mono text-xs text-cyan-200">
                        {finalVerdict.shortlist_decision || "—"}
                      </p>
                      <p className="text-zinc-200 mt-1">
                        {finalVerdict.reason || "No reason provided."}
                      </p>
                    </div>
                  </div>
                )}

                {Object.keys(finalRecommendation).length > 0 &&
                  Object.keys(finalVerdict).length === 0 && (
                    <div className="rounded-lg border border-cyan-400/20 bg-cyan-500/5 p-4">
                      <p className="text-xs uppercase tracking-wider text-cyan-200/80 mb-3">
                        Final Recommendation
                      </p>
                      <div className="space-y-2 text-sm text-zinc-200 leading-relaxed">
                        <p className="font-mono text-xs text-cyan-200">
                          {finalRecommendation.shortlist_decision || "—"}
                        </p>
                        <p className="mt-1">
                          {finalRecommendation.reason || "No reason provided."}
                        </p>
                      </div>
                    </div>
                  )}
              </CardContent>
            </Card>
          )}
          {/* Highlight-level Changes */}
          {highlightDiffs.length > 0 && (
            <Card className="bg-zinc-900/60 border-zinc-800">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg font-mono flex items-center gap-2">
                  <History className="w-4 h-4 text-emerald-400" />
                  Updated Highlights
                </CardTitle>
                <p className="text-sm text-zinc-400">
                  Suggested rewrites of key bullets, with expandable
                  before/after view.
                </p>
              </CardHeader>
              <CardContent className="space-y-3">
                <Accordion
                  type="single"
                  collapsible
                  className="w-full space-y-2"
                >
                  {highlightDiffs.map((diff) => (
                    <AccordionItem
                      key={diff.id}
                      value={diff.id}
                      className="border border-white/10 rounded-lg bg-black/40 px-3"
                    >
                      <AccordionTrigger className="py-3 hover:no-underline">
                        <div className="flex flex-col items-start gap-1 text-left w-full">
                          <div className="flex items-center gap-2">
                            <Badge
                              variant="outline"
                              className="text-[10px] uppercase tracking-wider border-emerald-500/40 text-emerald-300"
                            >
                              {diff.section}
                            </Badge>
                            <span className="text-xs text-zinc-400">
                              {diff.title}
                              {diff.subtitle ? ` • ${diff.subtitle}` : ""}
                            </span>
                          </div>
                          <p className="text-sm font-medium text-white">
                            {diff.issue || diff.afterText}
                          </p>
                          {diff.issue && (
                            <p className="text-xs text-zinc-400 line-clamp-1">
                              {diff.afterText}
                            </p>
                          )}
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="pb-4 pt-1">
                        {diff.issue && (
                          <div className="mb-3 rounded-md border border-amber-500/40 bg-amber-500/10 p-2">
                            <p className="text-[10px] uppercase tracking-wider text-amber-300">
                              Issue Addressed
                            </p>
                            <p className="mt-1 text-xs text-amber-100">
                              {diff.issue}
                            </p>
                          </div>
                        )}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                          <div className="rounded-lg bg-red-950/40 border border-red-500/40 p-3">
                            <div className="flex items-center justify-between mb-2">
                              <p className="text-[10px] uppercase tracking-wider text-red-300">
                                Before
                              </p>
                              <Badge
                                variant="outline"
                                className="text-[9px] border-red-500/60 text-red-200"
                              >
                                old
                              </Badge>
                            </div>
                            <p className="font-mono text-[11px] text-red-100 whitespace-pre-wrap">
                              {diff.beforeText}
                            </p>
                          </div>
                          <div className="rounded-lg bg-emerald-950/40 border border-emerald-500/40 p-3">
                            <div className="flex items-center justify-between mb-2">
                              <p className="text-[10px] uppercase tracking-wider text-emerald-300">
                                After
                              </p>
                              <Badge
                                variant="outline"
                                className="text-[9px] border-emerald-500/60 text-emerald-200"
                              >
                                improved
                              </Badge>
                            </div>
                            <p className="font-mono text-[11px] text-emerald-100 whitespace-pre-wrap">
                              {diff.afterText}
                            </p>
                          </div>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Score Progression */}
      {iterations.length > 1 && (
        <Card className="bg-gradient-to-b from-zinc-900/80 to-black border border-zinc-800">
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h3 className="font-mono font-semibold text-white flex items-center gap-2">
                  <RefreshCw className="w-4 h-4 text-cyan-400" />
                  Score Progression
                </h3>
                <p className="text-sm text-zinc-400 mt-1">
                  How your ATS score evolved across optimization iterations.
                </p>
              </div>
              <Badge
                variant="outline"
                className="text-cyan-300 border-cyan-400/30 font-mono"
              >
                {iterations.length} iterations
              </Badge>
            </div>

            {/* Mini timeline */}
            <div className="mt-2">
              <div className="relative flex items-center justify-between gap-3">
                <div className="absolute left-4 right-4 h-px bg-gradient-to-r from-zinc-700 via-cyan-500/60 to-zinc-700 opacity-60" />
                {iterations.map((iter, i) => (
                  <div
                    key={`dot-${iter.iteration}-${i}`}
                    className="relative flex flex-col items-center gap-1"
                  >
                    <div
                      className={`flex items-center justify-center rounded-full border-2 w-7 h-7 text-[11px] font-mono ${
                        iter.ats_score >= atsPassThreshold
                          ? "bg-emerald-500/20 border-emerald-400 text-emerald-200"
                          : "bg-zinc-900 border-zinc-500 text-zinc-200"
                      }`}
                    >
                      {iter.iteration}
                    </div>
                    <span className="font-mono text-[11px] text-zinc-400">
                      {iter.ats_score}%
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Detailed rows */}
            <div className="mt-4 space-y-3">
              {iterations.map((iter, i) => (
                <div
                  key={i}
                  className={`rounded-lg border p-3 bg-black/40 ${
                    iter.ats_score >= atsPassThreshold
                      ? "border-emerald-500/40"
                      : "border-zinc-700"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div
                        className={`flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-mono ${
                          iter.ats_score >= atsPassThreshold
                            ? "bg-emerald-500/15 text-emerald-200 border-emerald-500/40"
                            : "bg-zinc-900 text-zinc-200 border-zinc-700"
                        }`}
                      >
                        <span>Iter {iter.iteration}</span>
                        <span className="font-bold">{iter.ats_score}%</span>
                        {iter.ats_score >= atsPassThreshold && (
                          <CheckCircle className="w-3 h-3" />
                        )}
                      </div>
                      {i > 0 && (
                        <span className="text-xs font-mono text-zinc-400">
                          Δ{" "}
                          {formatDelta(
                            iter.ats_score - iterations[i - 1].ats_score,
                          )}
                          pt
                        </span>
                      )}
                    </div>
                    {iter.improvements_made?.length > 0 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-[11px] text-zinc-300"
                        onClick={() => toggleIterationExpanded(iter.iteration)}
                      >
                        {expandedIterations.includes(iter.iteration)
                          ? "Hide changes"
                          : "Show changes"}
                      </Button>
                    )}
                  </div>
                  {iter.improvements_made?.length > 0 &&
                    expandedIterations.includes(iter.iteration) && (
                      <ul className="mt-2 space-y-1 ml-1">
                        {iter.improvements_made.map((imp, j) => (
                          <li
                            key={j}
                            className="text-xs text-zinc-400 flex items-start gap-2"
                          >
                            <ChevronRight className="w-3 h-3 mt-0.5 text-cyan-400 shrink-0" />
                            <span>{imp}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

/* ─── Evaluate Page ──────────────────────────────────────────── */

const EvaluatePage = ({ user, onUserUpdate }) => {
  const [inputMode, setInputMode] = useState("pdf");
  const [resumeText, setResumeText] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [jobDescription, setJobDescription] = useState("");
  const [targetRole, setTargetRole] = useState("Software Engineer");
  const [formattingPref, setFormattingPref] = useState("standard");
  const [resumeTemplate, setResumeTemplate] = useState("1page");
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("");
  const [loadingStage, setLoadingStage] = useState(0);
  const [result, setResult] = useState(null);
  const [copyLatexLoading, setCopyLatexLoading] = useState(false);
  const [coverLetterLoading, setCoverLetterLoading] = useState(false);
  const [coldMessageLoading, setColdMessageLoading] = useState(false);
  const [coldMessageOpen, setColdMessageOpen] = useState(false);
  const [coldMessageText, setColdMessageText] = useState("");
  const [editedResumeJson, setEditedResumeJson] = useState(null);
  const [jsonEditorOpen, setJsonEditorOpen] = useState(false);
  const [jsonEditorDraft, setJsonEditorDraft] = useState("");
  const [jsonEditorError, setJsonEditorError] = useState(null);
  const [jsonEditorSaving, setJsonEditorSaving] = useState(false);
  const [savingBasics, setSavingBasics] = useState(false);
  const [basicsForm, setBasicsForm] = useState({
    name: "",
    phone: "",
    email: "",
    links: [
      { label: "LinkedIn", url: "" },
      { label: "GitHub", url: "" },
    ],
  });
  const [atsPassThresholdHint, setAtsPassThresholdHint] = useState(70);

  const getCurrentResumeJson = () => editedResumeJson ?? result?.resume_json;
  const needsBasics = !user?.profile?.basics;

  useEffect(() => {
    if (!user) return;
    const basics = user.profile?.basics;
    setBasicsForm({
      name: basics?.name || user.name || "",
      phone: basics?.phone || "",
      email: basics?.email || user.email || "",
      links: basics?.links?.length
        ? basics.links
        : [
            { label: "LinkedIn", url: "" },
            { label: "GitHub", url: "" },
          ],
    });
  }, [user]);

  useEffect(() => {
    let cancelled = false;
    axios
      .get(`${API}/templates`)
      .then((res) => {
        const t = res.data?.ats_pass_threshold;
        if (!cancelled && typeof t === "number" && t >= 0 && t <= 100) {
          setAtsPassThresholdHint(t);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const handleEvaluate = async () => {
    if (!user) {
      toast.error("Please sign in to evaluate your resume");
      return;
    }
    if (needsBasics) {
      toast.error("Please complete your basics profile first");
      return;
    }
    if (inputMode === "text" && !resumeText.trim()) {
      toast.error("Please enter your resume text");
      return;
    }
    if (inputMode === "pdf" && !selectedFile) {
      toast.error("Please upload a PDF file");
      return;
    }
    if (!jobDescription.trim()) {
      toast.error("Please enter the job description");
      return;
    }

    setLoading(true);
    setLoadingStage(0);
    setResult(null);
    setEditedResumeJson(null);

    try {
      let response;
      if (inputMode === "text") {
        setLoadingMessage("Formatting resume & analyzing job description...");
        response = await axios.post(`${API}/evaluate/text`, {
          resume_text: resumeText,
          job_description: jobDescription,
          target_role: targetRole,
          formatting_preference: formattingPref,
        });
      } else {
        setLoadingMessage("Extracting PDF and running evaluation pipeline...");
        const formData = new FormData();
        formData.append("file", selectedFile);
        formData.append("job_description", jobDescription);
        formData.append("target_role", targetRole);
        formData.append("formatting_preference", formattingPref);
        response = await axios.post(`${API}/evaluate/pdf`, formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });
      }

      setResult(response.data);

      const iters = response.data.iterations?.length || 1;
      const score = response.data.ats_result?.final_score || 0;
      toast.success(
        `Evaluation complete! ATS: ${score}%${iters > 1 ? ` (${iters} iterations)` : ""}`,
      );
    } catch (error) {
      console.error("Evaluation error:", error);
      toast.error(
        error.response?.data?.detail || "Evaluation failed. Please try again.",
      );
    } finally {
      setLoading(false);
      setLoadingMessage("");
    }
  };

  const saveBasicsProfile = async () => {
    if (
      !basicsForm.name.trim() ||
      !basicsForm.email.trim() ||
      !basicsForm.phone.trim()
    ) {
      toast.error("Name, phone, and email are required");
      return;
    }
    const links = basicsForm.links || [];
    if (links.length === 0) {
      toast.error("At least one link is required");
      return;
    }
    const hasIncompleteLink = links.some(
      (l) => !String(l.label || "").trim() || !String(l.url || "").trim(),
    );
    if (hasIncompleteLink) {
      toast.error("All onboarding link fields are mandatory");
      return;
    }
    try {
      setSavingBasics(true);
      const payload = {
        basics: {
          ...basicsForm,
          links,
        },
      };
      const response = await axios.put(`${API}/user/profile/basics`, payload);
      onUserUpdate?.(response.data.user);
      toast.success("Profile basics saved");
    } catch (error) {
      toast.error(
        error.response?.data?.detail || "Failed to save basics profile",
      );
    } finally {
      setSavingBasics(false);
    }
  };

  useEffect(() => {
    if (!loading) return;
    setLoadingStage(0);
    const t1 = setTimeout(() => setLoadingStage(1), 5000);
    const t2 = setTimeout(() => setLoadingStage(2), 10000);
    const t3 = setTimeout(() => setLoadingStage(3), 40000);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [loading]);

  const handleCopyLatex = async () => {
    if (!result?.id) return;
    const currentJson = getCurrentResumeJson();
    if (!currentJson) {
      toast.error("No resume data to generate LaTeX");
      return;
    }
    const cacheKey = computeLatexCacheKey(
      user?.id,
      result.id,
      currentJson,
      resumeTemplate,
    );
    const cachedLatex = getLatexFromCache(cacheKey);
    if (cachedLatex) {
      try {
        await navigator.clipboard.writeText(cachedLatex);
        toast.success("LaTeX code copied to clipboard!");
      } catch {
        toast.error("Failed to copy LaTeX to clipboard");
      }
      return;
    }
    try {
      setCopyLatexLoading(true);
      const response = await axios.post(`${API}/evaluate/${result.id}/latex`, {
        resume_json: currentJson,
        template: resumeTemplate,
      });
      if (response.data.latex_code) {
        setLatexInCache(cacheKey, response.data.latex_code);
        navigator.clipboard.writeText(response.data.latex_code);
        toast.success("LaTeX code copied to clipboard!");
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to generate LaTeX");
    } finally {
      setCopyLatexLoading(false);
    }
  };

  const handleGenerateCoverLetter = async () => {
    if (!result?.id) return;
    const currentJson = getCurrentResumeJson();
    if (!currentJson) {
      toast.error("No resume data to generate cover letter");
      return;
    }
    const jd = result.job_description || "";
    const role = result.target_role || "Software Engineer";
    const clCacheKey = computeCoverLetterCacheKey(
      user?.id,
      result.id,
      currentJson,
      jd,
      role,
    );
    const cachedCl = getJsonFromSessionCache(clCacheKey);
    if (cachedCl) {
      const basics = currentJson?.resume?.basics || null;
      generateCoverLetterPdf(cachedCl, basics, {
        companyName: result.company_name || "",
        targetRole: role,
      });
      toast.success("Cover letter PDF downloaded!");
      return;
    }
    try {
      setCoverLetterLoading(true);
      const response = await axios.post(
        `${API}/evaluate/${result.id}/cover-letter`,
        {
          resume_json: currentJson,
          job_description: jd,
          target_role: role,
        },
      );
      const clData = response.data?.cover_letter;
      if (clData) {
        setJsonInSessionCache(clCacheKey, clData);
        const basics = currentJson?.resume?.basics || null;
        generateCoverLetterPdf(clData, basics, {
          companyName: result.company_name || "",
          targetRole: role,
        });
        toast.success("Cover letter PDF downloaded!");
      } else {
        toast.error("No cover letter data returned");
      }
    } catch (error) {
      toast.error(
        error.response?.data?.detail || "Failed to generate cover letter",
      );
    } finally {
      setCoverLetterLoading(false);
    }
  };

  const handleGenerateColdMessage = async () => {
    if (!result?.id) return;
    const currentJson = getCurrentResumeJson();
    if (!currentJson) {
      toast.error("No resume data to generate cold message");
      return;
    }
    const jd = result.job_description || "";
    const role = result.target_role || "Software Engineer";
    const cmCacheKey = computeColdMessageCacheKey(
      user?.id,
      result.id,
      currentJson,
      jd,
      role,
    );
    const cachedCm = getJsonFromSessionCache(cmCacheKey);
    if (cachedCm?.message_text) {
      setColdMessageText(cachedCm.message_text);
      setColdMessageOpen(true);
      return;
    }
    try {
      setColdMessageLoading(true);
      const response = await axios.post(
        `${API}/evaluate/${result.id}/cold-message`,
        {
          resume_json: currentJson,
          job_description: jd,
          target_role: role,
        },
      );
      const cmData = response.data?.cold_message;
      if (cmData?.message_text) {
        setJsonInSessionCache(cmCacheKey, cmData);
        setColdMessageText(cmData.message_text);
        setColdMessageOpen(true);
      } else {
        toast.error("No cold message data returned");
      }
    } catch (error) {
      toast.error(
        error.response?.data?.detail || "Failed to generate cold message",
      );
    } finally {
      setColdMessageLoading(false);
    }
  };

  const applyJsonEditor = async () => {
    setJsonEditorError(null);
    try {
      const parsed = JSON.parse(jsonEditorDraft);
      if (typeof parsed !== "object" || parsed === null) {
        setJsonEditorError("JSON must be an object");
        return;
      }
      if (!result?.id) {
        setEditedResumeJson(parsed);
        setJsonEditorOpen(false);
        toast.success("Profile snapshot updated");
        return;
      }
      setJsonEditorSaving(true);
      await axios.patch(`${API}/evaluation/${result.id}/resume_json`, {
        resume_json: parsed,
      });
      setResult((prev) => (prev ? { ...prev, resume_json: parsed } : null));
      setEditedResumeJson(null);
      setJsonEditorOpen(false);
      clearResumeGenerationCacheForEval(user?.id, result.id);
      toast.success("Profile snapshot updated and saved");
    } catch (e) {
      if (e.response?.status !== undefined) {
        toast.error(e.response?.data?.detail || "Failed to save to database");
      } else {
        setJsonEditorError(e.message || "Invalid JSON");
      }
    } finally {
      setJsonEditorSaving(false);
    }
  };

  const resetJsonEditor = () => {
    setJsonEditorDraft(JSON.stringify(result?.resume_json ?? {}, null, 2));
    setEditedResumeJson(null);
    setJsonEditorError(null);
    if (result?.id) clearResumeGenerationCacheForEval(user?.id, result.id);
    toast.success("Reset to original JSON");
  };

  return (
    <div className="min-h-screen bg-[#09090b] pt-20">
      <Dialog open={!!user && needsBasics} modal>
        <DialogContent
          className="sm:max-w-xl bg-zinc-900 border-zinc-800"
          showCloseButton={false}
        >
          <DialogHeader>
            <DialogTitle>Complete your profile basics</DialogTitle>
            <DialogDescription>
              Add your basics once before using evaluations.
            </DialogDescription>
            <p className="text-xs text-zinc-400">
              All basics fields are mandatory, including every link label and
              URL.
            </p>
          </DialogHeader>
          <div className="space-y-3">
            <input
              className="w-full rounded-md bg-zinc-950 border border-zinc-700 px-3 py-2 text-sm"
              placeholder="Full name"
              value={basicsForm.name}
              onChange={(e) =>
                setBasicsForm((p) => ({ ...p, name: e.target.value }))
              }
            />
            <input
              className="w-full rounded-md bg-zinc-950 border border-zinc-700 px-3 py-2 text-sm"
              placeholder="Phone number"
              value={basicsForm.phone}
              onChange={(e) =>
                setBasicsForm((p) => ({ ...p, phone: e.target.value }))
              }
            />
            <input
              className="w-full rounded-md bg-zinc-950 border border-zinc-700 px-3 py-2 text-sm"
              placeholder="Email address"
              value={basicsForm.email}
              onChange={(e) =>
                setBasicsForm((p) => ({ ...p, email: e.target.value }))
              }
            />
            <div className="flex items-center justify-between pt-1">
              <p className="text-xs text-zinc-400">Links</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  setBasicsForm((p) => ({
                    ...p,
                    links: [...(p.links || []), { label: "", url: "" }],
                  }))
                }
              >
                Add Link
              </Button>
            </div>
            {(basicsForm.links || []).map((link, i) => (
              <div
                key={i}
                className="grid grid-cols-[1fr_1fr_auto] gap-2 items-center"
              >
                <input
                  className="rounded-md bg-zinc-950 border border-zinc-700 px-3 py-2 text-sm"
                  placeholder="Label"
                  value={link.label || ""}
                  onChange={(e) =>
                    setBasicsForm((p) => ({
                      ...p,
                      links: p.links.map((v, idx) =>
                        idx === i ? { ...v, label: e.target.value } : v,
                      ),
                    }))
                  }
                />
                <input
                  className="rounded-md bg-zinc-950 border border-zinc-700 px-3 py-2 text-sm"
                  placeholder="URL"
                  value={link.url || ""}
                  onChange={(e) =>
                    setBasicsForm((p) => ({
                      ...p,
                      links: p.links.map((v, idx) =>
                        idx === i ? { ...v, url: e.target.value } : v,
                      ),
                    }))
                  }
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    setBasicsForm((p) => ({
                      ...p,
                      links: p.links.filter((_, idx) => idx !== i),
                    }))
                  }
                >
                  Remove
                </Button>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button onClick={saveBasicsProfile} disabled={savingBasics}>
              {savingBasics ? "Saving..." : "Save Basics"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <JsonEditorDialog
        open={jsonEditorOpen}
        onOpenChange={setJsonEditorOpen}
        draft={jsonEditorDraft}
        setDraft={(v) => {
          setJsonEditorDraft(v);
          setJsonEditorError(null);
        }}
        error={jsonEditorError}
        saving={jsonEditorSaving}
        onApply={applyJsonEditor}
        onReset={resetJsonEditor}
      />

      <div className="max-w-7xl mx-auto px-6 py-8">
        {loading ? (
          <LoadingCard message={loadingMessage} stage={loadingStage} />
        ) : !result ? (
          /* ──── Input Form ──── */
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="space-y-6">
              <div>
                <h1 className="text-3xl font-mono font-bold text-white mb-2">
                  Resume Evaluator
                </h1>
                <p className="text-zinc-400">AI-powered resume analysis</p>
              </div>

              <Tabs
                value={inputMode}
                onValueChange={setInputMode}
                className="w-full"
              >
                <TabsList className="grid w-full grid-cols-2 bg-zinc-900">
                  <TabsTrigger value="pdf" className="gap-2">
                    <Upload className="w-4 h-4" />
                    PDF
                  </TabsTrigger>
                  <TabsTrigger value="text" className="gap-2">
                    <FileText className="w-4 h-4" />
                    Text
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="text" className="mt-4">
                  <Textarea
                    placeholder="Paste your resume text here..."
                    value={resumeText}
                    onChange={(e) => setResumeText(e.target.value)}
                    className="min-h-[300px] bg-zinc-900 border-zinc-800 focus:border-blue-500 resize-none font-mono text-sm"
                  />
                </TabsContent>
                <TabsContent value="pdf" className="mt-4">
                  <FileUploadZone
                    onFileSelect={setSelectedFile}
                    selectedFile={selectedFile}
                  />
                </TabsContent>
              </Tabs>

              <div className="mt-4 rounded-lg border border-zinc-800 bg-zinc-900/30 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-3">
                  How to use
                </p>
                <div className="space-y-2">
                  {[
                    {
                      icon: LogIn,
                      text: "Login",
                      highlighted: !user,
                    },
                    {
                      icon: Upload,
                      text: "Upload PDF or paste the text of your resume",
                    },
                    { icon: ClipboardList, text: "Paste the job description" },
                    {
                      icon: Settings,
                      text: "Select the target role and formatting",
                    },
                    { icon: Play, text: "Run the resume evaluation" },
                  ].map((step, i) => (
                    <div
                      key={i}
                      className={
                        step.highlighted
                          ? "flex items-center gap-3 rounded-md border border-blue-500/50 bg-blue-500/10 px-3 py-2 shadow-[0_0_24px_rgba(59,130,246,0.12)] cursor-default"
                          : "flex items-center gap-3 rounded-md px-3 py-2 transition-colors hover:bg-zinc-800/60 group cursor-default"
                      }
                    >
                      <span
                        className={
                          step.highlighted
                            ? "flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white text-xs font-bold"
                            : "flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-500/10 text-blue-400 text-xs font-bold group-hover:bg-blue-500/20 transition-colors"
                        }
                      >
                        {i + 1}
                      </span>
                      <step.icon
                        className={
                          step.highlighted
                            ? "w-4 h-4 shrink-0 text-blue-300"
                            : "w-4 h-4 shrink-0 text-zinc-500 group-hover:text-blue-400 transition-colors"
                        }
                      />
                      <span
                        className={
                          step.highlighted
                            ? "text-sm font-medium text-white"
                            : "text-sm text-zinc-400 group-hover:text-zinc-200 transition-colors"
                        }
                      >
                        {step.text}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <Card className="bg-zinc-900/50 border-zinc-800">
                <CardHeader>
                  <CardTitle className="text-lg font-mono">
                    Job Description
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Textarea
                    placeholder="Paste the job description here..."
                    value={jobDescription}
                    onChange={(e) => setJobDescription(e.target.value)}
                    className="min-h-[150px] bg-zinc-900 border-zinc-800 focus:border-blue-500 resize-none text-sm"
                  />
                </CardContent>
              </Card>

              <Card className="bg-zinc-900/50 border-zinc-800">
                <CardHeader>
                  <CardTitle className="text-lg font-mono">Settings</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-3">
                      <label className="text-sm text-zinc-400">
                        Target Role
                      </label>
                      <Select value={targetRole} onValueChange={setTargetRole}>
                        <SelectTrigger className="bg-zinc-900 border-zinc-800">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Software Engineer">
                            Software Engineer
                          </SelectItem>
                          <SelectItem value="Backend Engineer">
                            Backend Engineer
                          </SelectItem>
                          <SelectItem value="Frontend Engineer">
                            Frontend Engineer
                          </SelectItem>
                          <SelectItem value="Data Engineer">
                            Data Engineer
                          </SelectItem>
                          <SelectItem value="ML Engineer">
                            ML Engineer
                          </SelectItem>
                          <SelectItem value="Data Scientist">
                            Data Scientist
                          </SelectItem>
                          <SelectItem value="DevOps Engineer">
                            DevOps Engineer
                          </SelectItem>
                          <SelectItem value="Security Analyst">
                            Security Analyst
                          </SelectItem>
                          <SelectItem value="AI Engineer">
                            AI Engineer
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-3">
                      <label className="text-sm text-zinc-400">
                        Formatting
                      </label>
                      <Select
                        value={formattingPref}
                        onValueChange={setFormattingPref}
                      >
                        <SelectTrigger className="bg-zinc-900 border-zinc-800">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="standard">Standard</SelectItem>
                          <SelectItem value="star" disabled>
                            STAR Format (coming soon)
                          </SelectItem>
                          <SelectItem value="metrics-heavy" disabled>
                            Metrics Heavy (coming soon)
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {/* <div className="space-y-2">
                      <label className="text-sm text-zinc-400">
                        Resume Template
                      </label>
                      <Select
                        value={resumeTemplate}
                        onValueChange={setResumeTemplate}
                      >
                        <SelectTrigger className="bg-zinc-900 border-zinc-800">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1page">1 Page</SelectItem>
                          <SelectItem value="2page">2 Page</SelectItem>
                        </SelectContent>
                      </Select>
                    </div> */}
                  </div>
                </CardContent>
              </Card>

              <Button
                onClick={handleEvaluate}
                disabled={
                  loading ||
                  !jobDescription.trim() ||
                  (inputMode === "pdf" ? !selectedFile : !resumeText.trim())
                }
                className="w-full h-14 text-lg font-semibold bg-blue-600 hover:bg-blue-700 shadow-[0_0_20px_rgba(59,130,246,0.4)]"
              >
                <span className="flex items-center gap-2">
                  <Zap className="w-5 h-5" />
                  Evaluate Resume
                </span>
              </Button>

              <div className="flex items-start gap-2 text-xs text-zinc-500 bg-zinc-900/50 p-3 rounded-lg border border-zinc-800">
                <RefreshCw className="w-4 h-4 mt-0.5 text-cyan-400 shrink-0" />
                <span>
                  <strong className="text-zinc-400">Auto-Optimization:</strong>{" "}
                  The AI will iteratively improve your resume until it achieves
                  an ATS score of {atsPassThresholdHint}% or higher (max 3
                  iterations).
                </span>
              </div>
            </div>
          </div>
        ) : (
          /* ──── Results Dashboard ──── */
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-mono font-bold text-white">
                  Evaluation Results
                </h1>
                <p className="text-zinc-400 mt-1">
                  Target: {result.target_role}
                </p>
              </div>
              <Button variant="outline" onClick={() => setResult(null)}>
                <Zap className="w-4 h-4 mr-2" />
                New Evaluation
              </Button>
            </div>

            <ResultsDashboard
              result={result}
              getCurrentResumeJson={getCurrentResumeJson}
              isEdited={!!editedResumeJson}
              onOpenJsonEditor={() => {
                setJsonEditorError(null);
                setJsonEditorDraft(
                  JSON.stringify(getCurrentResumeJson(), null, 2),
                );
                setJsonEditorOpen(true);
              }}
              onCopyLatex={handleCopyLatex}
              copyLatexLoading={copyLatexLoading}
              resumeTemplate={resumeTemplate}
              onResumeTemplateChange={setResumeTemplate}
              onGenerateCoverLetter={handleGenerateCoverLetter}
              coverLetterLoading={coverLetterLoading}
              onGenerateColdMessage={handleGenerateColdMessage}
              coldMessageLoading={coldMessageLoading}
            />
          </div>
        )}

        <Dialog open={coldMessageOpen} onOpenChange={setColdMessageOpen}>
          <DialogContent className="sm:max-w-lg bg-zinc-900 border-zinc-800">
            <DialogHeader>
              <DialogTitle>LinkedIn Cold Message</DialogTitle>
              <DialogDescription>
                Edit the message below or copy it to your clipboard.
              </DialogDescription>
            </DialogHeader>
            <Textarea
              value={coldMessageText}
              onChange={(e) => setColdMessageText(e.target.value)}
              className="min-h-[300px] bg-zinc-950 border-zinc-700 text-zinc-100 font-mono text-sm"
            />
            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                variant="outline"
                onClick={() => {
                  navigator.clipboard.writeText(coldMessageText);
                  toast.success("Copied to clipboard!");
                }}
                className="gap-2"
              >
                <Copy className="w-4 h-4" />
                Copy
              </Button>
              <Button
                variant="secondary"
                onClick={() => setColdMessageOpen(false)}
              >
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

/* ─── History Page ───────────────────────────────────────────── */

const HistoryPage = ({ user }) => {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedEvaluation, setSelectedEvaluation] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [copyLatexLoading, setCopyLatexLoading] = useState(false);
  const [resumeTemplate, setResumeTemplate] = useState("1page");
  const [coverLetterLoading, setCoverLetterLoading] = useState(false);
  const [coldMessageLoading, setColdMessageLoading] = useState(false);
  const [coldMessageOpen, setColdMessageOpen] = useState(false);
  const [coldMessageText, setColdMessageText] = useState("");
  const [editedByEvalId, setEditedByEvalId] = useState({});
  const [jsonEditorOpen, setJsonEditorOpen] = useState(false);
  const [jsonEditorDraft, setJsonEditorDraft] = useState("");
  const [jsonEditorError, setJsonEditorError] = useState(null);
  const [jsonEditorSaving, setJsonEditorSaving] = useState(false);
  const navigate = useNavigate();

  const getCurrentResumeJson = () => {
    if (!selectedEvaluation?.id) return null;
    return (
      editedByEvalId[selectedEvaluation.id] ?? selectedEvaluation.resume_json
    );
  };

  const fetchHistory = async () => {
    try {
      const response = await axios.get(`${API}/history`);
      setHistory(response.data);
    } catch (error) {
      toast.error("Failed to load history");
    } finally {
      setLoading(false);
    }
  };

  const loadEvaluation = async (id) => {
    try {
      setLoadingDetail(true);
      const response = await axios.get(`${API}/evaluation/${id}`);
      setSelectedEvaluation(response.data);
    } catch (error) {
      toast.error("Failed to load evaluation");
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleCopyLatex = async () => {
    if (!selectedEvaluation?.id) return;
    const currentJson = getCurrentResumeJson();
    if (!currentJson) {
      toast.error("No resume data to generate LaTeX");
      return;
    }
    const cacheKey = computeLatexCacheKey(
      user?.id,
      selectedEvaluation.id,
      currentJson,
      resumeTemplate,
    );
    const cachedLatex = getLatexFromCache(cacheKey);
    if (cachedLatex) {
      try {
        await navigator.clipboard.writeText(cachedLatex);
        toast.success("LaTeX code copied to clipboard!");
      } catch {
        toast.error("Failed to copy LaTeX to clipboard");
      }
      return;
    }
    try {
      setCopyLatexLoading(true);
      const response = await axios.post(
        `${API}/evaluate/${selectedEvaluation.id}/latex`,
        { resume_json: currentJson, template: resumeTemplate },
      );
      if (response.data?.latex_code) {
        setLatexInCache(cacheKey, response.data.latex_code);
        navigator.clipboard.writeText(response.data.latex_code);
        toast.success("LaTeX code copied to clipboard!");
      } else {
        toast.error("No LaTeX available to copy");
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to generate LaTeX");
    } finally {
      setCopyLatexLoading(false);
    }
  };

  const handleGenerateCoverLetter = async () => {
    if (!selectedEvaluation?.id) return;
    const currentJson = getCurrentResumeJson();
    if (!currentJson) {
      toast.error("No resume data to generate cover letter");
      return;
    }
    const jd = selectedEvaluation.job_description || "";
    const role = selectedEvaluation.target_role || "Software Engineer";
    const clCacheKey = computeCoverLetterCacheKey(
      user?.id,
      selectedEvaluation.id,
      currentJson,
      jd,
      role,
    );
    const cachedCl = getJsonFromSessionCache(clCacheKey);
    if (cachedCl) {
      const basics = currentJson?.resume?.basics || null;
      generateCoverLetterPdf(cachedCl, basics, {
        companyName: selectedEvaluation.company_name || "",
        targetRole: role,
      });
      toast.success("Cover letter PDF downloaded!");
      return;
    }
    try {
      setCoverLetterLoading(true);
      const response = await axios.post(
        `${API}/evaluate/${selectedEvaluation.id}/cover-letter`,
        {
          resume_json: currentJson,
          job_description: jd,
          target_role: role,
        },
      );
      const clData = response.data?.cover_letter;
      if (clData) {
        setJsonInSessionCache(clCacheKey, clData);
        const basics = currentJson?.resume?.basics || null;
        generateCoverLetterPdf(clData, basics, {
          companyName: selectedEvaluation.company_name || "",
          targetRole: role,
        });
        toast.success("Cover letter PDF downloaded!");
      } else {
        toast.error("No cover letter data returned");
      }
    } catch (error) {
      toast.error(
        error.response?.data?.detail || "Failed to generate cover letter",
      );
    } finally {
      setCoverLetterLoading(false);
    }
  };

  const handleGenerateColdMessage = async () => {
    if (!selectedEvaluation?.id) return;
    const currentJson = getCurrentResumeJson();
    if (!currentJson) {
      toast.error("No resume data to generate cold message");
      return;
    }
    const jd = selectedEvaluation.job_description || "";
    const role = selectedEvaluation.target_role || "Software Engineer";
    const cmCacheKey = computeColdMessageCacheKey(
      user?.id,
      selectedEvaluation.id,
      currentJson,
      jd,
      role,
    );
    const cachedCm = getJsonFromSessionCache(cmCacheKey);
    if (cachedCm?.message_text) {
      setColdMessageText(cachedCm.message_text);
      setColdMessageOpen(true);
      return;
    }
    try {
      setColdMessageLoading(true);
      const response = await axios.post(
        `${API}/evaluate/${selectedEvaluation.id}/cold-message`,
        {
          resume_json: currentJson,
          job_description: jd,
          target_role: role,
        },
      );
      const cmData = response.data?.cold_message;
      if (cmData?.message_text) {
        setJsonInSessionCache(cmCacheKey, cmData);
        setColdMessageText(cmData.message_text);
        setColdMessageOpen(true);
      } else {
        toast.error("No cold message data returned");
      }
    } catch (error) {
      toast.error(
        error.response?.data?.detail || "Failed to generate cold message",
      );
    } finally {
      setColdMessageLoading(false);
    }
  };

  const applyHistoryJsonEditor = async () => {
    if (!selectedEvaluation?.id) return;
    setJsonEditorError(null);
    try {
      const parsed = JSON.parse(jsonEditorDraft);
      if (typeof parsed !== "object" || parsed === null) {
        setJsonEditorError("JSON must be an object");
        return;
      }
      setJsonEditorSaving(true);
      await axios.patch(
        `${API}/evaluation/${selectedEvaluation.id}/resume_json`,
        { resume_json: parsed },
      );
      setSelectedEvaluation((prev) =>
        prev ? { ...prev, resume_json: parsed } : null,
      );
      setEditedByEvalId((prev) => {
        const next = { ...prev };
        delete next[selectedEvaluation.id];
        return next;
      });
      setJsonEditorOpen(false);
      clearResumeGenerationCacheForEval(user?.id, selectedEvaluation.id);
      toast.success("Profile snapshot updated and saved");
    } catch (e) {
      if (e.response?.status !== undefined) {
        toast.error(e.response?.data?.detail || "Failed to save to database");
      } else {
        setJsonEditorError(e.message || "Invalid JSON");
      }
    } finally {
      setJsonEditorSaving(false);
    }
  };

  const resetHistoryJsonEditor = () => {
    if (!selectedEvaluation?.id) return;
    setEditedByEvalId((prev) => {
      const next = { ...prev };
      delete next[selectedEvaluation.id];
      return next;
    });
    setJsonEditorDraft(
      JSON.stringify(selectedEvaluation?.resume_json ?? {}, null, 2),
    );
    setJsonEditorError(null);
    clearResumeGenerationCacheForEval(user?.id, selectedEvaluation.id);
    toast.success("Reset to original JSON");
  };

  const deleteEvaluation = async (id, e) => {
    e.stopPropagation();
    try {
      await axios.delete(`${API}/evaluation/${id}`);
      toast.success("Evaluation deleted");
      setEditedByEvalId((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      fetchHistory();
      if (selectedEvaluation?.id === id) {
        setSelectedEvaluation(null);
      }
    } catch (error) {
      toast.error("Failed to delete evaluation");
    }
  };

  useEffect(() => {
    if (user) fetchHistory();
  }, [user]);

  if (!user) {
    return (
      <div className="min-h-screen bg-[#09090b] pt-28">
        <div className="max-w-2xl mx-auto px-6">
          <Card className="bg-zinc-900/50 border-zinc-800">
            <CardContent className="p-8 text-center text-zinc-300">
              Please sign in to view your history.
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#09090b] pt-20">
      <JsonEditorDialog
        open={jsonEditorOpen}
        onOpenChange={setJsonEditorOpen}
        draft={jsonEditorDraft}
        setDraft={(v) => {
          setJsonEditorDraft(v);
          setJsonEditorError(null);
        }}
        error={jsonEditorError}
        saving={jsonEditorSaving}
        onApply={applyHistoryJsonEditor}
        onReset={resetHistoryJsonEditor}
      />

      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-mono font-bold text-white">
              Evaluation History
            </h1>
            <p className="text-zinc-400 mt-1">
              View and manage your past resume evaluations
            </p>
          </div>
          <Button onClick={() => navigate("/")} className="gap-2">
            <Zap className="w-4 h-4" />
            New Evaluation
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* History List */}
          <div className="lg:col-span-1">
            <Card className="bg-zinc-900/50 border-zinc-800">
              <CardHeader>
                <CardTitle className="text-lg">Past Evaluations</CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="w-6 h-6 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
                  </div>
                ) : history.length === 0 ? (
                  <div className="text-center py-8">
                    <History className="w-12 h-12 mx-auto text-zinc-600 mb-3" />
                    <p className="text-zinc-400">No evaluations yet</p>
                    <Button
                      variant="link"
                      onClick={() => navigate("/")}
                      className="mt-2"
                    >
                      Evaluate your first resume
                    </Button>
                  </div>
                ) : (
                  <ScrollArea className="h-[500px] w-full">
                    <div className="space-y-2 pr-3">
                      {history.map((item) => {
                        const itemDecision = getDecisionStyle(
                          item.interview_probability,
                        );
                        return (
                          <div
                            key={item.id}
                            onClick={() => loadEvaluation(item.id)}
                            className={`p-3 rounded-lg cursor-pointer transition-colors ${
                              selectedEvaluation?.id === item.id
                                ? "bg-blue-500/20 border border-blue-500/50"
                                : "bg-zinc-800/50 hover:bg-zinc-800 border border-transparent"
                            }`}
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-medium text-white text-sm">
                                {item.target_role}
                              </span>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0 text-zinc-500 hover:text-red-400"
                                onClick={(e) => deleteEvaluation(item.id, e)}
                              >
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-zinc-500">
                              <span>ATS: {item.ats_score}%</span>
                              <span>•</span>
                              <span>
                                Hire: {item.hireability_score ?? "—"}%
                              </span>
                              <span>•</span>
                              <Badge
                                variant="outline"
                                className={`text-xs ${itemDecision.text} ${itemDecision.border}`}
                              >
                                {item.interview_probability}
                              </Badge>
                            </div>
                            <p className="text-xs text-zinc-600 mt-1">
                              {new Date(item.timestamp).toLocaleString()}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Detail View */}
          <div className="lg:col-span-2">
            {loadingDetail ? (
              <DetailSkeleton />
            ) : selectedEvaluation ? (
              <ResultsDashboard
                result={selectedEvaluation}
                getCurrentResumeJson={getCurrentResumeJson}
                isEdited={!!editedByEvalId[selectedEvaluation.id]}
                onOpenJsonEditor={() => {
                  setJsonEditorError(null);
                  setJsonEditorDraft(
                    JSON.stringify(getCurrentResumeJson(), null, 2),
                  );
                  setJsonEditorOpen(true);
                }}
                heroLabel="Past Evaluation"
                heroSubLabel={selectedEvaluation.target_role}
                onCopyLatex={handleCopyLatex}
                copyLatexLoading={copyLatexLoading}
                resumeTemplate={resumeTemplate}
                onResumeTemplateChange={setResumeTemplate}
                onGenerateCoverLetter={handleGenerateCoverLetter}
                coverLetterLoading={coverLetterLoading}
                onGenerateColdMessage={handleGenerateColdMessage}
                coldMessageLoading={coldMessageLoading}
              />
            ) : (
              <Card className="bg-zinc-900/50 border-zinc-800">
                <CardContent className="p-12 text-center">
                  <FileText className="w-16 h-16 mx-auto text-zinc-600 mb-4" />
                  <p className="text-zinc-400 text-lg">
                    Select an evaluation to view details
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        <Dialog open={coldMessageOpen} onOpenChange={setColdMessageOpen}>
          <DialogContent className="sm:max-w-lg bg-zinc-900 border-zinc-800">
            <DialogHeader>
              <DialogTitle>LinkedIn Cold Message</DialogTitle>
              <DialogDescription>
                Edit the message below or copy it to your clipboard.
              </DialogDescription>
            </DialogHeader>
            <Textarea
              value={coldMessageText}
              onChange={(e) => setColdMessageText(e.target.value)}
              className="min-h-[300px] bg-zinc-950 border-zinc-700 text-zinc-100 font-mono text-sm"
            />
            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                variant="outline"
                onClick={() => {
                  navigator.clipboard.writeText(coldMessageText);
                  toast.success("Copied to clipboard!");
                }}
                className="gap-2"
              >
                <Copy className="w-4 h-4" />
                Copy
              </Button>
              <Button
                variant="secondary"
                onClick={() => setColdMessageOpen(false)}
              >
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

const AuthCallbackPage = ({ onAuthSuccess }) => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const hasExchangedRef = useRef(false);

  useEffect(() => {
    if (hasExchangedRef.current) return;
    hasExchangedRef.current = true;

    const code = searchParams.get("code");
    if (!code) {
      toast.error("OAuth code missing");
      navigate("/");
      return;
    }
    const run = async () => {
      try {
        const response = await axios.get(`${API}/auth/google/callback`, {
          params: { code },
        });
        onAuthSuccess(response.data.access_token, response.data.user);
        toast.success("Logged in successfully");
        navigate("/");
      } catch (error) {
        toast.error(error.response?.data?.detail || "OAuth login failed");
        navigate("/");
      }
    };
    run();
  }, [searchParams, navigate, onAuthSuccess]);

  return (
    <div className="min-h-screen bg-[#09090b] pt-28">
      <div className="max-w-2xl mx-auto px-6 text-zinc-300">
        Completing sign-in...
      </div>
    </div>
  );
};

const AdminPage = ({ user }) => {
  const [users, setUsers] = useState([]);
  const [period, setPeriod] = useState("week");
  const [summary, setSummary] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingUserId, setEditingUserId] = useState(null);
  const [editRole, setEditRole] = useState("user");
  const [editActive, setEditActive] = useState(true);
  const [editLimit, setEditLimit] = useState(50);
  const periodTargets = { day: 10, week: 50, month: 100 };

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API}/admin/users`);
      setUsers(response.data.users || []);
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to load users");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchSummary = useCallback(async (selectedPeriod) => {
    try {
      const response = await axios.get(`${API}/admin/evaluations/summary`, {
        params: { period: selectedPeriod },
      });
      setSummary(response.data.users || []);
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to load chart data");
    }
  }, []);

  const openEditor = (u) => {
    setEditingUserId(u.id);
    setEditRole(u.role || "user");
    setEditActive(!!u.is_active);
    setEditLimit(Number(u.quota?.evaluation_limit ?? 50));
  };

  const saveUserEdits = async () => {
    if (!editingUserId) return;
    if (!Number.isFinite(editLimit) || editLimit < 0) {
      toast.error("Evaluation limit must be a non-negative number");
      return;
    }
    try {
      await axios.patch(`${API}/admin/users/${editingUserId}`, {
        role: editRole,
        is_active: editActive,
        evaluation_limit: Number(editLimit),
      });
      toast.success("User updated");
      setEditingUserId(null);
      await fetchUsers();
      await fetchSummary(period);
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to update user");
    }
  };

  useEffect(() => {
    if (user?.role === "admin") {
      fetchUsers();
      fetchSummary(period);
    }
  }, [user, fetchUsers, fetchSummary, period]);

  if (!user) return <Navigate to="/" replace />;
  if (user.role !== "admin") {
    return (
      <div className="min-h-screen bg-[#09090b] pt-28">
        <div className="max-w-2xl mx-auto px-6">
          <Card className="bg-zinc-900/50 border-zinc-800">
            <CardContent className="p-8 text-center text-zinc-300">
              Admin access required.
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#09090b] pt-20">
      <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">
        <h1 className="text-3xl font-mono font-bold text-white">
          Admin Dashboard
        </h1>
        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardHeader>
            <CardTitle>Users</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-zinc-400">Loading...</p>
            ) : (
              <div className="space-y-3">
                {users.map((u) => (
                  <div
                    key={u.id}
                    className="rounded border border-zinc-800 p-3 flex items-center justify-between gap-3"
                  >
                    <div>
                      <p className="text-white font-medium">
                        {u.name} ({u.email})
                      </p>
                      <p className="text-xs text-zinc-400">
                        role: {u.role} | limit:{" "}
                        {u.quota?.evaluation_limit ?? 50} | status:{" "}
                        {u.is_active ? "active" : "inactive"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openEditor(u)}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={async () => {
                          if (
                            !window.confirm(
                              `Delete user ${u.email}? This cannot be undone.`,
                            )
                          )
                            return;
                          await axios.delete(`${API}/admin/users/${u.id}`);
                          toast.success("User deleted");
                          fetchUsers();
                          fetchSummary(period);
                        }}
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        {editingUserId && (
          <Card className="bg-zinc-900/50 border-zinc-800">
            <CardHeader>
              <CardTitle>Edit User</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <p className="text-xs text-zinc-400 mb-1">Role</p>
                <select
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value)}
                  className="w-full rounded-md bg-zinc-950 border border-zinc-700 px-3 py-2 text-sm"
                >
                  <option value="user">user</option>
                  <option value="admin">admin</option>
                </select>
              </div>
              <div>
                <p className="text-xs text-zinc-400 mb-1">Evaluation Limit</p>
                <input
                  type="number"
                  min="0"
                  value={editLimit}
                  onChange={(e) => setEditLimit(Number(e.target.value))}
                  className="w-full rounded-md bg-zinc-950 border border-zinc-700 px-3 py-2 text-sm"
                />
              </div>
              <div className="flex items-end gap-2">
                <label className="text-sm text-zinc-300 flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={editActive}
                    onChange={(e) => setEditActive(e.target.checked)}
                  />
                  Active
                </label>
              </div>
              <div className="md:col-span-3 flex justify-end gap-2 mt-2">
                <Button variant="ghost" onClick={() => setEditingUserId(null)}>
                  Cancel
                </Button>
                <Button onClick={saveUserEdits}>Save Changes</Button>
              </div>
            </CardContent>
          </Card>
        )}
        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <CardTitle>Evaluations by User</CardTitle>
              <Select value={period} onValueChange={setPeriod}>
                <SelectTrigger className="w-36 bg-zinc-950 border-zinc-700">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="day">Today</SelectItem>
                  <SelectItem value="week">This Week</SelectItem>
                  <SelectItem value="month">This Month</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <p className="text-xs text-zinc-400">
              Progress target: {periodTargets[period]} evaluations per user.
            </p>
          </CardHeader>
          <CardContent className="space-y-2">
            {summary.length === 0 ? (
              <p className="text-zinc-500">No users found.</p>
            ) : (
              (() => {
                const target = periodTargets[period] || 100;
                return summary.map((row) => {
                  const count = Number(row.count || 0);
                  const usagePct = target > 0 ? (count / target) * 100 : 0;
                  const widthPct = Math.max(
                    2,
                    Math.min(100, Math.round(usagePct)),
                  );
                  const isHighUsage = usagePct > 80;
                  return (
                    <div key={row.user_id} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-zinc-300">
                          {row.name || row.email}
                        </span>
                        <span
                          className={
                            isHighUsage ? "text-red-400" : "text-zinc-400"
                          }
                        >
                          {count}/{target}
                        </span>
                      </div>
                      <div className="h-2 rounded bg-zinc-800 overflow-hidden">
                        <div
                          className={`h-2 rounded ${isHighUsage ? "bg-red-500" : "bg-blue-500"}`}
                          style={{ width: `${widthPct}%` }}
                        />
                      </div>
                    </div>
                  );
                });
              })()
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

const ProfilePage = ({ user, onUserUpdate, onLogout }) => {
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    links: [
      { label: "LinkedIn", url: "" },
      { label: "GitHub", url: "" },
    ],
  });

  useEffect(() => {
    if (!user) return;
    const basics = user.profile?.basics;
    setForm({
      name: basics?.name || user.name || "",
      phone: basics?.phone || "",
      email: basics?.email || user.email || "",
      links: basics?.links?.length
        ? basics.links
        : [
            { label: "LinkedIn", url: "" },
            { label: "GitHub", url: "" },
          ],
    });
  }, [user]);

  if (!user) return <Navigate to="/" replace />;

  const saveProfile = async () => {
    if (!form.name.trim() || !form.phone.trim() || !form.email.trim()) {
      toast.error("Name, phone, and email are required");
      return;
    }
    try {
      setSaving(true);
      const response = await axios.put(`${API}/user/profile/basics`, {
        basics: {
          ...form,
          links: (form.links || []).filter(
            (l) => l.label?.trim() || l.url?.trim(),
          ),
        },
      });
      onUserUpdate?.(response.data.user);
      toast.success("Profile updated");
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#09090b] pt-20">
      <div className="max-w-3xl mx-auto px-6 py-8 space-y-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-mono font-bold text-white">Profile</h1>
            <p className="text-zinc-400 mt-1">
              Manage your contact details and resume basics.
            </p>
          </div>
          <Button variant="outline" onClick={() => navigate("/")}>
            Back to Evaluate
          </Button>
        </div>

        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardHeader>
            <CardTitle>Edit Your Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <input
              className="w-full rounded-md bg-zinc-950 border border-zinc-700 px-3 py-2 text-sm"
              placeholder="Full name"
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
            />
            <input
              className="w-full rounded-md bg-zinc-950 border border-zinc-700 px-3 py-2 text-sm"
              placeholder="Phone number"
              value={form.phone}
              onChange={(e) =>
                setForm((p) => ({ ...p, phone: e.target.value }))
              }
            />
            <input
              className="w-full rounded-md bg-zinc-950 border border-zinc-700 px-3 py-2 text-sm"
              placeholder="Email address"
              value={form.email}
              onChange={(e) =>
                setForm((p) => ({ ...p, email: e.target.value }))
              }
            />
            <div className="flex items-center justify-between pt-2">
              <p className="text-xs text-zinc-400">Links</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  setForm((p) => ({
                    ...p,
                    links: [...(p.links || []), { label: "", url: "" }],
                  }))
                }
              >
                Add Link
              </Button>
            </div>
            {(form.links || []).map((link, i) => (
              <div
                key={i}
                className="grid grid-cols-[1fr_1fr_auto] gap-2 items-center"
              >
                <input
                  className="rounded-md bg-zinc-950 border border-zinc-700 px-3 py-2 text-sm"
                  placeholder="Label"
                  value={link.label || ""}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      links: p.links.map((v, idx) =>
                        idx === i ? { ...v, label: e.target.value } : v,
                      ),
                    }))
                  }
                />
                <input
                  className="rounded-md bg-zinc-950 border border-zinc-700 px-3 py-2 text-sm"
                  placeholder="URL"
                  value={link.url || ""}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      links: p.links.map((v, idx) =>
                        idx === i ? { ...v, url: e.target.value } : v,
                      ),
                    }))
                  }
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    setForm((p) => ({
                      ...p,
                      links: p.links.filter((_, idx) => idx !== i),
                    }))
                  }
                >
                  Remove
                </Button>
              </div>
            ))}
            <div className="pt-3 flex justify-between gap-2">
              <Button variant="destructive" onClick={onLogout}>
                Logout
              </Button>
              <Button onClick={saveProfile} disabled={saving}>
                {saving ? "Saving..." : "Save Profile"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

/* ─── Demo Resumes Page ───────────────────────────────────────── */

const DemoResumesPage = () => {
  const demoResumes = [
    {
      id: "demo-1",
      label: "Full profile with publications",
      resume: {
        basics: {
          name: "Alex Demo",
          email: "alex.demo@example.com",
          phone: "+1-555-0100",
          summary:
            "Senior software engineer with 8+ years of experience shipping production systems across cloud, data, and AI workloads.",
          links: [
            { label: "LinkedIn", url: "https://linkedin.com/in/demo" },
            { label: "GitHub", url: "https://github.com/demo" },
          ],
        },
        sections: {
          technical_skills: {
            categories: [
              { name: "Languages", items: ["Python", "TypeScript", "Go"] },
              { name: "Cloud", items: ["AWS", "GCP"] },
            ],
          },
          experience: {
            items: [
              {
                title: "Senior Software Engineer",
                company: "DemoCorp",
                start_date: "2019-01",
                end_date: "Present",
                highlights: [
                  "Led migration of monolith to microservices on Kubernetes.",
                  "Improved API latency p95 by 40% through caching and query optimization.",
                ],
              },
            ],
          },
          projects: {
            items: [
              {
                name: "Resume Optimizer",
                tech_stack: ["React", "FastAPI", "PostgreSQL"],
                highlights: [
                  "Built an end‑to‑end ATS optimization tool used by 1k+ users.",
                ],
              },
            ],
          },
          publications: {
            items: [
              {
                title: "Improving ATS Matching with Structured Resume Data",
                publisher_or_venue: "DemoConf",
                date: "2025-05",
                topics: ["ATS", "NLP"],
                link: "https://example.com/demo-paper",
              },
            ],
          },
          certifications: {
            items: [
              {
                title: "AWS Certified Solutions Architect",
                organization: "Amazon Web Services",
                date: "2023",
              },
            ],
          },
          recognitions: {
            items: [
              {
                title: "Top Performer Award",
                organization: "DemoCorp",
                date: "2024",
              },
            ],
          },
          education: {
            degrees: [
              {
                institution: "Demo University",
                degree: "B.S. Computer Science",
                start_date: "2012",
                end_date: "2016",
              },
            ],
          },
        },
      },
    },
    {
      id: "demo-2",
      label: "No publications",
      resume: {
        basics: {
          name: "Jordan NoPubs",
          email: "jordan.nopubs@example.com",
          phone: "+1-555-0200",
          summary:
            "Backend engineer focused on reliability, observability, and platform tooling.",
          links: [{ label: "GitHub", url: "https://github.com/nopubs" }],
        },
        sections: {
          technical_skills: {
            categories: [
              { name: "Languages", items: ["Java", "Kotlin"] },
              { name: "Infrastructure", items: ["Kubernetes", "Terraform"] },
            ],
          },
          experience: {
            items: [
              {
                title: "Backend Engineer",
                company: "InfraCo",
                start_date: "2020-03",
                end_date: "Present",
                highlights: [
                  "Owned core deployment pipeline with 99.9% success rate.",
                ],
              },
            ],
          },
          projects: {
            items: [
              {
                name: "Observability Platform",
                technologies: ["OpenTelemetry", "Prometheus"],
                highlights: [
                  "Unified tracing and metrics across 50+ microservices.",
                ],
              },
            ],
          },
          publications: {
            items: [],
          },
          education: {
            degrees: [
              {
                institution: "State University",
                degree: "B.Eng. Software Engineering",
                start_date: "2014",
                end_date: "2018",
              },
            ],
          },
        },
      },
    },
    {
      id: "demo-3",
      label: "No technical skills",
      resume: {
        basics: {
          name: "Casey NoSkills",
          email: "casey.noskills@example.com",
          phone: "+1-555-0300",
          summary:
            "Early‑career candidate with strong academic background and research exposure.",
        },
        sections: {
          technical_skills: {
            categories: [],
          },
          experience: {
            items: [],
          },
          projects: {
            items: [],
          },
          publications: {
            items: [
              {
                title: "",
                publisher_or_venue: "",
                date: "",
                topics: [],
                link: "",
              },
            ],
          },
          education: {
            degrees: [
              {
                institution: "Tech Institute",
                degree: "M.S. Data Science",
                start_date: "2023",
                end_date: "2025",
              },
            ],
          },
        },
      },
    },
  ];

  return (
    <div className="min-h-screen bg-[#09090b] pt-20">
      <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-mono font-bold text-white">
              Demo Resumes
            </h1>
            <p className="text-zinc-400 mt-1">
              Explore how the profile snapshot renders different resume shapes
              and edge cases.
            </p>
          </div>
        </div>

        <div className="space-y-6">
          {demoResumes.map((demo) => (
            <Card
              key={demo.id}
              className="bg-zinc-900/60 border-zinc-800 overflow-hidden"
            >
              <CardHeader className="border-b border-white/5 bg-zinc-900/80">
                <CardTitle className="text-base font-mono text-zinc-100">
                  {demo.label}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                <ProfileSnapshot resumeJson={demo} />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
};

/* ─── App Root ───────────────────────────────────────────────── */

function App() {
  const [authToken, setAuthToken] = useState(
    () => localStorage.getItem(TOKEN_KEY) || "",
  );
  const [user, setUser] = useState(null);

  useEffect(() => {
    setAxiosToken(authToken);
  }, [authToken]);

  useEffect(() => {
    const bootstrap = async () => {
      if (!authToken) {
        setUser(null);
        return;
      }
      try {
        const response = await axios.get(`${API}/auth/me`);
        setUser(response.data.user);
      } catch {
        localStorage.removeItem(TOKEN_KEY);
        clearAllResumeGenerationCache();
        setAuthToken("");
        setUser(null);
      }
    };
    bootstrap();
  }, [authToken]);

  const handleAuthSuccess = useCallback(
    (token, authUser) => {
      if (user?.id && user.id !== authUser?.id) {
        clearResumeGenerationCacheForUser(user.id);
      }
      localStorage.setItem(TOKEN_KEY, token);
      setAuthToken(token);
      setUser(authUser);
    },
    [user],
  );

  const startGoogleLogin = useCallback(async () => {
    try {
      const response = await axios.get(`${API}/auth/google/login`);
      window.location.href = response.data.url;
    } catch (error) {
      toast.error(
        error.response?.data?.detail || "Failed to start Google login",
      );
    }
  }, []);

  const logout = useCallback(() => {
    if (user?.id) {
      clearResumeGenerationCacheForUser(user.id);
    } else {
      clearAllResumeGenerationCache();
    }
    localStorage.removeItem(TOKEN_KEY);
    setAuthToken("");
    setUser(null);
  }, [user]);

  return (
    <div className="dark">
      <BrowserRouter>
        <Navigation user={user} onLogin={startGoogleLogin} />
        <Routes>
          <Route
            path="/"
            element={<EvaluatePage user={user} onUserUpdate={setUser} />}
          />
          <Route path="/history" element={<HistoryPage user={user} />} />
          <Route path="/admin" element={<AdminPage user={user} />} />
          <Route path="/demo-resumes" element={<DemoResumesPage />} />
          <Route
            path="/profile"
            element={
              <ProfilePage
                user={user}
                onUserUpdate={setUser}
                onLogout={logout}
              />
            }
          />
          <Route
            path="/auth/callback"
            element={<AuthCallbackPage onAuthSuccess={handleAuthSuccess} />}
          />
          <Route
            path="/api/auth/callback/google"
            element={<AuthCallbackPage onAuthSuccess={handleAuthSuccess} />}
          />
        </Routes>
        <Toaster richColors position="top-right" />
      </BrowserRouter>
    </div>
  );
}

export default App;
