import { useState, useMemo } from "preact/hooks";
import Fuse from "fuse.js";
import { openUrl } from "@tauri-apps/plugin-opener";
import { Task } from "../types";
import { selectedListId, julesSessions } from "../state";
import { useTasks } from "../hooks/useClickUp";
import { JulesPromptModal } from "./JulesPromptModal";
import styles from "./TasksView.module.css";

function getTaskGroups(allTasks: Task[]) {
  const openTasks = allTasks.filter((t) => t.status.type !== "closed");

  openTasks.sort((a, b) => {
    const getOrder = (t: Task) => {
      if (!t.priority || !t.priority.orderindex) return Number.MAX_SAFE_INTEGER;
      return parseInt(t.priority.orderindex);
    };
    return getOrder(a) - getOrder(b);
  });

  const groups: { title: string; color: string; tasks: Task[] }[] = [];

  openTasks.forEach((task) => {
    const rawTitle = task.priority?.priority || "No Priority";
    // Capitalize first letter
    const title = rawTitle.charAt(0).toUpperCase() + rawTitle.slice(1);
    const color = task.priority?.color || "#888";

    const lastGroup = groups[groups.length - 1];
    if (lastGroup && lastGroup.title === title) {
      lastGroup.tasks.push(task);
    } else {
      groups.push({ title, color, tasks: [task] });
    }
  });

  return groups;
}

function formatDescription(description: string) {
  if (!description) return "No description provided.";
  return description.replace(/\n/g, " ↵ ");
}

export function TasksView() {
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(
    new Set(),
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"tasks" | "jules">("tasks");

  const toggleGroup = (title: string) => {
    const newCollapsed = new Set(collapsedGroups);
    if (newCollapsed.has(title)) {
      newCollapsed.delete(title);
    } else {
      newCollapsed.add(title);
    }
    setCollapsedGroups(newCollapsed);
  };

  // Use SWR hook for tasks
  const { tasks, isLoading, isError } = useTasks(selectedListId.value);

  const fuse = useMemo(() => {
    return new Fuse(tasks, {
      keys: ["name", "description"],
      threshold: 0.4,
    });
  }, [tasks]);

  const displayedTasks = useMemo(() => {
    let baseTasks = tasks;
    if (searchQuery) {
      baseTasks = fuse.search(searchQuery).map((r) => r.item);
    }

    if (viewMode === "tasks") {
      // Filter out closed tasks and "active" status tasks
      return baseTasks.filter(
        (t) =>
          t.status.type !== "closed" &&
          t.status.status.toLowerCase() !== "active",
      );
    } else {
      // Jules Mode: Filter tasks with active sessions and PR links
      return baseTasks
        .filter((t) => {
          const session = julesSessions.value[t.id];
          return session && session.prLink;
        })
        .sort((a, b) => {
          const sessionA = julesSessions.value[a.id];
          const sessionB = julesSessions.value[b.id];
          const timeA = sessionA?.lastActivity
            ? new Date(sessionA.lastActivity).getTime()
            : 0;
          const timeB = sessionB?.lastActivity
            ? new Date(sessionB.lastActivity).getTime()
            : 0;
          return timeB - timeA;
        });
    }
  }, [tasks, searchQuery, viewMode, julesSessions.value]);

  const groups = useMemo(() => {
    if (viewMode === "tasks") {
      return getTaskGroups(displayedTasks);
    }
    return [];
  }, [displayedTasks, viewMode]);

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.headerContent}>
          <h2 className={styles.title}>Tasks</h2>
          <div className={styles.tabs}>
            <button
              className={`${styles.tab} ${viewMode === "tasks" ? styles.activeTab : ""}`}
              onClick={() => setViewMode("tasks")}
            >
              List
            </button>
            <button
              className={`${styles.tab} ${viewMode === "jules" ? styles.activeTab : ""}`}
              onClick={() => setViewMode("jules")}
            >
              Jules
            </button>
          </div>
        </div>
      </div>

      <input
        type="text"
        placeholder="Search tasks..."
        className={styles.searchInput}
        value={searchQuery}
        onInput={(e) => setSearchQuery(e.currentTarget.value)}
      />

      {isLoading && tasks.length === 0 ? (
        <div
          style={{ display: "flex", justifyContent: "center", padding: "3rem" }}
        >
          <div className="loading-spinner"></div>
        </div>
      ) : isError ? (
        <div className="emptyState">
          <p>Error loading tasks.</p>
        </div>
      ) : displayedTasks.length === 0 ? (
        <div className="emptyState">
          <div className="emptyIcon">∅</div>
          <p>
            {searchQuery
              ? "No matching tasks found."
              : viewMode === "jules"
                ? "No tasks with open PRs found."
                : "No tasks found in this list."}
          </p>
        </div>
      ) : (
        <div>
          {viewMode === "tasks" ? (
            groups.map((group) => (
              <div key={group.title} style={{ marginBottom: "2rem" }}>
                <h3
                  className={styles.groupHeader}
                  onClick={() => toggleGroup(group.title)}
                  style={{
                    color: group.color,
                    borderBottom: `2px solid ${group.color}`,
                    paddingBottom: "0.5rem",
                    marginBottom: "1rem",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center" }}>
                    <span
                      className={`${styles.chevron} ${collapsedGroups.has(group.title) ? styles.collapsed : ""}`}
                    >
                      ▼
                    </span>
                    {group.title}
                  </div>
                </h3>
                {!collapsedGroups.has(group.title) && (
                  <ul className={styles.taskList}>
                    {group.tasks.map((task) => (
                      <TaskItem
                        key={task.id}
                        task={task}
                        onDelegate={setSelectedTask}
                      />
                    ))}
                  </ul>
                )}
              </div>
            ))
          ) : (
            <ul className={styles.taskList}>
              {displayedTasks.map((task) => (
                <TaskItem
                  key={task.id}
                  task={task}
                  onDelegate={setSelectedTask}
                  isJulesView={true}
                />
              ))}
            </ul>
          )}
        </div>
      )}

      {selectedTask && (
        <JulesPromptModal
          task={selectedTask}
          onClose={() => setSelectedTask(null)}
        />
      )}
    </div>
  );
}

function TaskItem({
  task,
  onDelegate,
  isJulesView = false,
}: {
  task: Task;
  onDelegate: (t: Task) => void;
  isJulesView?: boolean;
}) {
  const session = julesSessions.value[task.id];
  const isWorking = session?.status === "active";

  return (
    <li className={styles.taskItem}>
      <div className={styles.taskHeader}>
        <h3 className={styles.taskTitle}>{task.name}</h3>
        <span className={styles.statusBadge}>{task.status.status}</span>
      </div>
      <p
        className={`${styles.description} ${!task.description ? styles.placeholder : ""}`}
      >
        {formatDescription(task.description)}
      </p>
      <div className={styles.taskFooter}>
        {isJulesView && session?.prLink && (
          <div className={styles.prLink}>
            <span className={styles.prIcon}>🔗</span>
            <a
              href={session.prLink}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => {
                e.preventDefault();
                openUrl(session.prLink!);
              }}
            >
              Pull Request
            </a>
          </div>
        )}

        <button className={styles.openButton} onClick={() => openUrl(task.url)}>
          Open in ClickUp
        </button>
        {isWorking ? (
          <div className={styles.workingLabel}>Jules is working on this...</div>
        ) : (
          <button
            className={styles.delegateButton}
            onClick={() => onDelegate(task)}
          >
            Delegate to Jules
          </button>
        )}
      </div>
    </li>
  );
}
