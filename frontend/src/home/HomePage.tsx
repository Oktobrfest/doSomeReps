import { useCallback, useState } from "react";
import { Toaster, toast } from "sonner";
import { UserListPanel } from "./UserListPanel";
import { readBootstrap, unblockUser, unfavoriteUser } from "./home_api";
import styles from "./Home.module.css";
import type { HomeUser } from "./home_types";

const bootstrap = readBootstrap();

export function HomePage() {
  const [favorites, setFavorites] = useState<HomeUser[]>(bootstrap.favorites);
  const [blocked, setBlocked] = useState<HomeUser[]>(bootstrap.blocked);

  const handleUnfavorite = useCallback(async (userId: number) => {
    try {
      await unfavoriteUser(bootstrap.unfavoriteUrl, userId);
      setFavorites((prev) => prev.filter((user) => user.id !== userId));
      toast.success("Removed from favorites.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong.");
    }
  }, []);

  const handleUnblock = useCallback(async (userId: number) => {
    try {
      await unblockUser(bootstrap.unblockUrl, userId);
      setBlocked((prev) => prev.filter((user) => user.id !== userId));
      toast.success("User unblocked.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong.");
    }
  }, []);

  return (
    <div className={styles.page}>
      <Toaster richColors position="top-right" />

      <aside className={styles.sidebar}>
        <UserListPanel
          title="Favorite Users"
          users={favorites}
          actionLabel="Remove"
          emptyLabel="No favorite users yet."
          onAction={handleUnfavorite}
        />
        <UserListPanel
          title="Blocked Users"
          users={blocked}
          actionLabel="Unblock"
          emptyLabel="No blocked users."
          onAction={handleUnblock}
        />
      </aside>

      <main className={styles.main}>
        {bootstrap.quizQuestionCount > 0 && (
          <p className={styles.quizCallout}>
            You have {bootstrap.quizQuestionCount} quiz question
            {bootstrap.quizQuestionCount === 1 ? "" : "s"} to answer.{" "}
            <a className={styles.quizLink} href={bootstrap.quizUrl}>
              Take Quiz
            </a>
          </p>
        )}

        <section className={styles.chartArea}>
          <h3 className={styles.chartTitle}>Categories to Do</h3>
          {bootstrap.catzChart ? (
            <img
              className={styles.chartImage}
              src={`data:image/png;base64,${bootstrap.catzChart}`}
              alt="Bar chart of your due questions grouped by category"
            />
          ) : (
            <p className={styles.empty}>No categories due right now.</p>
          )}
        </section>
      </main>
    </div>
  );
}
