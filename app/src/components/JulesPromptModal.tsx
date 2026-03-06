import { useState } from "preact/hooks";
import { Task } from "../types";
import { julesService } from "../services/jules";
import { storeService } from "../services/store";
import { repoMappings, selectedSpaceId, julesSessions, startActiveSession, registerJulesSession } from "../state";
import styles from "./JulesPromptModal.module.css";
import { JulesSession } from "../types";

interface JulesPromptModalProps {
  task: Task;
  onClose: () => void;
}

export function JulesPromptModal({ task, onClose }: JulesPromptModalProps) {
  const [prompt, setPrompt] = useState(task.description);

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <h2>Delegate Task to Jules</h2>
        <div className={styles.taskName}>Task: {task.name}</div>
        <textarea
          className={styles.textarea}
          value={prompt}
          placeholder="Describe the objective for Jules..."
          onInput={(e) => setPrompt((e.target as HTMLTextAreaElement).value)}
        />
        <div className={styles.actions}>
          <button onClick={onClose} className={styles.cancelButton}>Cancel</button>
          <button
            className={styles.delegateButton}
            onClick={async () => {
              const spaceId = selectedSpaceId.value;
              const repoPath = spaceId ? repoMappings.value[spaceId] : null;

              if (!repoPath) {
                alert("No repository mapped for this space. Please map a repo in the Spaces view first.");
                return;
              }

              // 1. Create session
              const sessionResponse = await julesService.createSession(prompt, { taskId: task.id, repoPath });

              const newSession: JulesSession = {
                sessionId: sessionResponse.sessionId,
                status: "active",
                taskId: task.id,
                repoPath: repoPath as string,
              };

              // 2. Update active session state
              startActiveSession(newSession);

              // 3. Persist session
              registerJulesSession(newSession);
              const updatedSessions = { ...julesSessions.value, [task.id]: newSession };
              await storeService.setActiveJulesSessions(updatedSessions);

              onClose();
            }}
          >
            Delegate
          </button>
        </div>
      </div>
    </div>
  );
}
