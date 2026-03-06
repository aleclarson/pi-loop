import { useEffect, useState } from "preact/hooks";
import { Activity } from "../types";
import { julesService } from "../services/jules";
import { gitService } from "../services/git";
import { activeSession, repoMappings, selectedSpaceId, clearActiveSession } from "../state";
import styles from "./SessionControls.module.css";

export function SessionControls() {
  const [activities, setActivities] = useState<Activity[]>([]);

  useEffect(() => {
    const fetchActivities = async () => {
      if (activeSession.value) {
        const newActivities = await julesService.listActivities(
          activeSession.value.sessionId,
        );
        setActivities(newActivities);
      }
    };

    fetchActivities();
    const interval = setInterval(fetchActivities, 5000);
    return () => clearInterval(interval);
  }, [activeSession.value]);

  if (!activeSession.value) return null;

  return (
    <div className={styles.container}>
      <h3>Active Jules Session: {activeSession.value.taskId}</h3>
      <div className={styles.status}>Status: {activeSession.value.status}</div>

      <div className={styles.activitiesContainer}>
        <div className={styles.activitiesHeader}>Latest Activities</div>
        {activities.length === 0 && (
          <p style={{ color: "var(--text-secondary)" }}>Waiting for Jules...</p>
        )}
        {activities.map((a, i) => (
          <div key={i} className={styles.activityLine}>
            <span className={styles.timestamp}>
              [{new Date(a.timestamp).toLocaleTimeString()}]
            </span>
            <strong>{a.type}</strong>:{" "}
            {typeof a.details === "string"
              ? a.details
              : JSON.stringify(a.details)}
          </div>
        ))}
      </div>

      <div className={styles.actions}>
        <button
          className={styles.approveButton}
          onClick={async () => await julesService.approvePlan(activeSession.value!.sessionId)}
        >
          Approve Plan
        </button>
        <button
          className={styles.checkoutButton}
          onClick={async () => {
            const spaceId = selectedSpaceId.value;
            const repoPath = spaceId ? repoMappings.value[spaceId] : null;
            if (repoPath) {
              await gitService.checkoutBranch(repoPath, "jules-branch");
              alert("Checked out branch: jules-branch");
            }
          }}
        >
          Checkout PR Branch
        </button>
        <button
          className={styles.archiveButton}
          onClick={() => clearActiveSession()}
        >
          Archive Session
        </button>
      </div>
    </div>
  );
}
