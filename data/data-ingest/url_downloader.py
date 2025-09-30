from __future__ import annotations

import hashlib
import os
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable, Optional, Tuple, List, Dict
from urllib.parse import urlparse, unquote

import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry


@dataclass
class DownloadResult:
    url: str
    ok: bool
    path: Optional[Path]            # Local file path if ok=True
    bytes_written: int
    http_status: Optional[int]
    content_type: Optional[str]
    error: Optional[str]


class URLDownloader:
    """
    Robust URL downloader.

    - Streams downloads to avoid large memory usage.
    - Optional max file size guard (via HEAD before GET and during stream).
    - Retries on transient errors (5xx/429 and connect/read errors).
    - Derives filenames from Content-Disposition or URL path; falls back to SHA8.
    - Produces unique, sanitized filenames; never silently overwrites.
    """

    SAFE_FILENAME_RE = re.compile(r"[^A-Za-z0-9._\- ]+")

    def __init__(
        self,
        out_dir: str | Path,
        *,
        max_file_bytes: int = 50 * 1024 * 1024,  # 50MB
        timeout: Tuple[float, float] = (10.0, 30.0),  # (connect, read)
        retries: int = 3,
        backoff_factor: float = 0.5,
        user_agent: str = "URLDownloader/1.0 (+https://example.com)",
        verify_tls: bool = True,
        max_workers: int = 0,  # 0 or 1 = serial; >1 enables ThreadPool in download_all
    ) -> None:
        self.out_dir = Path(out_dir)
        self.out_dir.mkdir(parents=True, exist_ok=True)
        self.max_file_bytes = int(max_file_bytes)
        self.timeout = timeout
        self.verify_tls = verify_tls
        self.max_workers = max_workers if max_workers and max_workers > 1 else 0

        self.session = requests.Session()
        retry = Retry(
            total=retries,
            connect=retries,
            read=retries,
            status=retries,
            backoff_factor=backoff_factor,
            status_forcelist=(429, 500, 502, 503, 504),
            allowed_methods=frozenset(["HEAD", "GET"]),
            raise_on_status=False,
        )
        adapter = HTTPAdapter(max_retries=retry, pool_connections=20, pool_maxsize=20)
        self.session.mount("http://", adapter)
        self.session.mount("https://", adapter)
        self.session.headers.update({"User-Agent": user_agent})

    # -------------------- public API --------------------

    def download_all(self, urls: Iterable[str]) -> List[DownloadResult]:
        """
        Download all URLs. If max_workers > 1, uses threads.
        """
        url_list = [u for u in urls if u and u.strip()]
        if not url_list:
            return []

        if self.max_workers > 1:
            from concurrent.futures import ThreadPoolExecutor, as_completed

            results: List[DownloadResult] = []
            with ThreadPoolExecutor(max_workers=self.max_workers) as ex:
                fut_map = {ex.submit(self.download_one, u): u for u in url_list}
                for fut in as_completed(fut_map):
                    try:
                        results.append(fut.result())
                    except Exception as e:
                        # Fallback result if something went very wrong outside download_one
                        u = fut_map[fut]
                        results.append(
                            DownloadResult(
                                url=u, ok=False, path=None, bytes_written=0,
                                http_status=None, content_type=None, error=str(e)
                            )
                        )
            return results
        else:
            return [self.download_one(u) for u in url_list]

    def download_one(self, url: str) -> DownloadResult:
        """
        Download a single URL to out_dir. Returns a DownloadResult.
        """
        url = url.strip()
        parsed = urlparse(url)
        if parsed.scheme not in ("http", "https"):
            return DownloadResult(
                url=url, ok=False, path=None, bytes_written=0,
                http_status=None, content_type=None, error="Unsupported URL scheme"
            )

        # HEAD: size sanity + content-type
        content_length = None
        content_type = None
        http_status_head = None
        try:
            h = self.session.head(url, allow_redirects=True, timeout=self.timeout, verify=self.verify_tls)
            http_status_head = h.status_code
            if "Content-Length" in h.headers and h.headers["Content-Length"].isdigit():
                content_length = int(h.headers["Content-Length"])
            content_type = _normalize_content_type(h.headers.get("Content-Type"))
            # Size check prior to GET
            if content_length is not None and content_length > self.max_file_bytes:
                return DownloadResult(
                    url=url, ok=False, path=None, bytes_written=0,
                    http_status=http_status_head, content_type=content_type,
                    error=f"File too large ({content_length} bytes > {self.max_file_bytes})"
                )
        except Exception:
            # HEAD can fail for some servers; proceed to GET anyway.
            pass

        # GET stream
        try:
            with self.session.get(url, stream=True, allow_redirects=True,
                                  timeout=self.timeout, verify=self.verify_tls) as r:
                http_status_get = r.status_code
                r.raise_for_status()

                # Prefer Content-Type from GET if present
                ct_get = _normalize_content_type(r.headers.get("Content-Type"))
                content_type = ct_get or content_type

                # Derive filename
                name_from_cd = _filename_from_content_disposition(r.headers.get("Content-Disposition", ""))
                filename = self._derive_filename(url, name_from_cd)
                path = self._unique_path(filename)

                # Stream to disk with size guard
                bytes_written = 0
                with open(path, "wb") as f:
                    for chunk in r.iter_content(chunk_size=64 * 1024):
                        if not chunk:
                            continue
                        bytes_written += len(chunk)
                        if bytes_written > self.max_file_bytes:
                            # Stop early and remove the partial file
                            f.close()
                            try:
                                path.unlink(missing_ok=True)
                            finally:
                                return DownloadResult(
                                    url=url, ok=False, path=None, bytes_written=bytes_written,
                                    http_status=http_status_get, content_type=content_type,
                                    error=f"File exceeded max size while downloading (> {self.max_file_bytes} bytes)"
                                )
                        f.write(chunk)

                return DownloadResult(
                    url=url, ok=True, path=path, bytes_written=bytes_written,
                    http_status=http_status_get, content_type=content_type, error=None
                )

        except requests.HTTPError as e:
            status = getattr(e.response, "status_code", None)
            return DownloadResult(
                url=url, ok=False, path=None, bytes_written=0,
                http_status=status, content_type=content_type, error=str(e)
            )
        except Exception as e:
            return DownloadResult(
                url=url, ok=False, path=None, bytes_written=0,
                http_status=None, content_type=content_type, error=str(e)
            )

    # -------------------- helpers --------------------

    def _derive_filename(self, url: str, cd_name: Optional[str]) -> str:
        """
        Choose a safe filename based on (1) Content-Disposition, (2) URL path, (3) sha8 fallback.
        """
        if cd_name:
            candidate = cd_name
        else:
            path_name = os.path.basename(unquote(urlparse(url).path))
            candidate = path_name or ""

        candidate = candidate.strip().strip(".") or ""
        if not candidate:
            sha8 = hashlib.sha256(url.encode("utf-8")).hexdigest()[:8]
            candidate = f"file_{sha8}"

        # Sanitize suspicious chars
        candidate = self.SAFE_FILENAME_RE.sub("_", candidate)
        # Avoid trailing dots/spaces (Windows)
        candidate = candidate.rstrip(" .")
        return candidate or "download"

    def _unique_path(self, filename: str) -> Path:
        """
        Ensure we don't overwrite existing files; add -1, -2, ... suffix if needed.
        """
        path = self.out_dir / filename
        if not path.exists():
            return path

        stem = path.stem
        suffix = path.suffix  # includes dot
        n = 1
        while True:
            candidate = self.out_dir / f"{stem}-{n}{suffix}"
            if not candidate.exists():
                return candidate
            n += 1


# -------------------- small utilities --------------------

def _normalize_content_type(ct: Optional[str]) -> Optional[str]:
    if not ct:
        return None
    # Strip parameters like "; charset=utf-8"
    return ct.split(";")[0].strip().lower() or None


def _filename_from_content_disposition(cd: str) -> Optional[str]:
    """
    Extract filename from a Content-Disposition header.
    Supports RFC 5987 (filename*=) and basic filename=.
    """
    if not cd:
        return None

    # filename*=UTF-8''encoded%20name.pdf
    m = re.search(r"filename\*\s*=\s*([^']*)'[^']*'([^;]+)", cd, re.IGNORECASE)
    if m:
        return unquote(m.group(2)).strip().strip('"')

    # filename="name.ext"
    m = re.search(r'filename\s*=\s*"([^"]+)"', cd, re.IGNORECASE)
    if m:
        return m.group(1).strip()

    # filename=name.ext
    m = re.search(r"filename\s*=\s*([^;]+)", cd, re.IGNORECASE)
    if m:
        return m.group(1).strip().strip('"')

    return None


# -------------------- example usage --------------------
if __name__ == "__main__":
    urls = [
        "https://www.kingbrightusa.com/images/catalog/SPEC/APT2012EC.pdf",
        "https://assets.nexperia.com/documents/data-sheet/PESDXL1BA_SER.pdf",
        "https://assets.nexperia.com/documents/data-sheet/PESDXL1BA_SER.pdf",
        "https://assets.nexperia.com/documents/data-sheet/PESDXL1BA_SER.pdf",
        "https://assets.nexperia.com/documents/data-sheet/PMEG2005EGW.pdf",
        "https://assets.nexperia.com/documents/data-sheet/74HC_HCT2G34.pdf",
        "https://assets.nexperia.com/documents/data-sheet/74HC_HCT2G34.pdf",
        "https://assets.nexperia.com/documents/data-sheet/PESDXL1BA_SER.pdf",
    ]

    downloader = URLDownloader(
        out_dir="downloads",
        max_file_bytes=50 * 1024 * 1024,  # 50 MB
        timeout=(10.0, 30.0),
        retries=3,
        backoff_factor=0.6,
        user_agent="EnterpriseDatasheetsFetcher/1.0",
        verify_tls=True,
        max_workers=4,  # set >1 for parallel downloads
    )

    results = downloader.download_all(urls)
    for r in results:
        if r.ok:
            print(f"OK  {r.url}\n -> {r.path} ({r.bytes_written} bytes, {r.content_type})\n")
        else:
            print(f"ERR {r.url}\n -> {r.error} (status={r.http_status})\n")
