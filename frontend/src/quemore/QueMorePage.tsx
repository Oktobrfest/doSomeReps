import { useState } from "react";
import { CategoryPicker } from "../components/CategoryPicker";
import { QuePanel } from "./QuePanel";
import { readBootstrap } from "./quemore_api";
import { resolveCategoryNames } from "../lib/categories";
import styles from "./QueMore.module.css";

const bootstrap = readBootstrap();

function resolveInitialSelection(): string[] {
  return resolveCategoryNames(
    bootstrap.selectedCategories,
    bootstrap.categoryList
  );
}

export function QueMorePage() {
  const [categories, setCategories] = useState<string[]>(resolveInitialSelection);

  return (
    <div className={styles.page}>
      <h1 className={styles.pageTitle}>Que More Questions</h1>

      <CategoryPicker
        selectedCategories={categories}
        onChange={setCategories}
        savedLists
        selectAll
      />

      <QuePanel endpoints={bootstrap} categories={categories} />
    </div>
  );
}
