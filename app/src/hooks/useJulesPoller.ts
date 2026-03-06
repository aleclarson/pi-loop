import { useEffect } from "preact/hooks";
import { julesSessions, updateSessionPrLink } from "../state";
import { julesService } from "../services/jules";
import { storeService } from "../services/store";

export function useJulesPoller() {
  useEffect(() => {
    const pollSessions = async () => {
      // Get current sessions
      const currentSessions = julesSessions.value;

      // Identify sessions that need polling
      const tasksToPoll = Object.values(currentSessions).filter(
        (s) => s.status === "active" && !s.prLink,
      );

      if (tasksToPoll.length === 0) return;

      for (const session of tasksToPoll) {
        try {
          const remoteSession = await julesService.getSession(
            session.sessionId,
          );

          // Check for PR link in outputs
          const prUrl = remoteSession.outputs?.pullRequest?.url;
          if (prUrl) {
             // Update state
             updateSessionPrLink(session.taskId, prUrl);

             // Persist the updated state.
             // Note: updateSessionPrLink updates the signal.
             // We can read the fresh value from julesSessions.value
             await storeService.setActiveJulesSessions(julesSessions.value);
          }
        } catch (e) {
          console.error(`Failed to poll session ${session.sessionId}`, e);
        }
      }
    };

    const interval = setInterval(pollSessions, 10000); // Poll every 10 seconds

    // Initial poll (delayed slightly to allow initial load)
    const timeout = setTimeout(pollSessions, 2000);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, []);
}
