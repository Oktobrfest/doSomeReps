import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).parent


def remove_changed_comments(text: str, suffix: str) -> str:
    lines = text.splitlines(keepends=True)
    out = []
    i = 0
    n = len(lines)

    while i < n:
        line = lines[i]

        if suffix == ".css":
            # CSS block comment that starts with CHANGED THIS.
            if re.match(r"^\s*/\*\s*CHANGED THIS", line):
                # Remove this and any continuation lines up to the closing */.
                while i < n and "*/" not in lines[i]:
                    i += 1
                if i < n:
                    i += 1  # skip the line containing */
                continue
            out.append(line)
            i += 1
            continue

        # Line comments: # (Python) or // (TypeScript/JavaScript)
        m = re.match(r"^(\s*)(#|//)\s*CHANGED THIS", line)
        if m:
            marker = m.group(2)
            i += 1
            # Drop any immediately following lines that continue the same line-comment style.
            while i < n and re.match(rf"^\s*{re.escape(marker)}", lines[i]):
                i += 1
            continue

        out.append(line)
        i += 1

    return "".join(out)


def process_file(path: Path) -> bool:
    text = path.read_text(encoding="utf-8")
    if "CHANGED THIS" not in text:
        return False

    suffix = path.suffix.lower()
    new_text = remove_changed_comments(text, suffix)

    if new_text != text:
        path.write_text(new_text, encoding="utf-8")
        return True
    return False


def find_files() -> list[Path]:
    exclude_dirs = [
        "node_modules",
        ".git",
        "__pycache__",
        ".venv",
        "piper_voices",
        "vendor",
    ]
    cmd = [
        "grep",
        "-rl",
        "--exclude-dir=" + ",".join(exclude_dirs),
        "CHANGED THIS",
        str(ROOT),
    ]
    result = subprocess.run(
        cmd, capture_output=True, text=True, encoding="utf-8", errors="ignore"
    )
    paths = [Path(p) for p in result.stdout.splitlines() if p.strip()]
    return paths


def main() -> None:
    paths = find_files()
    changed = []
    for path in paths:
        if path.name == "remove_changed_comments.py":
            continue
        try:
            if process_file(path):
                changed.append(path)
        except Exception as e:
            print(f"Error processing {path}: {e}", file=sys.stderr)

    print(f"Updated {len(changed)} file(s):")
    for p in changed:
        print("  ", p.relative_to(ROOT))


if __name__ == "__main__":
    main()
