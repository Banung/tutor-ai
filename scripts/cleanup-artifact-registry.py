#!/usr/bin/env python3
"""Keep recent SHA-tagged deployment images and remove older digests."""

import json
import os
import re
import subprocess
import sys
from datetime import datetime
from typing import Optional


IMAGE_BASE = os.environ["IMAGE_BASE"]
PROJECT_ID = os.environ["PROJECT_ID"]
CURRENT_SHA = os.environ["GITHUB_SHA"]
KEEP_COUNT = int(os.environ.get("ARTIFACT_REGISTRY_KEEP_COUNT", "10"))
SHA_TAG = re.compile(r"^[0-9a-f]{40}$")


def image_uri(image: dict) -> Optional[str]:
    uri = image.get("uri")
    if isinstance(uri, str) and uri.strip():
        return uri.strip()

    # Recent gcloud output omits `uri` and splits it into package + version.
    package = image.get("package")
    version = image.get("version")
    if isinstance(package, str) and package.strip() and isinstance(version, str) and version.strip():
        package = package.strip().rstrip("/")
        version = version.strip().lstrip("@")
        return f"{package}@{version}"

    metadata = image.get("metadata")
    resource_name = metadata.get("name") if isinstance(metadata, dict) else None
    if not isinstance(resource_name, str):
        return None

    prefix, separator, image_version = resource_name.partition("/dockerImages/")
    parts = prefix.split("/")
    if (
        not separator
        or "@" not in image_version
        or len(parts) != 6
        or parts[0] != "projects"
        or parts[2] != "locations"
        or parts[4] != "repositories"
    ):
        return None

    project_id, location, repository = parts[1], parts[3], parts[5]
    return f"{location}-docker.pkg.dev/{project_id}/{repository}/{image_version}"


def parse_upload_time(image: dict) -> datetime:
    value = image.get("uploadTime") or image.get("createTime")
    if not value:
        raise ValueError(f"Image has no upload timestamp: {image.get('uri', image)}")
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


def delete_image(uri: str) -> bool:
    command = [
        "gcloud",
        "artifacts",
        "docker",
        "images",
        "delete",
        uri,
        "--delete-tags",
        "--quiet",
        f"--project={PROJECT_ID}",
    ]
    result = subprocess.run(command, capture_output=True, text=True)
    if result.returncode == 0:
        if result.stderr:
            print(result.stderr, file=sys.stderr, end="", flush=True)
        return True

    error_output = f"{result.stdout}\n{result.stderr}"
    if (
        "manifest is referenced by parent manifests" in error_output
        or "manifest has referenced parents" in error_output
    ):
        return False

    if (
        "PERMISSION_DENIED" in error_output
        and "artifactregistry.versions.delete" in error_output
    ):
        if result.stderr:
            print(result.stderr, file=sys.stderr, end="", flush=True)
        print(
            "Warning: Artifact Registry cleanup stopped because the deploy "
            "service account lacks artifactregistry.versions.delete. Older "
            "images may remain; grant this permission on the repository to "
            "enable cleanup.",
            file=sys.stderr,
            flush=True,
        )
        raise SystemExit(0)

    if result.stdout:
        print(result.stdout, end="", flush=True)
    if result.stderr:
        print(result.stderr, end="", file=sys.stderr, flush=True)
    result.check_returncode()
    return False


for image_name in ("web", "worker"):
    image_path = f"{IMAGE_BASE}/{image_name}"
    result = subprocess.run(
        [
            "gcloud",
            "artifacts",
            "docker",
            "images",
            "list",
            image_path,
            "--include-tags",
            "--format=json",
            f"--project={PROJECT_ID}",
        ],
        check=True,
        capture_output=True,
        text=True,
    )
    images = json.loads(result.stdout)

    # Keep any image with a non-SHA tag, since it may be managed outside this workflow.
    candidates = []
    for image in images:
        tags = image.get("tags") or []
        if any(not SHA_TAG.fullmatch(tag) for tag in tags):
            continue
        uri = image_uri(image)
        if not uri:
            raise ValueError(f"Artifact Registry returned an image without a usable URI: {image}")
        candidates.append((parse_upload_time(image), uri, tags))

    candidates.sort(key=lambda candidate: candidate[0], reverse=True)
    keep_uris = {uri for _, uri, _ in candidates[:KEEP_COUNT]}
    # Protect this workflow's just-published image even if listing order is unexpected.
    keep_uris.update(
        uri
        for _, uri, tags in candidates
        if CURRENT_SHA in tags
    )

    pending_uris = [uri for _, uri, _ in candidates if uri not in keep_uris]
    while pending_uris:
        deferred_uris = []
        deleted_any = False

        for uri in pending_uris:
            print(f"Deleting old Artifact Registry image: {uri}", flush=True)
            if delete_image(uri):
                deleted_any = True
            else:
                print(
                    f"Deferring image while a parent manifest references it: {uri}",
                    flush=True,
                )
                deferred_uris.append(uri)

        if not deferred_uris:
            break

        if not deleted_any:
            for uri in deferred_uris:
                print(
                    f"Keeping image while it is referenced by a parent manifest: {uri}",
                    flush=True,
                )
            break

        pending_uris = deferred_uris

