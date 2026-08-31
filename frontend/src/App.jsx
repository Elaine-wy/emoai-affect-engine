import { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  Paper,
  Stack,
  TextField,
  ThemeProvider,
  CssBaseline,
  createTheme,
  Tooltip,
  Typography,
} from "@mui/material";
import AddCommentRoundedIcon from "@mui/icons-material/AddCommentRounded";
import ArrowUpwardRoundedIcon from "@mui/icons-material/ArrowUpwardRounded";
import BugReportRoundedIcon from "@mui/icons-material/BugReportRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import DarkModeRoundedIcon from "@mui/icons-material/DarkModeRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import LightModeRoundedIcon from "@mui/icons-material/LightModeRounded";
import PlayArrowRoundedIcon from "@mui/icons-material/PlayArrowRounded";
import SettingsRoundedIcon from "@mui/icons-material/SettingsRounded";
import SmartToyRoundedIcon from "@mui/icons-material/SmartToyRounded";
import TuneRoundedIcon from "@mui/icons-material/TuneRounded";

const STORAGE_KEY = "emoai-llm-config-v1";
const INITIAL_MESSAGE = {
  role: "assistant",
  content: "测试会话已准备好。你可以直接输入一条消息，右侧会同步显示请求、响应和 affect 调试参数。",
};

function loadConfig() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
  } catch {
    return null;
  }
}

function normalizeBaseUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const withScheme = /^https?:\/\//i.test(raw) ? raw : `http://127.0.0.1:${raw}`;
  return withScheme.replace(/\/+$/, "");
}

function chatUrl(value) {
  const base = normalizeBaseUrl(value);
  if (!base) return "";
  return /\/v1$/i.test(base) ? `${base}/chat/completions` : `${base}/v1/chat/completions`;
}

function compact(value, max = 520) {
  const text = JSON.stringify(value, null, 2);
  return text.length > max ? `${text.slice(0, max)}\n…` : text;
}

function estimateAffect(text) {
  const value = String(text || "");
  const negative = /(失败|错误|不行|担心|生气|失望|糟|bug|fail|error|bad)/i.test(value);
  const positive = /(谢谢|成功|很好|喜欢|开心|完成|great|thanks|good|success)/i.test(value);
  const novelty = /(新|第一次|没见过|意外|surpris|new)/i.test(value);
  return {
    valence_level: negative && !positive ? -1 : positive && !negative ? 1 : 0,
    intensity_level: value.length > 100 ? 2 : value ? 1 : 0,
    primary_event: negative ? "goal_block" : positive ? "reward" : novelty ? "novelty_event" : "ambiguity",
    primary_target: "agent",
    source: "frontend_preview_heuristic",
  };
}

function SettingsDialog({ open, initial, onSave, onClose, canClose }) {
  const [form, setForm] = useState({ baseUrl: initial?.baseUrl || "", model: initial?.model || "", accessKey: initial?.accessKey || "" });
  const [error, setError] = useState("");

  useEffect(() => {
    setForm({ baseUrl: initial?.baseUrl || "", model: initial?.model || "", accessKey: initial?.accessKey || "" });
    setError("");
  }, [initial, open]);

  const update = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));
  const submit = () => {
    if (!form.baseUrl.trim() || !form.model.trim() || !form.accessKey.trim()) {
      setError("请完整填写端口/地址、模型型号和 Access Key");
      return;
    }
    onSave({ baseUrl: form.baseUrl.trim(), model: form.model.trim(), accessKey: form.accessKey.trim() });
  };

  return (
    <Dialog open={open} onClose={canClose ? onClose : undefined} fullWidth maxWidth="xs">
      <DialogTitle sx={{ pb: 1 }}>连接大模型</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          支持 OpenAI-compatible 接口。端口可填 <code>8000</code>，也可填完整地址或带 <code>/v1</code> 的地址。
        </Typography>
        <Stack spacing={1.6}>
          <TextField label="大模型端口 / 地址" placeholder="8000 或 http://127.0.0.1:8000" value={form.baseUrl} onChange={update("baseUrl")} autoFocus />
          <TextField label="模型型号" placeholder="例如 qwen2.5-7b-instruct" value={form.model} onChange={update("model")} />
          <TextField label="ACCESS KEY" type="password" placeholder="sk-..." value={form.accessKey} onChange={update("accessKey")} />
        </Stack>
        {error && <Alert severity="warning" sx={{ mt: 2 }}>{error}</Alert>}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        {canClose && <Button onClick={onClose}>取消</Button>}
        <Button variant="contained" onClick={submit} startIcon={<PlayArrowRoundedIcon />}>保存并继续</Button>
      </DialogActions>
    </Dialog>
  );
}

function MessageBubble({ message }) {
  const isUser = message.role === "user";
  return (
    <Stack direction="row" justifyContent={isUser ? "flex-end" : "flex-start"} className="message-row">
      <Paper className={`message-bubble ${isUser ? "user-bubble" : "assistant-bubble"}`} elevation={0}>
        {!isUser && <Typography className="message-label"><SmartToyRoundedIcon sx={{ fontSize: 15 }} /> Affect Engine</Typography>}
        <Typography component="div" sx={{ whiteSpace: "pre-wrap", lineHeight: 1.65 }}>{message.content}</Typography>
      </Paper>
    </Stack>
  );
}

function DebugPanel({ config, messages, debug }) {
  const requestMessages = messages.filter((item) => item.role !== "system").slice(-6);
  return (
    <Paper className="debug-panel" square elevation={0}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ px: 2, py: 1.6 }}>
        <Stack direction="row" spacing={1} alignItems="center"><BugReportRoundedIcon color="secondary" /><Typography fontWeight={700}>调试参数</Typography></Stack>
      </Stack>
      <Divider />
      <Box className="debug-scroll">
        <Stack spacing={1.4} sx={{ p: 2 }}>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            <Chip size="small" label={debug.loading ? "请求中" : debug.error ? "请求失败" : "就绪"} color={debug.loading ? "warning" : debug.error ? "error" : "success"} />
            <Chip size="small" variant="outlined" label={`Turn ${debug.turn}`} />
            {debug.latency !== null && <Chip size="small" variant="outlined" label={`${debug.latency} ms`} />}
          </Stack>
          <DebugItem label="接口" value={chatUrl(config.baseUrl)} />
          <DebugItem label="模型" value={config.model} />
          <DebugItem label="Access Key" value={config.accessKey ? `${config.accessKey.slice(0, 4)}••••${config.accessKey.slice(-3)}` : "未设置"} />
          <Divider />
          <Typography variant="caption" color="text.secondary">最近 appraisal / affect state</Typography>
          <CodeBlock value={debug.appraisal} />
          {debug.runtime && <CodeBlock value={{ affect_control: debug.runtime.record?.affect_control, emotion_state: debug.runtime.record?.emotion_state, relationship: debug.runtime.record?.state_transition?.relationship_after, memory: debug.runtime.record?.memory_decision }} />}
          <Typography variant="caption" color="text.secondary">请求 messages（最多显示 6 条）</Typography>
          <CodeBlock value={requestMessages} />
          {debug.response && <><Typography variant="caption" color="text.secondary">最近响应摘要</Typography><CodeBlock value={debug.response} /></>}
          {debug.error && <Alert severity="error" variant="outlined">{debug.error}</Alert>}
        </Stack>
      </Box>
    </Paper>
  );
}

function DebugItem({ label, value }) {
  return <Stack direction="row" justifyContent="space-between" spacing={1}><Typography variant="caption" color="text.secondary">{label}</Typography><Typography variant="caption" sx={{ textAlign: "right", wordBreak: "break-all" }}>{value}</Typography></Stack>;
}

function CodeBlock({ value }) {
  return <Box component="pre" className="code-block">{compact(value)}</Box>;
}

function AppContent({ colorMode, toggleColorMode }) {
  const [config, setConfig] = useState(loadConfig);
  const [started, setStarted] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(!config);
  const [confirmClearOpen, setConfirmClearOpen] = useState(false);
  const [messages, setMessages] = useState([INITIAL_MESSAGE]);
  const [input, setInput] = useState("");
  const [debug, setDebug] = useState({ turn: 0, loading: false, error: "", latency: null, appraisal: null, response: null, runtime: null, engineState: null });
  const scrollRef = useRef(null);

  useEffect(() => {
    const node = scrollRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [messages, debug.loading]);

  const requestMessages = useMemo(() => messages.map(({ role, content }) => ({ role, content })), [messages]);
  const saveConfig = (next) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    setConfig(next);
    setSettingsOpen(false);
  };
  const resetChat = () => {
    setMessages([INITIAL_MESSAGE]);
    setInput("");
    setDebug({ turn: 0, loading: false, error: "", latency: null, appraisal: null, response: null, runtime: null, engineState: null });
    setConfirmClearOpen(false);
  };

  const send = async () => {
    const text = input.trim();
    if (!text || !config || debug.loading) return;
    const appraisal = estimateAffect(text);
    const nextMessages = [...messages, { role: "user", content: text }];
    setMessages(nextMessages);
    setInput("");
    setDebug((current) => ({ ...current, turn: current.turn + 1, loading: true, error: "", appraisal, response: null }));
    const startedAt = performance.now();
    try {
      let runtime = null;
      try {
        const runtimeResponse = await fetch("/api/affect", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ conversation_id: "frontend-session", input: text, appraisal, state: debug.engineState }),
        });
        if (runtimeResponse.ok) runtime = await runtimeResponse.json();
      } catch {
        // The static build can still talk to the model without the local Vite bridge.
      }
      setDebug((current) => ({ ...current, runtime, engineState: runtime?.state || current.engineState }));
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: chatUrl(config.baseUrl),
          accessKey: config.accessKey,
          body: { model: config.model, messages: [{ role: "system", content: `你正在参与 EmoAI Affect Lab 测试。保持简洁、自然地回应用户。${runtime?.system_context ? `\n\n${runtime.system_context}` : ""}` }, ...nextMessages], temperature: 0.7, stream: false },
        }),
      });
      const raw = await response.text();
      let data;
      try { data = JSON.parse(raw); } catch { data = { raw }; }
      if (!response.ok) throw new Error(data?.error?.message || data?.message || data?.error || `HTTP ${response.status}`);
      const content = data?.choices?.[0]?.message?.content ?? data?.choices?.[0]?.text ?? data?.output_text ?? data?.raw;
      if (!content) throw new Error("响应中没有找到可显示的文本（需要 choices[0].message.content 等字段）");
      setMessages((current) => [...current, { role: "assistant", content: String(content) }]);
      setDebug((current) => ({ ...current, loading: false, latency: Math.round(performance.now() - startedAt), response: { id: data.id, usage: data.usage, finish_reason: data.choices?.[0]?.finish_reason } }));
    } catch (error) {
      setDebug((current) => ({ ...current, loading: false, latency: Math.round(performance.now() - startedAt), error: error.message || String(error) }));
    }
  };

  if (!started) {
    return <Box className={`launch-screen ${colorMode}`}>
      <SettingsDialog open={settingsOpen} initial={config} onSave={saveConfig} onClose={() => setSettingsOpen(false)} canClose={Boolean(config)} />
      <Paper className="launch-card" elevation={0}>
        <Box className="brand-mark"><TuneRoundedIcon /></Box>
        <Typography variant="h4" fontWeight={800} sx={{ mt: 2 }}>EmoAI Affect Lab</Typography>
        <Typography color="text.secondary" sx={{ mt: 1, maxWidth: 430, textAlign: "center" }}>用于验证情绪状态、关系残留和 LLM 表达的轻量测试工作台。</Typography>
        {config ? <>
          <Stack direction="row" spacing={1} sx={{ mt: 3 }}><Chip label={config.model} color="primary" variant="outlined" /><Chip label={normalizeBaseUrl(config.baseUrl)} variant="outlined" /></Stack>
          <Button variant="contained" size="large" startIcon={<PlayArrowRoundedIcon />} sx={{ mt: 3 }} onClick={() => setStarted(true)}>开始对话</Button>
          <Button size="small" startIcon={<SettingsRoundedIcon />} sx={{ mt: 1 }} onClick={() => setSettingsOpen(true)}>修改连接配置</Button>
        </> : <Typography variant="body2" color="text.secondary" sx={{ mt: 3 }}>请先在弹窗中填写模型连接信息。</Typography>}
      </Paper>
    </Box>;
  }

  return <Box className={`app-shell ${colorMode}`}>
    <Box component="header" className="topbar">
      <Stack direction="row" alignItems="center" spacing={1.2}><Box className="mini-mark"><TuneRoundedIcon sx={{ fontSize: 18 }} /></Box><Box><Typography fontWeight={800} lineHeight={1.1}>EmoAI Affect Lab</Typography><Typography variant="caption" color="text.secondary">LLM 对话测试前端</Typography></Box></Stack>
      <Stack direction="row" spacing={1} alignItems="center"><Chip size="small" label={config.model} color="primary" variant="outlined" /><Tooltip title="清空当前对话"><IconButton onClick={() => setConfirmClearOpen(true)} size="small"><DeleteOutlineRoundedIcon /></IconButton></Tooltip><Tooltip title="连接配置"><IconButton onClick={() => setSettingsOpen(true)} size="small"><SettingsRoundedIcon /></IconButton></Tooltip><Tooltip title={colorMode === "dark" ? "切换浅色模式" : "切换暗色模式"}><IconButton onClick={toggleColorMode} size="small">{colorMode === "dark" ? <LightModeRoundedIcon /> : <DarkModeRoundedIcon />}</IconButton></Tooltip></Stack>
    </Box>
    <Box className="workspace">
      <Box component="main" className="chat-panel">
        <Box ref={scrollRef} className="messages-scroll">{messages.map((message, index) => <MessageBubble key={`${message.role}-${index}`} message={message} />)}{debug.loading && <Stack direction="row" className="message-row"><Paper className="message-bubble assistant-bubble typing" elevation={0}>正在等待模型响应…</Paper></Stack>}</Box>
        <Box className="composer"><TextField fullWidth multiline minRows={1} maxRows={4} placeholder="输入消息，Enter 发送，Shift+Enter 换行" value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); send(); } }} /><IconButton color="primary" className="send-button" onClick={send} disabled={!input.trim() || debug.loading}><ArrowUpwardRoundedIcon /></IconButton></Box>
      </Box>
      <DebugPanel config={config} messages={messages} debug={debug} />
    </Box>
    <SettingsDialog open={settingsOpen} initial={config} onSave={saveConfig} onClose={() => setSettingsOpen(false)} canClose />
    <Dialog open={confirmClearOpen} onClose={() => setConfirmClearOpen(false)} maxWidth="xs" fullWidth>
      <DialogTitle>清空当前对话？</DialogTitle>
      <DialogContent><Typography color="text.secondary">当前消息和右侧调试状态都会被清除，此操作不可恢复。</Typography></DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}><Button onClick={() => setConfirmClearOpen(false)}>取消</Button><Button color="error" variant="contained" onClick={resetChat} startIcon={<DeleteOutlineRoundedIcon />}>确认清空</Button></DialogActions>
    </Dialog>
  </Box>;
}

export default function App() {
  const [colorMode, setColorMode] = useState(() => localStorage.getItem("emoai-color-mode") || (window.matchMedia?.("(prefers-color-scheme: dark)")?.matches ? "dark" : "light"));
  const toggleColorMode = () => setColorMode((current) => {
    const next = current === "dark" ? "light" : "dark";
    localStorage.setItem("emoai-color-mode", next);
    return next;
  });
  const theme = useMemo(() => createTheme({
    palette: { mode: colorMode },
    typography: { fontFamily: 'Inter, "PingFang SC", "Microsoft YaHei", sans-serif' },
    shape: { borderRadius: 10 },
    components: {
      MuiTextField: { defaultProps: { variant: "outlined", size: "small" } },
      MuiButton: { defaultProps: { disableElevation: true } },
    },
  }), [colorMode]);
  return <ThemeProvider theme={theme}><CssBaseline /><AppContent colorMode={colorMode} toggleColorMode={toggleColorMode} /></ThemeProvider>;
}
