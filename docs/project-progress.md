# Project Progress Calculation Strategy & Formula

This document details the project progress calculation engine implemented in Step 10d under `apps/api/src/services/projectProgress.ts`.

---

## 1. Core Principle & Rationale

In hierarchical task management with 1-level subtasks:
- **Parent tasks** represent containers or groupings of granular subtasks. If progress counted both parents and children equally, work would be double-counted.
- **Leaf tasks** (tasks without any child subtasks) represent the actual atomic units of execution.
- Therefore, project progress is calculated based on the completed fraction of **leaf tasks**.

---

## 2. Mathematical Formula

Given the set of all tasks in a project $T$:
1. Determine the set of parent task IDs:
   $$P = \{ t.\text{parentTaskId} \mid t \in T \text{ and } t.\text{parentTaskId} \neq \text{null} \}$$
2. Determine the set of leaf tasks $L$:
   $$L = \{ t \in T \mid t.\text{id} \notin P \}$$
3. Count the number of leaf tasks in `done` status:
   $$D = \{ t \in L \mid t.\text{status} = \text{'done'} \}$$
4. Compute the progress percentage:
   $$\text{Progress} = \begin{cases} 0 & \text{if } |L| = 0 \\ \text{round}\left(\frac{|D|}{|L|} \times 100\right) & \text{if } |L| > 0 \end{cases}$$

---

## 3. Status Invariants

Only the valid enum values of `TaskStatus` exist:
- `todo`: Not done (0%)
- `in_progress`: Not done (0%)
- `blocked`: Not done (0%)
- `done`: Done (100%)

*Note: `blocked` tasks count strictly as uncompleted/not done.*

---

## 4. Edge Cases Handled

| Scenario | Behavior / Result |
|---|---|
| Project has 0 tasks | Returns `0%` |
| All leaf tasks are `done` | Returns `100%` |
| Parent task marked `done` but subtasks are open | Parent is NOT a leaf; subtasks determine progress $\to <100\%$ |
| Only root tasks (no subtasks exist) | All root tasks are leaves $\to \frac{\text{done}}{\text{total}} \times 100$ |
| Fractional percentages | Rounded to nearest whole integer percentage (e.g. 1 of 3 done $\to 33\%$) |

---

## 5. Swappability & Strategy Pattern

Progress calculation is decoupled through a strategy map:
```ts
export const projectProgressStrategies: Record<string, ProgressCalculationStrategy> = {
  leaf_tasks_done: leafTasksDoneStrategy,
};
```
Future strategies (e.g. estimated-hours weighted progress) can be added cleanly without changing callers or mutating core business routes.
