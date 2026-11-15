"""Download bounded, validated HTTP ranges from NASA PGDA; never overwrite source snapshots."""
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
import hashlib
import json
import urllib.request

ROOT = Path(__file__).resolve().parents[2]
FOLDER = ROOT / '.tools/cache/Site01'
FOLDER.mkdir(parents=True, exist_ok=True)
records = []
for kind in ['surf', 'slp', 'toterr']:
    name = f'Site01_final_adj_5mpp_{kind}.tif'
    url = f'https://pgda.gsfc.nasa.gov/data/LOLA_5mpp/Site01/{name}'
    with urllib.request.urlopen(urllib.request.Request(url, method='HEAD'), timeout=20) as r:
        size = int(r.headers['Content-Length'])
        modified = r.headers.get('Last-Modified')
    assert 0 < size < 200_000_000, 'Unexpected source size; investigate before downloading'
    target = FOLDER / name
    if not target.exists() or target.stat().st_size != size:
        partial = target.with_suffix('.ranges.partial')
        chunks = [(start, min(start + 1024 * 1024, size) - 1) for start in range(0, size, 1024 * 1024)]

        def fetch(pair):
            start, end = pair
            headers = {'Range': f'bytes={start}-{end}'}
            if modified:
                headers['If-Range'] = modified
            for attempt in range(3):
                try:
                    with urllib.request.urlopen(urllib.request.Request(url, headers=headers), timeout=30) as r:
                        assert r.status == 206, 'Server ignored the bounded request'
                        assert r.headers['Content-Range'] == f'bytes {start}-{end}/{size}', 'Mismatched byte range'
                        data = r.read(end - start + 2)
                    assert len(data) == end - start + 1, 'Truncated or oversized range'
                    return start, data
                except Exception:
                    if attempt == 2:
                        raise

        with partial.open('wb') as stream, ThreadPoolExecutor(max_workers=4) as pool:
            stream.truncate(size)
            jobs = [pool.submit(fetch, chunk) for chunk in chunks]
            for done, job in enumerate(as_completed(jobs), 1):
                start, data = job.result()
                stream.seek(start)
                stream.write(data)
                print(f'{name}: {done}/{len(chunks)} ranges', flush=True)
        assert partial.read_bytes()[:4] in [b'II*\x00', b'MM\x00*'], 'Not a TIFF'
        partial.replace(target)
    records.append(dict(url=url, bytes=size, sha256=hashlib.sha256(target.read_bytes()).hexdigest(), lastModified=modified))
(FOLDER / 'sources.json').write_text(json.dumps(records, indent=2), encoding='utf-8')
print('Three NASA source products complete; lengths, range responses and TIFF signatures verified.', flush=True)
