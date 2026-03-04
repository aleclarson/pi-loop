import { z } from "zod";

// ---------------------------------------------------------------------------
// Models
// ---------------------------------------------------------------------------

export const Models = {
  Anthropic: {
    Claude37Sonnet: "anthropic/claude-3-7-sonnet-20250219",
    ClaudeSonnet45: "anthropic/claude-sonnet-4-5",
    ClaudeSonnet46: "anthropic/claude-sonnet-4-6",
    ClaudeOpus46: "anthropic/claude-opus-4-6",
  },
  OpenAi: {
    O3Mini: "openai/o3-mini",
    O3Pro: "openai/o3-pro",
    Gpt5Codex: "openai/gpt-5-codex",
    Gpt51Codex: "openai/gpt-5.1-codex",
    Gpt52Codex: "openai/gpt-5.2-codex",
    Gpt53Codex: "openai/gpt-5.3-codex",
  },
} as const;

type _ValueOf<T> = T[keyof T];

/**
 * Loose literal union of all known model identifiers.
 * Retains autocomplete for well-known values while still accepting any string.
 */
export type Model =
  | _ValueOf<typeof Models.Anthropic>
  | _ValueOf<typeof Models.OpenAi>
  | (string & {});

// ---------------------------------------------------------------------------
// Primitive schemas
// ---------------------------------------------------------------------------

const thinkingLevelSchema = z.enum(["off", "minimal", "low", "medium", "high", "xhigh"]);

export type ThinkingLevel = z.infer<typeof thinkingLevelSchema>;

// ---------------------------------------------------------------------------
// CycleContext
// ---------------------------------------------------------------------------

const cycleContextSchema = z.object({
  cycleNumber: z.number(),
  lastSummary: z.string().optional(),
});

export type CycleContext = z.infer<typeof cycleContextSchema>;

// ---------------------------------------------------------------------------
// CycleStrategy
//
// Functions cannot be expressed as first-class zod schemas, so we define the
// shape as a private type and pass it as the generic to z.custom<>. The
// exported CycleStrategy is still derived via z.infer so consumers always get
// the type from the schema rather than from a separate hand-written interface.
// ---------------------------------------------------------------------------

type _CycleStrategyShape = {
  nextPrompt(ctx: CycleContext): string;
};

const cycleStrategySchema = z.custom<_CycleStrategyShape>(
  (val) =>
    typeof val === "object" &&
    val !== null &&
    typeof (val as _CycleStrategyShape).nextPrompt === "function",
  "Strategy must have a nextPrompt method"
);

export type CycleStrategy = z.infer<typeof cycleStrategySchema>;

// ---------------------------------------------------------------------------
// Agent sub-schema
// ---------------------------------------------------------------------------

const agentSchema = z
  .object({
    // Runtime: any non-empty string is valid. Type-level: loose literal union
    // for autocomplete. Cast keeps both without a runtime transform.
    model: z.string().min(1) as z.ZodType<Model>,
    projectDir: z.string().min(1),
    thinkingLevel: thinkingLevelSchema.optional(),
    agentDir: z.string().optional(),
  })
  .passthrough();

export type PiAgentConfig = z.infer<typeof agentSchema>;

// ---------------------------------------------------------------------------
// configSchema (top-level)
// ---------------------------------------------------------------------------

export const configSchema = z
  .object({
    agent: agentSchema,
    strategy: cycleStrategySchema,
    rateLimits: z.object({
      cycleDelay: z.string().min(1),
      maxTokensPerCycle: z.number().int().positive(),
      maxOpsPerMinute: z.number().int().positive(),
      maxCyclesBeforePause: z.number().int().positive().optional(),
    }),
    retries: z
      .object({
        maxAttempts: z.number().int().positive().optional(),
        initialDelayMs: z.number().int().nonnegative().optional(),
        maxDelayMs: z.number().int().positive().optional(),
        backoffFactor: z.number().positive().optional(),
        jitterRatio: z.number().min(0).max(1).optional(),
        retryableErrors: z
          .custom<
            (
              error: unknown,
              context: { cycle: number; attempt: number; maxAttempts: number }
            ) => boolean
          >(
            (val) => val === undefined || typeof val === "function",
            "retries.retryableErrors must be a function"
          )
          .optional(),
      })
      .optional(),
    metrics: z
      .object({
        prometheusPort: z.number().int().positive().optional(),
        enableLogging: z.boolean().default(true),
      })
      .default({ enableLogging: true }),
    systemd: z
      .object({
        restartSec: z.number().int().positive().optional(),
        nice: z.number().int().optional(),
        user: z.string().optional(),
        workingDir: z.string().optional(),
        environment: z.record(z.string().optional()).optional(),
      })
      .optional(),
  })
  .superRefine((config, ctx) => {
    if (
      config.retries?.initialDelayMs !== undefined &&
      config.retries?.maxDelayMs !== undefined &&
      config.retries.maxDelayMs < config.retries.initialDelayMs
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["retries", "maxDelayMs"],
        message: `retries.maxDelayMs (${config.retries.maxDelayMs}) must be >= retries.initialDelayMs (${config.retries.initialDelayMs}).`,
      });
    }
  });

export type GoddardLoopConfig = z.infer<typeof configSchema>;

// ---------------------------------------------------------------------------
// defineConfig
// ---------------------------------------------------------------------------

export function defineConfig(config: GoddardLoopConfig): GoddardLoopConfig {
  return config;
}
