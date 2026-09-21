import { createRoot } from "react-dom/client";
import { useState } from "react";
import { CategoryPicker } from "../components/CategoryPicker";
import { resolveCategoryNames, toSlug } from "../lib/categories";
import sharedStyles from "../styles/shared.module.css";
import "../styles/global.css";

interface CategoriesCoreData {
  categoryList: string[];
  selectedCategories: string[] | string;
  catsDue?: string[];
  hideSavedLists?: boolean;
  hideHeader?: boolean;
}

interface CategoriesWrapperProps {
  initialSelected: string[];
  savedLists: boolean;
  collapsible: boolean;
  defaultCollapsed: boolean;
}

function CategoriesWrapper({
  initialSelected,
  savedLists,
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
          className={`${sharedStyles.actionButton} ${sharedStyles.buttonSm} ${sharedStyles.btnSlate}`}
          onClick={() => setCollapsed(!collapsed)}
          aria-expanded={!collapsed}
        >
          {collapsed ? "Show filters" : "Hide filters"}
        </button>
      )}

      {/* # CHANGED THIS - server-backed category forms use the same grid mode instead of a separate picker implementation. */}
      <CategoryPicker
        mode="grid"
        selectedCategories={selected}
        onChange={setSelected}
        savedLists={savedLists}
        selectAll
        collapsed={collapsed}
        form={{ name: "category_name", value: toSlug, apply: true }}
      />
    </>
  );
}

function mount() {
  const fullRoot = document.getElementById("react-categories-root");
  const dataEl = document.getElementById("categories-core-data");

  if (!dataEl || !fullRoot) return;

  try {
    const data: CategoriesCoreData = JSON.parse(dataEl.textContent || "{}");
    const categoryList = data.categoryList ?? [];

    const initialSelected = Array.isArray(data.selectedCategories)
      ? data.selectedCategories
      : typeof data.selectedCategories === "string" && data.selectedCategories
        ? [data.selectedCategories]
        : [];

    // # CHANGED THIS - resolveCategoryNames now accepts names or slugs directly, so normalization is done once without pre-converting every value.
    const normalizedSelected = resolveCategoryNames(
      Array.from(new Set([...initialSelected, ...(data.catsDue ?? [])])),
      categoryList
    );

    const collapsible = !(data.hideHeader ?? false);

    createRoot(fullRoot).render(
      <CategoriesWrapper
        initialSelected={normalizedSelected}
        savedLists={!(data.hideSavedLists ?? false)}
        collapsible={collapsible}
        defaultCollapsed={collapsible && normalizedSelected.length > 0}
      />
    );
  } catch (err) {
    console.error("Error mounting CategoryPicker:", err);
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", mount);
} else {
  mount();
}
