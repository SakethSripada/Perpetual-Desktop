export const slashCommands = [
  ['plan', 'Plan without editing files'],
  ['review', 'Review code and changes'],
  ['security-review', 'Review security risks'],
  ['model', 'Choose a model'],
  ['permissions', 'Set access level'],
  ['effort', 'Set reasoning effort'],
  ['init', 'Create repository guidance'],
  ['debug', 'Diagnose and fix a problem'],
  ['simplify', 'Simplify changes'],
  ['run', 'Build and run the application'],
  ['verify', 'Run relevant verification'],
  ['diff', 'Review workspace changes'],
  ['status', 'Show task status'],
  ['new', 'Start a new task'],
  ['resume', 'Search task history'],
  ['stop', 'Stop this task'],
  ['settings', 'Open settings'],
  ['help', 'Browse commands'],
] as const;
export function parseCommand(text: string) {
  const match = /^\s*\/([a-z-]+)(?:\s+([\s\S]*))?$/i.exec(text);
  if (!match) return null;
  const aliases: Record<string, string> = {
    'code-review': 'review',
    permission: 'permissions',
    reasoning: 'effort',
    clear: 'new',
    reset: 'new',
    history: 'resume',
    config: 'settings',
  };
  const name = aliases[match[1]] || match[1];
  return slashCommands.some(([key]) => key === name)
    ? { name, argument: match[2]?.trim() || '' }
    : null;
}
export function commandPrompt(name: string, argument: string, agent: string) {
  const prompts: Record<string, string> = {
    plan: 'Inspect the repository and create an implementation plan. Do not modify files or perform external actions. Include scope, implementation steps, verification, and risks.',
    review:
      'Perform a read-only code review. Do not modify files or perform external actions. Report actionable findings by severity with file and line references. State plainly when no findings exist.',
    'security-review':
      'Perform a read-only security review. Do not modify files or perform external actions. Report exploitable vulnerabilities with severity, evidence, and remediation.',
    init: `Inspect the repository and create or update ${agent === 'codex' ? 'AGENTS.md' : 'CLAUDE.md'} with concise verified architecture, conventions, commands, and tests. Preserve useful existing guidance.`,
    debug:
      'Reproduce and diagnose the reported problem, fix the root cause with a focused change, and verify the result.',
    simplify:
      'Simplify the changes without changing observable behavior. Reuse existing helpers and verify the result.',
    run: 'Build and launch the application. Exercise the relevant behavior and report the observed result and limitations.',
    verify:
      'Run the relevant tests, builds, and runtime checks. Report the evidence and remaining failures.',
  };
  return prompts[name]
    ? `${prompts[name]}\n\n${argument || 'Use the current task and repository state.'}`
    : null;
}
