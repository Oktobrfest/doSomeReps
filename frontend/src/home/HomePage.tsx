import { useCallback, useState } from "react";
import { Ban, ChevronDown, ChevronUp, Star, Users } from "lucide-react";
import { errorMessage } from "../lib/errors";
import { notify } from "../toast/notify";
import { CategoriesToDoChart } from "./CategoriesToDoChart";
import { DailyActivityChart } from "./DailyActivityChart";
import { UserListPanel } from "./UserListPanel";
import { readBootstrap, unblockUser, unfavoriteUser } from "./home_api";
import styles from "./Home.module.css";
import type { HomeUser } from "./home_types";

const USERS_COLLAPSED_KEY = "repz_home_users_section_collapsed";
const bootstrap = readBootstrap();

export function HomePage() {
  const [favorites, setFavorites] = useState<HomeUser[]>(bootstrap.favorites);
  const [blocked, setBlocked] = useState<HomeUser[]>(bootstrap.blocked);

  const [isUsersCollapsed, setIsUsersCollapsed] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(USERS_COLLAPSED_KEY);
      if (saved !== null) {
        return saved === "true";
      }
    } catch {
      // ignore storage access issues
    }
    // Default collapsed when empty to save maximum space
    return (bootstrap.favorites?.length ?? 0) === 0 && (bootstrap.blocked?.length ?? 0) === 0;
  });

  const toggleUsersCollapsed = useCallback(() => {
    setIsUsersCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(USERS_COLLAPSED_KEY, String(next));
      } catch {
        // ignore storage access issues
      }
      return next;
    });
  }, []);

  const handleUnfavorite = useCallback(async (userId: number) => {
    try {
      await unfavoriteUser(bootstrap.unfavoriteUrl, userId);
      setFavorites((prev) => prev.filter((user) => user.id !== userId));
      notify.success("Removed from favorites.");
    } catch (err) {
      notify.error(errorMessage(err, "Something went wrong."));
    }
  }, []);

  const handleUnblock = useCallback(async (userId: number) => {
    try {
      await unblockUser(bootstrap.unblockUrl, userId);
      setBlocked((prev) => prev.filter((user) => user.id !== userId));
      notify.success("User unblocked.");
    } catch (err) {
      notify.error(errorMessage(err, "Something went wrong."));
    }
  }, []);

  const hasDueQuestions =
    bootstrap.quizQuestionCount > 0 &&
    ((bootstrap.categoriesToDo && bootstrap.categoriesToDo.length > 0) || Boolean(bootstrap.catzChart));

  return (
    <div className={styles.page}>
      <aside
        className={`${styles.sidebar} ${isUsersCollapsed ? styles.sidebarCollapsed : ""}`}
        aria-label="User relationships"
      >
        <div className={`${styles.sidebarHeader} ${!isUsersCollapsed ? styles.sidebarHeaderOpen : ""}`}>
          <button
            type="button"
            className={styles.sidebarToggle}
            onClick={toggleUsersCollapsed}
            aria-expanded={!isUsersCollapsed}
            title={isUsersCollapsed ? "Expand users section" : "Collapse users section"}
          >
            <div className={styles.sidebarTitleRow}>
              <Users size={14} className={styles.sidebarIcon} />
              <span className={styles.sidebarHeading}>Users</span>
              <span className={styles.sidebarPills}>
                <span className={styles.pillFav} title={`${favorites.length} favorite users`}>
                  ⭐ {favorites.length}
                </span>
                <span className={styles.pillBlocked} title={`${blocked.length} blocked users`}>
                  🚫 {blocked.length}
                </span>
              </span>
            </div>
            <span className={styles.chevronIcon}>
              {isUsersCollapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
            </span>
          </button>
        </div>

        {!isUsersCollapsed && (
          <div className={styles.sidebarBody}>
            <UserListPanel
              title="Favorites"
              icon={<Star size={12} className={styles.panelTitleIconFav} />}
              users={favorites}
              actionLabel="Remove"
              emptyLabel="No favorite users"
              onAction={handleUnfavorite}
            />
            <UserListPanel
              title="Blocked"
              icon={<Ban size={12} className={styles.panelTitleIconBlocked} />}
              users={blocked}
              actionLabel="Unblock"
              emptyLabel="No blocked users"
              onAction={handleUnblock}
            />
          </div>
        )}
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

        {hasDueQuestions && (
          <CategoriesToDoChart
            categories={bootstrap.categoriesToDo ?? []}
            fallbackImage={bootstrap.catzChart}
            dailyHistory={bootstrap.dailyHistory ?? []}
          />
        )}

        <DailyActivityChart data={bootstrap.dailyHistory ?? []} />
      </main>
    </div>
  );
}
