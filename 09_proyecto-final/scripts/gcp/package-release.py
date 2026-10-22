"""Create and verify a source-only VM release using Python's standard library.

Run from any directory with Python 3.12. The archive and its SHA-256 manifest
are written under .git/runtime/gcp/releases/<UTC timestamp>. No environment
files, local credentials, build output or installed dependencies are read.
"""

import gzip
import hashlib
import io
import json
import os
import stat
import sys
import tarfile
from datetime import UTC, datetime
from pathlib import Path, PurePosixPath

REQUIRED_FILES = (
    "docker-compose.prod.yml",
    "docker-compose.demo.yml",
    "docker-compose.cloud-run.yml",
    "Caddyfile",
    "Caddyfile.cloud-run-origin",
    "scripts/gcp/cloud-run/Dockerfile",
    "scripts/gcp/cloud-run/Caddyfile",
    "backend/Dockerfile",
    "backend/.dockerignore",
    "backend/pyproject.toml",
    "backend/uv.lock",
    "backend/alembic.ini",
    "frontend/Dockerfile",
    "frontend/.dockerignore",
    "frontend/package.json",
    "frontend/pnpm-lock.yaml",
    "frontend/pnpm-workspace.yaml",
    "frontend/next.config.ts",
    "frontend/tsconfig.json",
    "frontend/eslint.config.mjs",
    "simulator/Dockerfile",
    "simulator/.dockerignore",
    "simulator/requirements.txt",
    "simulator/machines.yaml",
)
OPTIONAL_FILES = ("frontend/next-env.d.ts",)
REQUIRED_TREES = (
    "backend/app",
    "backend/alembic",
    "frontend/src",
    "frontend/messages",
    "frontend/public",
    "simulator/oee_simulator",
)
EXCLUDED_COMPONENTS = frozenset(
    {
        ".git",
        ".hg",
        ".svn",
        ".venv",
        "venv",
        "node_modules",
        ".next",
        "__pycache__",
        ".pytest_cache",
        ".ruff_cache",
        ".mypy_cache",
        ".cache",
        ".tox",
        ".pnpm-store",
        "tests",
        "__tests__",
        "coverage",
        "htmlcov",
        "test-results",
        "playwright-report",
        "uploads",
        "data",
        "dist",
        "build",
        ".npmrc",
        ".pypirc",
        ".netrc",
        "application_default_credentials.json",
    }
)
EXCLUDED_PREFIXES = (
    ".env",
    ".coverage",
    "credentials",
    "service-account",
    "service_account",
    "id_rsa",
    "id_ed25519",
)
EXCLUDED_SUFFIXES = (
    ".pyc",
    ".pyo",
    ".tsbuildinfo",
    ".log",
    ".pem",
    ".key",
    ".p12",
    ".pfx",
    ".db",
    ".sqlite",
    ".sqlite3",
)


class ReleaseError(Exception):
    """A release is incomplete, unsafe, or changed while being collected."""


def excluded(parts: tuple[str, ...]) -> bool:
    for component in parts:
        name = component.casefold()
        if name in EXCLUDED_COMPONENTS or name.startswith(EXCLUDED_PREFIXES):
            return True
        if ".test." in name or ".spec." in name or name.endswith(EXCLUDED_SUFFIXES):
            return True
        if name.startswith("test_") and name.endswith(".py"):
            return True
    return False


def allowed_member(name: str) -> bool:
    path = PurePosixPath(name)
    if (
        not name
        or "\\" in name
        or ":" in name
        or path.is_absolute()
        or any(part in {"", ".", ".."} for part in name.split("/"))
        or excluded(path.parts)
    ):
        return False
    if name in (*REQUIRED_FILES, *OPTIONAL_FILES):
        return True
    if any(name.startswith(tree + "/") for tree in REQUIRED_TREES):
        return True
    return str(path.parent) == "scripts/gcp" and path.suffix in {".py", ".sh"}


def no_links(root: Path, candidate: Path) -> None:
    """Reject symlinks/junctions before resolving any selected source or destination."""
    try:
        relative = candidate.relative_to(root)
    except ValueError:
        raise ReleaseError("A selected path is outside the repository") from None
    cursor = root
    for part in (None, *relative.parts):
        if part is not None:
            cursor /= part
        if cursor.is_symlink() or cursor.is_junction():
            raise ReleaseError("Links and junctions are not allowed in a release path")


def source_paths(root: Path) -> list[Path]:
    no_links(root, root)
    chosen = set()
    for relative in REQUIRED_FILES:
        path = root / relative
        no_links(root, path)
        if not path.is_file():
            raise ReleaseError(f"Required release file is missing: {relative}")
        chosen.add(path)
    for relative in OPTIONAL_FILES:
        path = root / relative
        no_links(root, path)
        if path.exists():
            if not path.is_file():
                raise ReleaseError("An optional release file is not a regular file")
            chosen.add(path)
    for relative in REQUIRED_TREES:
        tree = root / relative
        no_links(root, tree)
        if not tree.is_dir():
            raise ReleaseError(f"Required release directory is missing: {relative}")
        for directory, subdirs, files in os.walk(tree, followlinks=False):
            current = Path(directory)
            subdirs[:] = sorted(name for name in subdirs if not excluded((name,)))
            for name in subdirs:
                no_links(root, current / name)
            for name in files:
                if not excluded((name,)):
                    chosen.add(current / name)
    scripts = root / "scripts/gcp"
    no_links(root, scripts)
    if not scripts.is_dir():
        raise ReleaseError("The VM scripts directory is missing")
    for path in scripts.iterdir():
        if path.suffix in {".py", ".sh"} and not excluded((path.name,)):
            chosen.add(path)
    result = sorted(chosen, key=lambda path: path.relative_to(root).as_posix())
    for path in result:
        no_links(root, path)
        if not stat.S_ISREG(path.stat().st_mode):
            raise ReleaseError("Only regular source files may be packaged")
        if not allowed_member(path.relative_to(root).as_posix()):
            raise ReleaseError("A selected source is outside the release allowlist")
    return result


def signature(path: Path) -> tuple[int, int, int]:
    value = path.stat()
    return value.st_size, value.st_mtime_ns, value.st_ino


def collect(root: Path) -> tuple[list[dict], dict[str, bytes]]:
    paths = source_paths(root)
    before = {path: signature(path) for path in paths}
    entries, contents = [], {}
    for path in paths:
        no_links(root, path)
        name = path.relative_to(root).as_posix()
        data = path.read_bytes()
        contents[name] = data
        entries.append(
            {"path": name, "size": len(data), "sha256": hashlib.sha256(data).hexdigest()}
        )
    if paths != source_paths(root) or any(signature(path) != before[path] for path in paths):
        raise ReleaseError("Release sources changed during packaging; run the command again")
    return entries, contents


def verify(archive: Path, entries: list[dict]) -> None:
    expected = {entry["path"]: entry for entry in entries}
    seen = set()
    with tarfile.open(archive, mode="r:gz") as source:
        for member in source:
            if not member.isfile() or not allowed_member(member.name) or member.name in seen:
                raise ReleaseError("Archive contains a forbidden or duplicate member")
            seen.add(member.name)
            entry = expected.get(member.name)
            if entry is None or member.size != entry["size"]:
                raise ReleaseError("Archive members do not match the manifest")
            stream = source.extractfile(member)
            if stream is None:
                raise ReleaseError("Archive member could not be verified")
            with stream:
                digest = hashlib.file_digest(stream, "sha256").hexdigest()
            if digest != entry["sha256"]:
                raise ReleaseError("Archive content does not match the manifest hash")
    if seen != set(expected) or not set(REQUIRED_FILES) <= seen:
        raise ReleaseError("Archive is missing required source files")


def create_release(root: Path) -> dict:
    root = root.absolute()
    entries, contents = collect(root)
    created = datetime.now(UTC)
    destination = root / ".git/runtime/gcp/releases" / created.strftime("%Y%m%dT%H%M%S%fZ")
    no_links(root, destination)
    destination.mkdir(parents=True, exist_ok=False)
    archive = destination / "oee-release.tar.gz"
    manifest = destination / "manifest.json"
    with archive.open("xb") as output:
        with gzip.GzipFile(fileobj=output, filename="", mode="wb", mtime=0) as compressed:
            with tarfile.open(fileobj=compressed, mode="w", format=tarfile.PAX_FORMAT) as bundle:
                for entry in entries:
                    member = tarfile.TarInfo(entry["path"])
                    member.size = entry["size"]
                    member.mode = 0o755 if entry["path"].endswith(".sh") else 0o644
                    member.mtime = 0
                    bundle.addfile(member, io.BytesIO(contents[entry["path"]]))
    verify(archive, entries)
    with archive.open("rb") as stream:
        digest = hashlib.file_digest(stream, "sha256").hexdigest()
    document = {
        "format": 1,
        "created_at": created.isoformat(),
        "archive": {"name": archive.name, "size": archive.stat().st_size, "sha256": digest},
        "files": entries,
    }
    with manifest.open("x", encoding="utf-8", newline="\n") as stream:
        json.dump(document, stream, ensure_ascii=False, indent=2)
        stream.write("\n")
    return {
        "file_count": len(entries),
        "source_bytes": sum(entry["size"] for entry in entries),
        "archive_bytes": archive.stat().st_size,
        "archive_path": str(archive),
        "manifest_path": str(manifest),
        "sha256": digest,
    }


if __name__ == "__main__":
    try:
        result = create_release(Path(__file__).absolute().parents[2])
    except (ReleaseError, OSError, tarfile.TarError) as error:
        raise SystemExit(f"Release packaging failed: {error}") from None
    json.dump(result, sys.stdout, ensure_ascii=False)
    sys.stdout.write("\n")
