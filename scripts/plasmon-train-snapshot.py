#!/usr/bin/env python3
from __future__ import annotations

import argparse
import datetime as dt
import json
import os
import subprocess
from pathlib import Path
from typing import Any

CONFIG_SCHEMA = "plasmon-train-target-v1"
SNAPSHOT_SCHEMA = "plasmon-train-snapshot-v1"
DESIRE = {"High", "Medium", "Low"}
EFFORT = {"Low", "Medium", "High"}


def load_config(path: Path) -> dict[str, str]:
    try:
        raw = json.loads(path.read_text(encoding="utf-8"))
    except Exception as exc:
        raise SystemExit(f"invalid Train target config {path}: {exc}") from exc
    if not isinstance(raw, dict) or raw.get("schema") != CONFIG_SCHEMA:
        raise SystemExit(f"Train target config must use schema {CONFIG_SCHEMA}")
    target = str(raw.get("target_branch") or "").strip()
    milestone = str(raw.get("milestone") or "").strip()
    prefix = str(raw.get("ci_label_prefix") or "ci:").strip().lower()
    if not target or not milestone or not prefix:
        raise SystemExit("Train target config requires target_branch, milestone, and ci_label_prefix")
    return {"target_branch": target, "milestone": milestone, "ci_label_prefix": prefix}


def label_names(issue: dict[str, Any]) -> list[str]:
    out = []
    for row in issue.get("labels") or []:
        if isinstance(row, str):
            out.append(row)
        elif isinstance(row, dict) and row.get("name"):
            out.append(str(row["name"]))
    return sorted(set(out))


def is_ci_owned(labels: list[str], prefix: str) -> bool:
    prefix = prefix.lower()
    return any(str(label).lower().startswith(prefix) for label in labels)


def choose_related_issue(nodes: list[dict[str, Any]], lane_numbers: set[int], milestone: str) -> int | None:
    matches = []
    for node in nodes:
        number = int(node.get("number") or 0)
        title = str(((node.get("milestone") or {}).get("title")) or "")
        if number in lane_numbers and title == milestone:
            matches.append(number)
    matches = sorted(set(matches))
    if len(matches) > 1:
        raise SystemExit(f"PR has multiple canonical Issues in milestone {milestone}: {matches}")
    return matches[0] if matches else None


def gh(path: str, *args: str) -> Any:
    cmd = ["gh", "api", "--method", "GET", "-H", "X-GitHub-Api-Version: 2026-03-10", path, *args]
    return json.loads(subprocess.check_output(cmd, text=True))


def gh_pages(path: str, params: dict[str, Any] | None = None) -> Any:
    params = params or {}
    page, rows = 1, []
    while True:
        suffix = "&" if "?" in path else "?"
        query = "&".join([*(f"{k}={v}" for k, v in params.items()), "per_page=100", f"page={page}"])
        batch = gh(path + suffix + query)
        if not isinstance(batch, list):
            return batch
        rows.extend(batch)
        if len(batch) < 100:
            return rows
        page += 1


def closing_issue_nodes(repo: str, number: int) -> list[dict[str, Any]]:
    owner, name = repo.split("/", 1)
    query = """
query($owner:String!, $name:String!, $number:Int!) {
  repository(owner:$owner, name:$name) {
    pullRequest(number:$number) {
      closingIssuesReferences(first:50) { nodes { number milestone { title } } }
    }
  }
}
"""
    cmd = [
        "gh", "api", "graphql", "-f", f"query={query}",
        "-F", f"owner={owner}", "-F", f"name={name}", "-F", f"number={number}",
    ]
    row = json.loads(subprocess.check_output(cmd, text=True))
    pr = (((row.get("data") or {}).get("repository") or {}).get("pullRequest") or {})
    return list(((pr.get("closingIssuesReferences") or {}).get("nodes")) or [])


def field_values(repo: str, number: int) -> tuple[dict[str, str], str | None]:
    try:
        rows = gh_pages(f"repos/{repo}/issues/{number}/issue-field-values")
    except Exception as exc:
        return {}, f"field-values-unavailable:{type(exc).__name__}"
    out = {}
    for row in rows if isinstance(rows, list) else []:
        name = row.get("issue_field_name")
        option = row.get("single_select_option") or {}
        if name and option.get("name"):
            out[str(name)] = str(option["name"])
    return out, None


def latest_check_runs(repo: str, head_sha: str) -> list[dict[str, Any]]:
    payload = gh(f"repos/{repo}/commits/{head_sha}/check-runs?filter=latest&per_page=100")
    best: dict[str, dict[str, Any]] = {}
    for run in payload.get("check_runs") or []:
        name = str(run.get("name") or "")
        if name not in best or int(run.get("id") or 0) > int(best[name].get("id") or 0):
            best[name] = run
    return list(best.values())


def ci_state(checks: list[dict[str, Any]]) -> str:
    if not checks:
        return "pending"
    failed = [x for x in checks if str(x.get("status") or "").lower() == "completed" and str(x.get("conclusion") or "").lower() not in {"success", "skipped", "neutral"}]
    if failed:
        names = {str(x.get("name") or "").lower() for x in failed}
        if names and all("flake" in n for n in names):
            return "flake"
        if names and all("inherited" in n for n in names):
            return "inherited_failure"
        if names and all("infra" in n or "infrastructure" in n for n in names):
            return "infra_failure"
        return "unknown_red"
    if any(str(x.get("status") or "").lower() != "completed" for x in checks):
        return "running"
    return "green"


def flake_evidence(checks: list[dict[str, Any]], head_sha: str, changed_files: set[str] | None) -> dict[str, Any] | None:
    for run in checks:
        if "flake" not in str(run.get("name") or "").lower():
            continue
        output = run.get("output") or {}
        text = "\n".join(str(output.get(k) or "") for k in ("summary", "text"))
        for line in text.splitlines():
            if not line.startswith("PLASMON_FLAKE_EVIDENCE="):
                continue
            try:
                row = json.loads(line.split("=", 1)[1])
            except Exception:
                continue
            if not isinstance(row, dict):
                continue
            test = str(row.get("test") or "").strip()
            producer_modified = row.get("modified_in_pr")
            if producer_modified is None:
                if changed_files is None or not test:
                    modified = None
                else:
                    matched = any(path and (test == path or test.startswith(path + "::") or test.startswith(path + ":") or path in test) for path in changed_files)
                    modified = True if matched else (False if "/" in test else None)
            else:
                modified = bool(producer_modified)
            return {
                "head_matches": str(row.get("head_sha") or "") == head_sha,
                "complete": bool(row.get("complete")),
                "infrastructure_collapse": bool(row.get("infrastructure_collapse")),
                "test": row.get("test"),
                "passes": int(row.get("passes") or 0),
                "failures": int(row.get("failures") or 0),
                "independent_confirmation": bool(row.get("independent_confirmation")),
                "characterization_iterations": int(row.get("characterization_iterations") or 0),
                "modified_in_pr": modified,
                "independent_from_pr": bool(row.get("independent_from_pr") or row.get("preexisting_canonical_flake")),
                "source_check": run.get("name"),
                "source_url": run.get("details_url"),
            }
    return None


def review_facts(repo: str, number: int, head_sha: str) -> tuple[str, dict[str, Any] | None]:
    reviews = gh_pages(f"repos/{repo}/pulls/{number}/reviews")
    latest: dict[str, dict[str, Any]] = {}
    for row in reviews:
        user = str((row.get("user") or {}).get("login") or (row.get("user") or {}).get("id") or "unknown")
        if int(row.get("id") or 0) >= int((latest.get(user) or {}).get("id") or 0):
            latest[user] = row
    blocking = [x for x in latest.values() if str(x.get("state") or "").upper() == "CHANGES_REQUESTED"]
    blocking.sort(key=lambda x: int(x.get("id") or 0), reverse=True)
    blocker = blocking[0] if blocking else None
    exact = [x for x in latest.values() if str(x.get("commit_id") or "") == head_sha]
    review = "changes_requested" if blocker else ("approved" if any(str(x.get("state") or "").upper() == "APPROVED" for x in exact) else "pending")
    normalized = None if not blocker else {"id": blocker.get("id"), "state": blocker.get("state"), "commit_id": blocker.get("commit_id"), "body": blocker.get("body") or "", "user": (blocker.get("user") or {}).get("login")}
    return review, normalized


def build_snapshot(repo: str, config: dict[str, str], generation: str) -> dict[str, Any]:
    target, milestone_title, prefix = config["target_branch"], config["milestone"], config["ci_label_prefix"]
    milestones = gh_pages(f"repos/{repo}/milestones", {"state": "all"})
    milestone = next((x for x in milestones if x.get("title") == milestone_title), None)
    if not milestone:
        raise SystemExit(f"configured milestone {milestone_title!r} not found")
    try:
        target_ref = gh(f"repos/{repo}/git/ref/heads/{target.replace('/', '%2F')}")
    except Exception as exc:
        raise SystemExit(f"configured target branch {target!r} not found") from exc
    target_sha = target_ref["object"]["sha"]
    raw_issues = gh_pages(f"repos/{repo}/issues", {"milestone": milestone["number"], "state": "all", "direction": "asc"})
    raw_issues = [x for x in raw_issues if "pull_request" not in x]
    lane_numbers = {int(x["number"]) for x in raw_issues}
    raw_prs = gh_pages(f"repos/{repo}/pulls", {"state": "open", "sort": "created", "direction": "asc"})
    pr_to_issue: dict[int, int] = {}
    for pr in raw_prs:
        number = int(pr["number"])
        linked = choose_related_issue(closing_issue_nodes(repo, number), lane_numbers, milestone_title)
        if linked is not None:
            pr_to_issue[number] = linked
    issue_to_pr = {issue: pr for pr, issue in pr_to_issue.items()}
    open_pr_heads = {str(pr.get("head", {}).get("ref") or "") for pr in raw_prs}

    dependency_map: dict[int, list[int]] = {}
    dependency_states: dict[int, dict[str, str]] = {}
    for issue in raw_issues:
        number = int(issue["number"])
        try:
            deps = gh_pages(f"repos/{repo}/issues/{number}/dependencies/blocked_by")
        except Exception:
            deps = []
        nums, states = [], {}
        for dep in deps if isinstance(deps, list) else []:
            if dep.get("number") is None:
                continue
            n = int(dep["number"])
            nums.append(n)
            states[str(n)] = str(dep.get("state") or "unknown")
        dependency_map[number] = sorted(set(nums))
        dependency_states[number] = states
    unlocks = {int(x["number"]): 0 for x in raw_issues}
    for deps in dependency_map.values():
        for parent in deps:
            if parent in unlocks:
                unlocks[parent] += 1

    issues = []
    for raw in raw_issues:
        number = int(raw["number"])
        fields, field_error = field_values(repo, number)
        labs = label_names(raw)
        ci_owned = is_ci_owned(labs, prefix)
        deps, states = dependency_map[number], dependency_states[number]
        dependencies_ready = all(str(states.get(str(n), "unknown")).lower() in {"closed", "completed", "merged", "integrated", "superseded", "waived"} for n in deps)
        desire, effort = fields.get("Desire"), fields.get("Effort")
        errors = []
        if field_error:
            errors.append(field_error)
        if not desire:
            errors.append("missing-desire")
        elif desire not in DESIRE:
            errors.append(f"invalid-desire:{desire}")
        if not effort:
            errors.append("missing-effort")
        elif effort not in EFFORT:
            errors.append(f"invalid-effort:{effort}")
        issues.append({
            "number": number, "title": raw.get("title") or "", "open": str(raw.get("state") or "open").lower() == "open",
            "product": not ci_owned, "ci_owned": ci_owned,
            "assignees": [x.get("login") for x in raw.get("assignees") or [] if x.get("login")], "labels": labs,
            "priority": fields.get("Priority"), "desire": desire, "effort": effort, "area": fields.get("Area"),
            "type": (raw.get("type") or {}).get("name") if isinstance(raw.get("type"), dict) else raw.get("type"),
            "scheduling_metadata": {"valid": not errors, "errors": errors},
            "blocked_by": deps, "dependency_states": states, "dependencies_ready": dependencies_ready, "unlocks": unlocks.get(number, 0),
            "open_pr": issue_to_pr.get(number), "url": raw.get("html_url"), "updated_at": raw.get("updated_at"),
        })
    issue_rows = {int(x["number"]): x for x in issues}

    prs = []
    for raw in raw_prs:
        number, issue = int(raw["number"]), pr_to_issue.get(int(raw["number"]))
        if issue is None:
            continue
        detail = gh(f"repos/{repo}/pulls/{number}")
        head_sha, base = detail["head"]["sha"], detail["base"]["ref"]
        checks = latest_check_runs(repo, head_sha)
        ci = ci_state(checks)
        changed_files: set[str] | None = None
        if ci == "flake":
            try:
                changed_files = {str(x.get("filename") or "") for x in gh_pages(f"repos/{repo}/pulls/{number}/files")}
            except Exception:
                pass
        mergeable_state = str(detail.get("mergeable_state") or "unknown").lower()
        conflict = detail.get("mergeable") is False and mergeable_state == "dirty"
        review, blocker = review_facts(repo, number, head_sha)
        issue_row = issue_rows[issue]
        prs.append({
            "number": number, "issue": issue, "title": detail.get("title") or "", "state": "open", "head": head_sha,
            "head_branch": detail["head"]["ref"], "base": base, "base_valid": base == target or base in open_pr_heads,
            "draft": bool(detail.get("draft")), "product": bool(issue_row["product"]), "ci_owned": bool(issue_row["ci_owned"]),
            "conflict": bool(conflict), "mergeable": detail.get("mergeable"), "mergeable_state": mergeable_state,
            "review": review, "blocking_review": blocker, "ci": ci, "flake_evidence": flake_evidence(checks, head_sha, changed_files),
            "changed_test_files": sorted(x for x in (changed_files or set()) if x.startswith("test/")),
            "checks": [{"name": x.get("name"), "status": x.get("status"), "conclusion": x.get("conclusion"), "url": x.get("details_url")} for x in checks],
            "url": detail.get("html_url"), "updated_at": detail.get("updated_at"),
        })

    return {
        "schema": SNAPSHOT_SCHEMA,
        "captured_at": dt.datetime.now(dt.timezone.utc).isoformat().replace("+00:00", "Z"),
        "repo": repo, "target": target, "target_sha": target_sha, "milestone": milestone_title, "generation": generation,
        "issues": issues, "prs": prs,
        "counts": {
            "issues": len(issues), "open_issues": sum(1 for x in issues if x["open"]),
            "open_product_prs": sum(1 for x in prs if x["product"]), "open_ci_prs": sum(1 for x in prs if x["ci_owned"]),
            "invalid_scheduling_metadata": sum(bool(x["scheduling_metadata"]["errors"]) for x in issues if x["open"]),
        },
    }


def self_test() -> None:
    import tempfile
    with tempfile.TemporaryDirectory() as td:
        p = Path(td) / "config.json"
        p.write_text(json.dumps({"schema": CONFIG_SCHEMA, "target_branch": "release/example", "milestone": "example", "ci_label_prefix": "ci:"}), encoding="utf-8")
        cfg = load_config(p)
        assert cfg["target_branch"] == "release/example"
    assert is_ci_owned(["type: bug", "ci:flaky"], "ci:")
    assert not is_ci_owned(["[r3 CI]", "type: bug"], "ci:")
    nodes = [{"number": 10, "milestone": {"title": "example"}}, {"number": 11, "milestone": {"title": "other"}}]
    assert choose_related_issue(nodes, {10, 11}, "example") == 10
    assert choose_related_issue(nodes, {11}, "example") is None
    try:
        choose_related_issue([{"number": 10, "milestone": {"title": "example"}}, {"number": 12, "milestone": {"title": "example"}}], {10, 12}, "example")
        raise AssertionError("ambiguous relation should fail closed")
    except SystemExit:
        pass
    print("PASS")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--config", type=Path, default=Path(".train/config.json"))
    parser.add_argument("--output", type=Path, default=Path(".train/snapshot.json"))
    parser.add_argument("--repo", default=os.environ.get("GITHUB_REPOSITORY", "plasmon-cloud/plasmon"))
    parser.add_argument("--generation", default=os.environ.get("GITHUB_SHA", "manual"))
    parser.add_argument("--self-test", action="store_true")
    args = parser.parse_args()
    if args.self_test:
        self_test()
        return
    config = load_config(args.config)
    snapshot = build_snapshot(args.repo, config, args.generation)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(snapshot, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(f"wrote {args.output} with {len(snapshot['issues'])} issues and {len(snapshot['prs'])} lane PRs")


if __name__ == "__main__":
    main()
