import { useState, useEffect, useRef } from "react";

interface CatPickerProps {
  selectedCategories: string[];
  onChange: (categories: string[]) => void;
}

export function CatPicker({ selectedCategories, onChange }: CatPickerProps) {
  const [allCategories, setAllCategories] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [modalSearch, setModalSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  // Fetch all categories from API
  useEffect(() => {
    fetch("/api/categories")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch categories");
        return res.json();
      })
      .then((data) => {
        if (Array.isArray(data)) {
          setAllCategories(data);
        }
      })
      .catch((err) => console.error("Error fetching categories:", err));
  }, []);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Filter available categories based on search query and what's not yet selected, sorted alphabetically
  const suggestions = allCategories
    .filter((cat) => {
      const matchesSearch = cat.toLowerCase().includes(searchQuery.toLowerCase());
      const notSelected = !selectedCategories.includes(cat);
      return matchesSearch && notSelected;
    })
    .sort((a, b) => a.localeCompare(b));

  const handleSelectCategory = (cat: string) => {
    if (!selectedCategories.includes(cat)) {
      const updated = [...selectedCategories, cat];
      onChange(updated);
    }
    setSearchQuery("");
    setShowDropdown(false);
  };

  const handleToggleCheckbox = (cat: string) => {
    let updated: string[];
    if (selectedCategories.includes(cat)) {
      updated = selectedCategories.filter((item) => item !== cat);
    } else {
      updated = [...selectedCategories, cat];
    }
    onChange(updated);
  };

  return (
    <div className="card border-secondary mb-4" ref={containerRef}>
      <div className="card-header bg-secondary text-white font-weight-bold py-2 d-flex justify-content-between align-items-center">
        <span>Category Selection</span>
        <button
          type="button"
          className="btn btn-sm btn-light"
          onClick={() => setShowModal(true)}
        >
          See All
        </button>
      </div>
      <div className="card-body">
        {/* Text Entry Field with Autocomplete */}
        <div className="position-relative mb-3">
          <label htmlFor="cat-search-input" className="font-weight-bold text-dark small mb-1 d-block">
            Search or Add Categories
          </label>
          <input
            id="cat-search-input"
            type="text"
            className="form-control"
            placeholder="Type category name to search..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setShowDropdown(true);
            }}
            onFocus={() => setShowDropdown(true)}
            style={{ color: "#000000" }}
          />

          {/* Autocomplete Dropdown */}
          {showDropdown && suggestions.length > 0 && (
            <ul
              className="list-group position-absolute w-100 shadow"
              style={{
                zIndex: 1000,
                maxHeight: "200px",
                overflowY: "auto",
                backgroundColor: "#ffffff",
                border: "1px solid #ced4da",
                borderRadius: "0.25rem",
                marginTop: "2px",
                padding: "0",
              }}
            >
              {suggestions.map((cat) => (
                <li
                  key={cat}
                  className="list-group-item list-group-item-action py-2 px-3 text-dark"
                  style={{ cursor: "pointer", border: "none" }}
                  onClick={() => handleSelectCategory(cat)}
                >
                  {cat}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Expanded Series of Categories with Checkboxes */}
        <div className="mt-2">
          <span className="font-weight-bold text-dark small mb-2 d-block">
            Selected Categories:
          </span>
          {selectedCategories.length === 0 ? (
            <p className="text-muted small mb-0">No categories selected yet. Use the search input above to add categories.</p>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
                gap: "8px",
              }}
            >
              {selectedCategories.map((cat) => (
                <div
                  key={cat}
                  className="d-flex align-items-center p-2 border rounded bg-light shadow-sm"
                  style={{
                    backgroundColor: "#ffa500",
                    borderColor: "#ffa500",
                    color: "#000000",
                  }}
                >
                  <input
                    type="checkbox"
                    id={`cat-checkbox-${cat}`}
                    checked={true}
                    onChange={() => handleToggleCheckbox(cat)}
                    style={{ marginRight: "6px", cursor: "pointer" }}
                  />
                  <span
                    className="mb-0 text-truncate font-weight-bold"
                    style={{
                      cursor: "pointer",
                      fontSize: "0.8rem",
                      userSelect: "none",
                      flexGrow: 1,
                    }}
                    title={cat}
                    onClick={() => handleToggleCheckbox(cat)}
                  >
                    {cat}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* "See All" Modal */}
      {showModal && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.5)",
            zIndex: 1050,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
          onClick={() => setShowModal(false)}
        >
          <div
            style={{
              backgroundColor: "#ffffff",
              borderRadius: "8px",
              width: "90%",
              maxWidth: "800px",
              maxHeight: "80vh",
              display: "flex",
              flexDirection: "column",
              boxShadow: "0 4px 20px rgba(0, 0, 0, 0.3)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "12px 16px",
                borderBottom: "1px solid #dee2e6",
              }}
            >
              <h5 style={{ margin: 0, fontWeight: "bold" }}>All Categories</h5>
              <button
                type="button"
                className="close"
                style={{ fontSize: "1.5rem", lineHeight: 1, background: "none", border: "none", cursor: "pointer" }}
                onClick={() => setShowModal(false)}
                aria-label="Close"
              >
                &times;
              </button>
            </div>

            {/* Modal Search */}
            <div style={{ padding: "12px 16px", borderBottom: "1px solid #dee2e6" }}>
              <input
                type="text"
                className="form-control"
                placeholder="Filter categories..."
                value={modalSearch}
                onChange={(e) => setModalSearch(e.target.value)}
                style={{ color: "#000000" }}
              />
            </div>

            {/* Modal Body - Category Grid */}
            <div style={{ padding: "16px", overflowY: "auto", flex: 1 }}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
                  gap: "8px",
                }}
              >
                {allCategories
                  .filter((cat) =>
                    cat.toLowerCase().includes(modalSearch.toLowerCase())
                  )
                  .sort((a, b) => a.localeCompare(b))
                  .map((cat) => {
                    const isSelected = selectedCategories.includes(cat);
                    return (
                      <div
                        key={cat}
                        className="d-flex align-items-center p-2 border rounded shadow-sm"
                        style={{
                          backgroundColor: isSelected ? "#ff8c00" : "#ffa500",
                          borderColor: isSelected ? "#ff8c00" : "#ffa500",
                          color: "#000000",
                          cursor: "pointer",
                        }}
                        onClick={() => handleToggleCheckbox(cat)}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleCheckbox(cat)}
                          style={{ marginRight: "6px", cursor: "pointer" }}
                          onClick={(e) => e.stopPropagation()}
                        />
                        <span
                          className="mb-0 text-truncate"
                          style={{
                            cursor: "pointer",
                            fontSize: "0.8rem",
                            fontWeight: isSelected ? 700 : 500,
                            userSelect: "none",
                            flexGrow: 1,
                            color: "#000000",
                          }}
                          title={cat}
                        >
                          {cat}
                        </span>
                      </div>
                    );
                  })}
              </div>
              {allCategories.filter((cat) =>
                cat.toLowerCase().includes(modalSearch.toLowerCase())
              ).length === 0 && (
                <p className="text-muted text-center small mt-3">
                  No matching categories found.
                </p>
              )}
            </div>

            {/* Modal Footer */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "12px 16px",
                borderTop: "1px solid #dee2e6",
              }}
            >
              <small className="text-muted">
                {selectedCategories.length} of {allCategories.length} categories selected
              </small>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowModal(false)}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
