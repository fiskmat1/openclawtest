import { Buffer } from 'node:buffer';
import { Sandbox } from '@e2b/desktop';

import type {
  ComputerAction,
  ComputerUseSupervisorClient,
  SupervisorSafetyCheck,
  SupervisorTaskResult
} from '@workspace/agents';

function toDataUrl(bytes: Uint8Array): string {
  return `data:image/png;base64,${Buffer.from(bytes).toString('base64')}`;
}

function normalizeKey(input: string): string {
  const normalized = input.trim().toLowerCase();

  switch (normalized) {
    case 'return':
      return 'enter';
    case 'control':
      return 'ctrl';
    case 'escape':
      return 'esc';
    case 'arrowup':
      return 'up';
    case 'arrowdown':
      return 'down';
    case 'arrowleft':
      return 'left';
    case 'arrowright':
      return 'right';
    case 'pagedown':
      return 'Page_Down';
    case 'pageup':
      return 'Page_Up';
    default:
      return input;
  }
}

async function executeComputerAction(
  sandbox: Sandbox,
  action: ComputerAction
): Promise<void> {
  switch (action.type) {
    case 'click':
      if (action.button === 'right') {
        await sandbox.rightClick(action.x, action.y);
        return;
      }

      if (action.button === 'wheel') {
        await sandbox.middleClick(action.x, action.y);
        return;
      }

      if (action.button === 'back') {
        await sandbox.press(['Alt', 'Left']);
        return;
      }

      if (action.button === 'forward') {
        await sandbox.press(['Alt', 'Right']);
        return;
      }

      await sandbox.leftClick(action.x, action.y);
      return;
    case 'double_click':
      await sandbox.doubleClick(action.x, action.y);
      return;
    case 'drag': {
      const start = action.path[0];
      const end = action.path.at(-1);

      if (!start || !end) {
        return;
      }

      await sandbox.drag([start.x, start.y], [end.x, end.y]);
      return;
    }
    case 'keypress':
      await sandbox.press(action.keys.map((key) => normalizeKey(key)));
      return;
    case 'move':
      await sandbox.moveMouse(action.x, action.y);
      return;
    case 'scroll': {
      if (typeof action.x === 'number' && typeof action.y === 'number') {
        await sandbox.moveMouse(action.x, action.y);
      }

      const vertical = Math.trunc(action.scroll_y ?? 0);

      if (vertical !== 0) {
        await sandbox.scroll(
          vertical > 0 ? 'down' : 'up',
          Math.max(1, Math.ceil(Math.abs(vertical) / 120))
        );
      }
      return;
    }
    case 'type':
      await sandbox.write(action.text, {
        chunkSize: 24,
        delayInMs: 50
      });
      return;
    case 'wait':
      await sandbox.wait(1_000);
      return;
    case 'screenshot':
      return;
  }
}

export type RunSupervisorLoopInput = {
  sandboxId: string;
  e2bApiKey: string;
  supervisor: ComputerUseSupervisorClient;
  task: string;
  systemPrompt: string;
  previousResponseId?: string;
  maxTurns?: number;
  metadata?: Record<string, unknown>;
  autoAcknowledgeSafetyChecks?: boolean;
};

export type RunSupervisorLoopResult = SupervisorTaskResult & {
  lastScreenshotUrl: string;
  acknowledgedSafetyChecks: SupervisorSafetyCheck[];
};

export async function runSupervisorLoop(
  input: RunSupervisorLoopInput
): Promise<RunSupervisorLoopResult> {
  const sandbox = await Sandbox.connect(input.sandboxId, {
    apiKey: input.e2bApiKey
  });
  const maxTurns = input.maxTurns ?? 8;
  const turns: SupervisorTaskResult['turns'] = [];
  let actionCount = 0;
  let previousResponseId = input.previousResponseId;
  let callId: string | undefined;
  let screenshotUrl = toDataUrl(await sandbox.screenshot());
  let acknowledgedSafetyChecks: SupervisorSafetyCheck[] = [];
  let outputText: string | undefined;

  for (let turnIndex = 0; turnIndex < maxTurns; turnIndex += 1) {
    const result = await input.supervisor.createTurn({
      task: input.task,
      systemPrompt: input.systemPrompt,
      previousResponseId,
      callId,
      screenshotUrl: callId ? screenshotUrl : undefined,
      acknowledgedSafetyChecks,
      autoAcknowledgeSafetyChecks: input.autoAcknowledgeSafetyChecks,
      metadata: input.metadata
    });
    const [turn] = result.turns;
    if (!turn) {
      break;
    }

    turns.push(turn);
    previousResponseId = result.responseId ?? previousResponseId;
    outputText = result.outputText ?? outputText;

    if (turn.pendingSafetyChecks.length > 0) {
      if (!input.autoAcknowledgeSafetyChecks) {
        return {
          responseId: previousResponseId,
          outputText,
          turns,
          actionCount,
          pendingSafetyChecks: turn.pendingSafetyChecks,
          metadata: input.metadata,
          lastScreenshotUrl: screenshotUrl,
          acknowledgedSafetyChecks
        };
      }

      acknowledgedSafetyChecks = turn.pendingSafetyChecks;
    } else {
      acknowledgedSafetyChecks = [];
    }

    if (!turn.callId) {
      break;
    }

    for (const action of turn.actions) {
      await executeComputerAction(sandbox, action);
      if (action.type !== 'screenshot') {
        actionCount += 1;
      }
    }

    screenshotUrl = toDataUrl(await sandbox.screenshot());
    callId = turn.callId;
  }

  return {
    responseId: previousResponseId,
    outputText,
    turns,
    actionCount,
    pendingSafetyChecks: [],
    metadata: input.metadata,
    lastScreenshotUrl: screenshotUrl,
    acknowledgedSafetyChecks
  };
}
