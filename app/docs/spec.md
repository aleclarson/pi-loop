# Behavior Specification

## 1. Overview

The application is a lightweight desktop client that bridges ClickUp task management, local Git repositories, and the "Jules" AI coding agent. It allows developers to quickly browse their assigned work, delegate specific tasks to Jules, and manage the lifecycle of those AI sessions directly from their desktop.

## 2. Authentication & Configuration

- **ClickUp Authentication**: On first launch, the user is prompted to enter their ClickUp Personal Access Token (PAT). This token is stored securely on the local machine.
- **Git Repository Mapping**: When viewing the list of ClickUp Spaces, the user can link a local file system directory (a Git clone) to a specific Space.
  - This mapping is persisted between app sessions.
  - If a Space does not have an associated Git repository, Jules delegation features will be disabled or prompt the user to configure the repo first.

## 3. User Interface & Navigation Flow

### 3.1. Spaces View (Home)

- Displays a list of all ClickUp Spaces accessible via the provided PAT.
- Shows the currently linked local Git repository path for each space.
- Provides a "Browse" button to open a native file dialog to select or change the local Git repository for a space.
- Clicking on a Space navigates to the **Lists View**.

### 3.2. Lists View

- Displays all folders and lists within the selected Space.
- Clicking a List navigates to the **Tasks View**.

### 3.3. Tasks View

- Displays active tasks within the selected list.
- Each task card displays the task name, description snippet, status, and assignees.
- **Default Action Buttons** (for tasks not yet delegated):
  - **Open in ClickUp**: Represented by the ClickUp logo. Opens the task URL in the user's default web browser.
  - **Delegate to Jules**: Represented by the Google Jules logo. Initiates the delegation workflow.

## 4. Jules Delegation Workflow

### 4.1. Prompt Configuration

- Clicking "Delegate to Jules" opens a modal/drawer.
- The modal contains a text editor pre-populated with the Task Name and Task Description.
- The user can edit, refine, or add specific technical instructions for Jules before submitting.

### 4.2. Session Creation & ClickUp Synchronization

- Upon confirming the delegation:
  1.  The app calls the ClickUp API to change the task status to **"In Progress"**.
  2.  The app calls the ClickUp API to **self-assign** the task to the authenticated user.
  3.  A Jules session is initiated in the background, utilizing the mapped local Git repository path and the provided prompt.
- The task UI transitions into the "Active Session" state.

### 4.3. Active Session Management

Once a task is delegated, the default action buttons are replaced/augmented with session controls:

- **Pause/Resume Jules Session**: Toggles the active processing state of the Jules agent.
- **Archive Jules Session**: Stops the agent, clears the local session state, and removes the Jules controls (reverting to the default action buttons).
- **Checkout Jules PR**:
  - _State_: Disabled/Grayed out initially.
  - _Trigger_: Becomes active once Jules successfully creates a Pull Request.
  - _Action_: Executes local Git commands (e.g., `git fetch`, `git checkout <jules-branch>`) in the mapped repository directory so the user can review the code locally.
- **Open in ClickUp**: Remains available at all times.

## 5. Persistence

- **Secrets**: ClickUp PAT.
- **Mappings**: A JSON dictionary mapping `ClickUp Space ID` -> `Local Directory Path`.
- **Session State**: A mapping of `ClickUp Task ID` -> `Jules Session ID / Status` (to ensure that if the app is closed and reopened, active Jules tasks still show the Pause/Resume/Checkout PR buttons).
