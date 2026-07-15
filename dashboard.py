#!/usr/bin/env python3
"""Local-only dashboard for running and reviewing lead scraper jobs."""

from __future__ import annotations

import csv
import json
import logging
import os
import subprocess
import sys
import threading
import uuid
from datetime import datetime
from pathlib import Path

from flask import Flask, jsonify, redirect, render_template, request, url_for

from lead_scraper.pricing import build_tiers, recommended_tier
from lead_scraper.config import Settings

ROOT = Path(__file__).resolve().parent
RUNS_DIR = ROOT / "runs"
RUNS_DIR.mkdir(exist_ok=True)
STATE_DIR = Path(os.getenv("LOCALAPPDATA", str(RUNS_DIR))) / "EdgeLandingsDashboard"
JOBS_DIR = STATE_DIR / "jobs"
JOBS_DIR.mkdir(parents=True, exist_ok=True)

app = Flask(__name__)
jobs: dict[str, dict] = {}
processes: dict[str, subprocess.Popen] = {}
jobs_lock = threading.Lock()


def persist_job(job_id: str) -> None:
    """Persist status/log history so dashboard restarts do not erase runs."""
    job_data = jobs.get(job_id)
    if not job_data:
        return
    path = JOBS_DIR / f"{job_id}.json"
    try:
        # State lives outside the OneDrive workspace to avoid sync-client locks.
        # Persistence is helpful, but must never be allowed to stop a scraper.
        path.write_text(json.dumps(job_data, ensure_ascii=False, indent=2), encoding="utf-8")
    except OSError as exc:
        logging.getLogger(__name__).warning("job_history_write_failed: %s", exc)


def load_jobs() -> None:
    for path in sorted(JOBS_DIR.glob("*.json")):
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
            if data.get("status") in {"queued", "running"}:
                data["status"] = "interrupted"
                data["log"] = data.get("log", "") + "\nDashboard restarted before this run reported completion.\n"
            if data.get("id"):
                jobs[data["id"]] = data
        except (OSError, ValueError):
            continue


load_jobs()


def execute_job(job_id: str, command: list[str]) -> None:
    with jobs_lock:
        jobs[job_id]["status"] = "running"
        persist_job(job_id)
    try:
        child_env = os.environ.copy()
        child_env["PYTHONIOENCODING"] = "utf-8"
        process = subprocess.Popen(
            command,
            cwd=ROOT,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            encoding="utf-8",
            errors="replace",
            bufsize=1,
            env=child_env,
        )
        with jobs_lock:
            processes[job_id] = process
            jobs[job_id]["pid"] = process.pid
            persist_job(job_id)
        assert process.stdout is not None
        for line in process.stdout:
            with jobs_lock:
                jobs[job_id]["log"] += line
                persist_job(job_id)
        code = process.wait()
        with jobs_lock:
            if jobs[job_id].get("status") != "stopped":
                jobs[job_id]["status"] = "completed" if code == 0 else "failed"
            jobs[job_id]["return_code"] = code
            persist_job(job_id)
    except Exception as exc:  # Dashboard must remain available if a job cannot launch.
        with jobs_lock:
            jobs[job_id]["status"] = "failed"
            jobs[job_id]["log"] += f"\nCould not launch scraper: {exc}\n"
            persist_job(job_id)
    finally:
        with jobs_lock:
            processes.pop(job_id, None)


def read_csv(path: Path, limit: int = 200) -> tuple[list[str], list[dict[str, str]]]:
    if not path.exists():
        return [], []
    with path.open(encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        columns = reader.fieldnames or []
        rows = [row for _, row in zip(range(limit), reader)]
        # Older exports stored a higher-is-worse problem score plus its inverse
        # in health_score. Normalize them when viewed in the current dashboard.
        if rows and "score_scale" not in columns:
            has_exported_health = "health_score" in columns
            for row in rows:
                try:
                    old_score = int(float(row.get("score", 0)))
                    score = int(float(row.get("health_score", old_score))) if has_exported_health else 100 - old_score
                    row["score"] = str(max(0, min(100, score)))
                    row["recommended_tier"] = recommended_tier(int(row["score"]))
                except (TypeError, ValueError):
                    pass
                row["score_scale"] = "0=worst, 100=excellent"
            columns = [column for column in columns if column != "health_score"]
            columns.append("score_scale")
        if rows and "data_source" not in columns:
            columns.extend(["data_source", "website_evidence"])
            for row in rows:
                source = "OpenStreetMap" if row.get("place_id", "").startswith("osm:") else "Google Places"
                row["data_source"] = source
                if source == "OpenStreetMap":
                    row["rating"] = ""
                    row["review_count"] = ""
                row["website_evidence"] = (
                    f"No website URL listed in {source}; not independently verified"
                    if row.get("bucket") == "NO_WEBSITE"
                    else f"Website URL listed in {source}"
                )
        return columns, rows


def safe_result_file(filename: str) -> Path | None:
    candidate = Path(filename)
    if not filename or candidate.name != filename or candidate.suffix.lower() != ".csv":
        return None
    path = RUNS_DIR / filename
    return path if path.exists() else None


def csv_row_count(path: Path) -> int:
    try:
        with path.open(encoding="utf-8-sig", newline="") as handle:
            return sum(1 for _ in csv.DictReader(handle))
    except OSError:
        return 0


@app.get("/")
def index():
    csv_files = sorted(RUNS_DIR.glob("*.csv"), key=lambda p: p.stat().st_mtime, reverse=True)
    file_options = [{"name": path.name, "rows": csv_row_count(path)} for path in csv_files]
    requested = request.args.get("file", "")
    requested_path = Path(requested) if requested else None
    if requested_path and requested_path.name == requested and requested_path.suffix.lower() == ".csv":
        selected = requested
    else:
        with jobs_lock:
            completed_outputs = [
                item.get("output", "") for item in
                sorted(jobs.values(), key=lambda item: item.get("started", ""), reverse=True)
                if item.get("status") == "completed"
            ]
        selected = next(
            (name for name in completed_outputs if any(
                option["name"] == name and option["rows"] > 0 for option in file_options
            )),
            csv_files[0].name if csv_files else "",
        )
    columns, rows = read_csv(RUNS_DIR / selected) if selected else ([], [])
    with jobs_lock:
        recent_jobs = sorted(jobs.values(), key=lambda item: item.get("started", ""), reverse=True)[:10]
    return render_template(
        "dashboard.html", columns=columns, rows=rows, files=file_options,
        selected=selected, jobs=recent_jobs, google_configured=bool(Settings.load().api_key),
    )


@app.post("/run")
def run_scraper():
    niche = request.form.get("niche", "").strip() or "local businesses"
    discovery_source = request.form.get("discovery_source", "osm")
    if discovery_source not in {"osm", "google"}:
        return "Invalid discovery source.", 400
    if discovery_source == "google" and not Settings.load().api_key:
        return "Google Places requires GOOGLE_PLACES_API_KEY in .env.", 400
    location = request.form.get("location", "").strip()
    if not location:
        return "Location is required.", 400
    try:
        radius = float(request.form.get("radius", "15"))
        max_score = int(request.form.get("max_score", "65"))
        max_results = int(request.form.get("max_results", "10"))
    except ValueError:
        return "Radius, score, and max results must be numbers.", 400
    if radius <= 0 or max_results <= 0 or not 0 <= max_score <= 100:
        return "Invalid numeric range.", 400

    job_id = uuid.uuid4().hex[:8]
    output = RUNS_DIR / f"leads-{datetime.now():%Y%m%d-%H%M%S}-{job_id}.csv"
    command = [
        sys.executable, str(ROOT / "scraper.py"), "--niche", niche,
        "--location", location, "--radius", str(radius), "--max-score",
        str(max_score), "--max-results", str(max_results), "--concurrency", "2",
        "--source", discovery_source, "--output", str(output), "--yes",
    ]
    if request.form.get("with_pitch") == "on":
        command.append("--with-pitch")
    job = {
        "id": job_id, "niche": niche, "location": location, "status": "queued",
        "log": "", "output": output.name, "started": datetime.now().isoformat(timespec="seconds"),
    }
    with jobs_lock:
        jobs[job_id] = job
        persist_job(job_id)
    threading.Thread(target=execute_job, args=(job_id, command), daemon=True).start()
    return redirect(url_for("job", job_id=job_id))


@app.get("/jobs/<job_id>")
def job(job_id: str):
    with jobs_lock:
        data = jobs.get(job_id)
    if data is None:
        return "Job not found", 404
    return render_template("job.html", job=data)


@app.get("/api/jobs/<job_id>")
def job_api(job_id: str):
    with jobs_lock:
        data = dict(jobs.get(job_id, {}))
    return (jsonify(data), 200) if data else (jsonify({"error": "not found"}), 404)


@app.get("/latest-run")
def latest_run():
    with jobs_lock:
        latest = max(jobs.values(), key=lambda item: item.get("started", ""), default=None)
    if latest:
        return redirect(url_for("job", job_id=latest["id"]))
    logs = sorted((ROOT / "logs").glob("*.jsonl"), key=lambda p: p.stat().st_mtime, reverse=True)
    if logs:
        return redirect(url_for("recovered_log", filename=logs[0].name))
    return redirect(url_for("index", _anchor="scan-runs"))


@app.get("/logs/<filename>")
def recovered_log(filename: str):
    candidate = Path(filename)
    path = ROOT / "logs" / filename
    if candidate.name != filename or candidate.suffix != ".jsonl" or not path.exists():
        return "Log not found", 404
    content = path.read_text(encoding="utf-8", errors="replace")
    status = "failed" if '"level": "ERROR"' in content else "completed"
    return render_template("log.html", filename=filename, content=content, status=status)


@app.get("/proposal")
def proposal():
    path = safe_result_file(request.args.get("file", ""))
    place_id = request.args.get("place_id", "")
    if not path:
        return "Result file not found", 404
    _, rows = read_csv(path, limit=1000)
    lead = next((row for row in rows if row.get("place_id") == place_id), None)
    if not lead:
        return "Lead not found", 404
    try:
        website_score = int(float(lead.get("score", 0)))
    except ValueError:
        website_score = 0
    flaws = lead.get("all_flaws") or lead.get("top_flaw", "")
    health, tiers = build_tiers(website_score, flaws, lead.get("category", "local business"))
    return render_template(
        "proposal.html", lead=lead, website_score=website_score, health=health, tiers=tiers,
        recommended=recommended_tier(website_score), filename=path.name,
    )


@app.get("/tiers")
def tiers_overview():
    _, tiers = build_tiers(
        32, "not mobile-friendly|very slow to load|hard to contact|no tracking at all",
        "local business",
    )
    return render_template("tiers.html", tiers=tiers)


@app.post("/jobs/<job_id>/stop")
def stop_job(job_id: str):
    with jobs_lock:
        process = processes.get(job_id)
        job_data = jobs.get(job_id)
    if process and process.poll() is None:
        process.terminate()
        try:
            process.wait(timeout=3)
        except subprocess.TimeoutExpired:
            process.kill()
        with jobs_lock:
            if job_data:
                job_data["status"] = "stopped"
                job_data["log"] += "\nStopped by user.\n"
                persist_job(job_id)
    return redirect(url_for("job", job_id=job_id))


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=8765, debug=False)
