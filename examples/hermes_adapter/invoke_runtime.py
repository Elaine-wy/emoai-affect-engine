import json
import pathlib
import subprocess
import sys


def main() -> int:
    package_root = pathlib.Path(__file__).resolve().parents[2]
    runtime = package_root / "src" / "runtime.js"
    payload = json.load(sys.stdin)
    completed = subprocess.run(
        ["node", str(runtime)],
        input=json.dumps(payload),
        text=True,
        capture_output=True,
        check=False,
    )
    if completed.returncode != 0:
        sys.stderr.write(completed.stderr)
        return completed.returncode
    sys.stdout.write(completed.stdout)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
