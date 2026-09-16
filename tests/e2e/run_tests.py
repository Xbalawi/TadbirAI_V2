#!/usr/bin/env python3
"""
Python E2E Test Runner Bridge for Tadbir AI (Fawatir-Root)
Executes the opaque-box test suite via Node.js ESM runner or standalone Python harness.

Usage:
    python tests/e2e/run_tests.py
    python tests/e2e/run_tests.py --tier=1
    python tests/e2e/run_tests.py --tier=2
"""

import sys
import os
import subprocess
import shutil

def main():
    repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
    runner_mjs = os.path.join(repo_root, "tests", "e2e", "run-e2e.mjs")

    node_bin = shutil.which("node")
    if node_bin:
        cmd = [node_bin, runner_mjs] + sys.argv[1:]
        try:
            result = subprocess.run(cmd, cwd=repo_root)
            sys.exit(result.returncode)
        except Exception as e:
            print(f"[ERROR] Failed to invoke node runner: {e}", file=sys.stderr)
            sys.exit(1)
    else:
        print("[WARN] Node.js runtime not found in PATH. Please install Node.js 18+ to execute full ESM E2E suite.", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()
