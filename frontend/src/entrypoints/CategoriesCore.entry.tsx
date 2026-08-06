import { createRoot } from "react-dom/client";
import { useState } from "react";
import { CategoryPicker } from "../components/CategoryPicker";
import sharedStyles from "../styles/shared.module.css";
import "../styles/global.css";

interface CategoriesCoreData {
  categoryList: string[];
  selectedCategories: string[] | string;
  catsDue?: string[];
  hideSavedLists?: boolean;
  hideHeader?: boolean;
}

const toSlug = (value: string) => value.replace(/ /g, "_");

interface CategoriesWrapperProps {
  initialSelected: string[];
  showSavedLists: boolean;
  showSelectAll: boolean;
  showApplyButton: boolean;
  collapsible: boolean;
  defaultCollapsed: boolean;
}

function CategoriesWrapper({
  initialSelected,
  showSavedLists,
  showSelectAll,
  showApplyButton,
  collapsible,
  defaultCollapsed,
}: CategoriesWrapperProps) {
  const [selected, setSelected] = useState<string[]>(initialSelected);
  const [collapsed, setCollapsed] = useState(collapsible && defaultCollapsed);

  return (
    <>
      {collapsible && (
        <button
          type="button"
          className={`${sharedStyles.button} ${sharedStyles.buttonSecondary}`}
          onClick={() => setCollapsed(!collapsed)}
          aria-expanded={!collapsed}
        >
          {collapsed ? "Show filters" : "Hide filters"}
        </button>
      )}
      <CategoryPicker
        selectedCategories={selected}
        onChange={setSelected}
        showSavedLists={showSavedLists}
        showSelectAll={showSelectAll}
        showApplyButton={showApplyButton}
        collapsed={collapsed}
        checkboxName="category_name"
        checkboxValueFn={toSlug}
      />
    </>
  );
}

function mount() {
  const coreRoot = document.getElementById("react-categories-core-root");
  const fullRoot = document.getElementById("react-categories-root");
  const dataEl = document.getElementById("categories-core-data");

  if (!dataEl) return;

  try {
    const data: CategoriesCoreData = JSON.parse(dataEl.textContent || "{}");
    const categoryList = data.categoryList ?? [];

    const initialSelectedSlugs = Array.isArray(data.selectedCategories)
      ? data.selectedCategories
      : typeof data.selectedCategories === "string" && data.selectedCategories
        ? [data.selectedCategories]
        : [];

    const normalizedSelected = Array.from(
      new Set([...initialSelectedSlugs, ...(data.catsDue ?? [])])
    ).map(
      (slug) =>
        categoryList.find((cat) => toSlug(cat) === slug) ??
        slug.replace(/_/g, " ")
    );

    if (coreRoot) {
      createRoot(coreRoot).render(
        <CategoriesWrapper
          initialSelected={normalizedSelected}
          showSavedLists={false}
          showSelectAll={false}
          showApplyButton={false}
          collapsible={false}
          defaultCollapsed={false}
        />
      );
    }

    if (fullRoot) {
      const collapsible = !(data.hideHeader ?? false);

      createRoot(fullRoot).render(
        <CategoriesWrapper
          initialSelected={normalizedSelected}
          showSavedLists={!(data.hideSavedLists ?? false)}
          showSelectAll={true}
          showApplyButton={true}
          collapsible={collapsible}
          defaultCollapsed={collapsible && normalizedSelected.length > 0}
        />
      );
    }
  } catch (err) {
    console.error("Error mounting CategoryPicker:", err);
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", mount);
} else {
  mount();
}
