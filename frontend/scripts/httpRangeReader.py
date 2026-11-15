"""Seekable HTTPS reader for Rasterio's Python VSI opener, with bounded caching."""
import io
import hashlib
from pathlib import Path
import time
from collections import OrderedDict
import urllib.request

class HttpRangeReader(io.RawIOBase):
    def __init__(self, url):
        super().__init__()
        self.url = url
        with urllib.request.urlopen(urllib.request.Request(url, method='HEAD'), timeout=25) as r:
            self.size = int(r.headers['Content-Length'])
            identity = url + str(self.size) + str(r.headers.get('Last-Modified'))
        self.disk = Path(__file__).resolve().parents[2] / '.tools/cache/regional-ranges' / hashlib.sha256(identity.encode()).hexdigest()[:16]
        self.disk.mkdir(parents=True, exist_ok=True)
        self.position = 0
        self.cache = OrderedDict()
        self.block_size = 256 * 1024

    def readable(self): return True
    def seekable(self): return True
    def tell(self): return self.position
    def seek(self, offset, whence=0):
        position = offset if whence == 0 else self.position + offset if whence == 1 else self.size + offset
        if position < 0 or whence not in [0,1,2]: raise ValueError('Invalid seek')
        self.position = position
        return position

    def read(self, size=-1):
        if size < 0 or size > 16*1024*1024: raise ValueError('Unbounded raster read refused')
        end = min(self.position + size, self.size)
        parts = []
        while self.position < end:
            start = self.position // self.block_size * self.block_size
            if start not in self.cache:
                last = min(start+self.block_size,self.size)-1
                cached = self.disk / f'{start}.bin'
                if cached.exists() and cached.stat().st_size == last-start+1:
                    data = cached.read_bytes()
                else:
                    print(f'Fetching regional bytes {start}-{last}',flush=True)
                    request = urllib.request.Request(self.url,headers={'Range':f'bytes={start}-{last}'})
                    begun = time.monotonic()
                    for attempt in range(3):
                        try:
                            with urllib.request.urlopen(request,timeout=25) as r:
                                if r.status != 206 or r.headers.get('Content-Range') != f'bytes {start}-{last}/{self.size}': raise OSError('Server did not return the requested raster range')
                                parts = []
                                while block := r.read(65536):
                                    parts.append(block)
                                    if time.monotonic()-begun > 90 or sum(map(len,parts)) > last-start+1: raise TimeoutError('Regional range exceeded time or byte budget')
                                data = b''.join(parts)
                            break
                        except Exception as error:
                            print(f'Regional range retry {attempt+1}: {error!r}',flush=True)
                            begun = time.monotonic()
                            if attempt == 2: raise
                if len(data) != last-start+1: raise OSError('Truncated raster range')
                if not cached.exists(): cached.write_bytes(data)
                self.cache[start] = data
                while len(self.cache) > 48: self.cache.popitem(last=False)
            self.cache.move_to_end(start)
            count = min(end-self.position,len(self.cache[start])-(self.position-start))
            parts.append(self.cache[start][self.position-start:self.position-start+count])
            self.position += count
        return b''.join(parts)

    def readinto(self, target):
        data = self.read(len(target));target[:len(data)] = data
        return len(data)

def regional_opener(url, mode='rb'):
    expected='https://pgda.gsfc.nasa.gov/data/LOLA_20mpp/LDEM_80S_20MPP_ADJ.TIF'
    if url != expected or mode not in ['rb','r']: raise FileNotFoundError(url)
    return HttpRangeReader(url)
