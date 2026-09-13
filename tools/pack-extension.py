#!/usr/bin/env python3
"""Rebuild the published Chrome-extension downloads from extension/.

    python3 tools/pack-extension.py

static/extension.zip stores files at the archive ROOT, so a user extracts it and points
Chrome's "Load unpacked" at the folder. static/extension.tar.gz keeps the extension/
prefix. Keep both layouts — the /extension page links the zip.

Python rather than `zip`: the production host has no zip binary.

`npm run build` refuses to run while these are stale (tools/check-extension-fresh.mjs),
because the zip is what /extension actually hands people and it has silently shipped an
older Facebook scraper than the repo before.
"""
import os
import tarfile
import zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "extension")
ZIP = os.path.join(ROOT, "static", "extension.zip")
TGZ = os.path.join(ROOT, "static", "extension.tar.gz")


def source_files():
    found = []
    for dirpath, dirnames, filenames in os.walk(SRC):
        dirnames[:] = sorted(d for d in dirnames if not d.startswith("."))
        for name in sorted(filenames):
            if name.startswith("."):
                continue
            full = os.path.join(dirpath, name)
            found.append((full, os.path.relpath(full, SRC).replace(os.sep, "/")))
    return sorted(found, key=lambda pair: pair[1])


def main():
    files = source_files()
    if not files:
        raise SystemExit("no files found in %s" % SRC)

    with zipfile.ZipFile(ZIP, "w", zipfile.ZIP_DEFLATED) as z:
        for full, rel in files:
            z.write(full, rel)

    with tarfile.open(TGZ, "w:gz") as t:
        t.add(SRC, arcname="extension")

    print("packed %d files" % len(files))
    for _, rel in files:
        print("  " + rel)
    print("-> %s" % os.path.relpath(ZIP, ROOT))
    print("-> %s" % os.path.relpath(TGZ, ROOT))


if __name__ == "__main__":
    main()
