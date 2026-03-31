import type { ExtensionAPI } from "@mariozechner/pi-coding-agent"

type MessageLike = {
  role?: string
  content?: Array<{ type?: string; text?: string }>
}

type RunState = {
  originalPrompt: string
  executionLike: boolean
  phase: "normal" | "retry"
  toolUsed: boolean
  lastAssistantText: string
}

const RETRY_CUSTOM_TYPE = "operator-mode-retry"
const RETRY_NOTE = [
  "The previous reply handled an execution-like request without using tools.",
  "Recover by operating on the environment directly.",
  "Do not provide a runbook, advice, or step-by-step instructions.",
  "Inspect the current state, make the required changes, and verify the requested outcome.",
  "If the task specifies literal paths, hosts, ports, or protocols, treat them as part of the spec rather than replacing them with easier shortcuts.",
  "If the task requires a long-running service, keep it running after you finish and prefer proper detached/background-service handling when available.",
]

function getTextContent(message: MessageLike | undefined): string {
  const content = Array.isArray(message?.content) ? message.content : []
  return content
    .filter((part: { type?: string; text?: string }) => part?.type === "text" && typeof part.text === "string")
    .map((part: { type?: string; text?: string }) => part.text as string)
    .filter(Boolean)
    .join("\n\n")
}

export function looksLikeExecutionPrompt(text: string): boolean {
  const normalized = String(text || "").trim()
  if (!normalized) return false

  if (/(how do i|how to|give me instructions|step-by-step|walk me through|what should i do|explain(?:\s+how)?|guide me)/i.test(normalized)) {
    return false
  }

  const imperative = /^(configure|fix|set up|setup|start|run|wire up|deploy|install|make|ensure|get|create|implement|build)\b/i.test(normalized)
  const helpMeExecute = /(can you help me|please help me|help me)\b[\s\S]{0,200}\b(compile|install|build|fix|configure|start|clone|patch)\b/i.test(normalized)
  if (!(imperative || helpMeExecute)) return false

  if (/(pypi|pip install|\bwheel\b|\bsdist\b|setup\.py|pyproject\.toml|python -m build|twine)/i.test(normalized)) {
    return false
  }

  return /(git clone|git push|curl\s+http|ssh\s|port\s+\d+|\/app\/|\/git\/|global python environment|repo|repository|package|source|build from source|task is complete|when you're done|running on port|webserver|server|daemon|service|nginx)/i.test(normalized)
}

export function looksLikeClarifyingReply(text: string): boolean {
  const normalized = String(text || "").trim()
  if (!normalized) return false

  const hasDirectClarifier = /(can you clarify|could you clarify|which repo|which project|which file|what would you like|what exactly|do you want me to|please provide|which environment)/i.test(normalized)
  const endsWithQuestion = /\?\s*$/.test(normalized)
  const looksLikeRunbook = /```|^#|^\d+\.|^[-*]\s|sudo\s|git\s|nginx|systemctl|curl\s+http|chmod\s|cat\s+>|tee\s|hook|webserver|port\s+8080/im.test(normalized)

  if (looksLikeRunbook && normalized.length > 300) {
    return false
  }

  if (hasDirectClarifier) {
    return normalized.length < 600 || !looksLikeRunbook
  }

  return endsWithQuestion && normalized.length < 220 && !looksLikeRunbook
}

function buildRetryMessage(originalPrompt: string): string {
  return `${RETRY_NOTE.join("\n")}\n\nOriginal task:\n${originalPrompt}`
}

export default function operatorModeExtension(pi: ExtensionAPI) {
  const state = globalThis as typeof globalThis & {
    __startupbrosPiOperatorModeLoaded?: boolean
  }
  if (state.__startupbrosPiOperatorModeLoaded) return
  state.__startupbrosPiOperatorModeLoaded = true

  let currentRun: RunState | null = null

  pi.on("input", async (event) => {
    if (event.source === "extension") return { action: "continue" as const }

    currentRun = {
      originalPrompt: event.text,
      executionLike: looksLikeExecutionPrompt(event.text),
      phase: "normal",
      toolUsed: false,
      lastAssistantText: "",
    }

    return { action: "continue" as const }
  })

  pi.on("tool_execution_start", async () => {
    if (currentRun) currentRun.toolUsed = true
  })

  pi.on("message_end", async (event) => {
    if (!currentRun) return

    const message = (event as { message?: MessageLike }).message
    if (message?.role === "assistant") {
      currentRun.lastAssistantText = getTextContent(message)
    }
  })

  pi.on("agent_end", async (_event, ctx) => {
    if (!currentRun) return

    if (
      currentRun.phase === "normal"
      && currentRun.executionLike
      && !currentRun.toolUsed
      && !looksLikeClarifyingReply(currentRun.lastAssistantText)
    ) {
      const retryMessage = buildRetryMessage(currentRun.originalPrompt)

      currentRun = {
        ...currentRun,
        phase: "retry",
        toolUsed: false,
        lastAssistantText: "",
      }

      if (ctx.hasUI) {
        ctx.ui.notify("Operator mode: retrying execution-like prompt after zero-tool answer", "info")
      }

      setTimeout(() => {
        pi.sendMessage({
          customType: RETRY_CUSTOM_TYPE,
          content: retryMessage,
          display: false,
        }, { triggerTurn: true })
      }, 0)
      return
    }

    currentRun = null
  })
}
