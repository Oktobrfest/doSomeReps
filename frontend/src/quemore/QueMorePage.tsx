import { useState } from "react";
import { CategoryPicker } from "../components/CategoryPicker";
import { useRememberedCategories } from "../hooks/useRememberedCategories";
import { QuePanel } from "./QuePanel";
import { QueResultsList } from "./QueResultsList";
import { readBootstrap } from "./quemore_api";
import { resolveCategoryNames } from "../lib/categories";
import styles from "./QueMore.module.css";
import type { QueMemberBootstrap } from "./quemore_types";

const bootstrap = readBootstrap();

/** A signed-in reader picks the categories, searches them, and ques what turns up. */
function QueWorkflow({ member }: { member: QueMemberBootstrap }) {
  const [categories, setCategories] = useState<string[]>(() =>
    resolveCategoryNames(member.selectedCategories, member.categoryList)
  );
  useRememberedCategories("quemore", categories);

  return (
    <>
      <h1 className={styles.pageTitle}>Que More Questions</h1>

      <CategoryPicker
        selectedCategories={categories}
        onChange={setCategories}
        savedLists
        selectAll
      />

      <QuePanel endpoints={member} categories={categories} browse={member.topic !== null} />
    </>
  );
}

export function QueMorePage() {
  return (
    <div className={styles.page}>
      {/* A visitor is handed one topic's questions to read; a member searches for theirs. */}
      {"questions" in bootstrap ? (
        <>
          <h1 className={styles.pageTitle}>{bootstrap.topic} Questions and Answers</h1>
          <section className={styles.results}>
            <QueResultsList results={bootstrap.questions} />
          </section>
        </>
      ) : (
        <QueWorkflow member={bootstrap} />
      )}
    </div>
  );
}
