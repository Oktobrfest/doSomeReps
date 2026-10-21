import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import styles from "./Home.module.css";
import type { HomeUser } from "./home_types";

interface UserListPanelProps {
  title: string;
  icon?: React.ReactNode;
  users: HomeUser[];
  actionLabel: string;
  emptyLabel: string;
  onAction: (userId: number) => Promise<void>;
  defaultOpen?: boolean;
}

export function UserListPanel({
  title,
  icon,
  users,
  actionLabel,
  emptyLabel,
  onAction,
  defaultOpen = true,
}: UserListPanelProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
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
      <button
        type="button"
        className={styles.panelHeaderBtn}
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
      >
        <div className={styles.panelHeaderLeft}>
          {icon}
          <span className={styles.panelTitle}>{title}</span>
          <span className={styles.panelCount}>{users.length}</span>
        </div>
        <span className={styles.panelChevron}>
          {isOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        </span>
      </button>

      {isOpen && (
        <div className={styles.panelContent}>
          {users.length === 0 ? (
            <p className={styles.empty}>{emptyLabel}</p>
          ) : (
            <ul className={styles.userList}>
              {users.map((user) => (
                <li key={user.id} className={styles.userRow}>
                  <span className={styles.userName} title={user.username}>
                    {user.username}
                  </span>
                  <button
                    type="button"
                    className={styles.miniActionButton}
                    onClick={() => void run(user.id)}
                    disabled={pendingId === user.id}
                  >
                    {pendingId === user.id ? "..." : actionLabel}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
