import { useState } from "react";
import sharedStyles from "../styles/shared.module.css";
import styles from "./Home.module.css";
import type { HomeUser } from "./home_types";

interface UserListPanelProps {
  title: string;
  users: HomeUser[];
  actionLabel: string;
  emptyLabel: string;
  onAction: (userId: number) => Promise<void>;
}

export function UserListPanel({
  title,
  users,
  actionLabel,
  emptyLabel,
  onAction,
}: UserListPanelProps) {
  const [pendingId, setPendingId] = useState<number | null>(null);

  const run = async (userId: number) => {
    setPendingId(userId);
    try {
      await onAction(userId);
    } finally {
      setPendingId(null);
    }
  };

  return (
    <section className={styles.panel}>
      <h3 className={styles.panelTitle}>{title}</h3>

      {users.length === 0 ? (
        <p className={styles.empty}>{emptyLabel}</p>
      ) : (
        <ul className={styles.userList}>
          {users.map((user) => (
            <li key={user.id} className={styles.userRow}>
              <span className={styles.userName}>{user.username}</span>
              <button
                type="button"
                className={`${sharedStyles.actionButton} ${sharedStyles.buttonSm} ${sharedStyles.btnSlate}`}
                onClick={() => void run(user.id)}
                disabled={pendingId === user.id}
              >
                {pendingId === user.id ? "..." : actionLabel}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
