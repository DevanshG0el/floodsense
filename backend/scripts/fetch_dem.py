"""Clip Copernicus DEM GLO-30 to the study area, reading the COG straight from the
Registry of Open Data on AWS (only the needed window is downloaded).
    .venv/Scripts/python scripts/fetch_dem.py
"""

import sys

import rasterio
from rasterio.windows import from_bounds

sys.path.insert(0, "src")
from floodsense.config import BBOX, DEM_URL, PROCESSED_DIR

PAD = 0.01  # degrees of padding so neighbourhood stats work at the edges


def main() -> None:
    s, w, n, e = BBOX
    with rasterio.Env(GDAL_DISABLE_READDIR_ON_OPEN="EMPTY_DIR", AWS_NO_SIGN_REQUEST="YES"):
        with rasterio.open(DEM_URL) as src:
            win = from_bounds(w - PAD, s - PAD, e + PAD, n + PAD, transform=src.transform)
            win = win.round_offsets().round_lengths()
            data = src.read(1, window=win)
            profile = src.profile.copy()
            profile.update(height=data.shape[0], width=data.shape[1],
                           transform=src.window_transform(win), driver="GTiff",
                           compress="deflate", tiled=False)
            profile.pop("blockxsize", None)
            profile.pop("blockysize", None)
    out = PROCESSED_DIR / "dem_central_delhi.tif"
    with rasterio.open(out, "w", **profile) as dst:
        dst.write(data, 1)
    print(f"DEM {data.shape} min={data.min():.1f} max={data.max():.1f} mean={data.mean():.1f} m -> {out}")


if __name__ == "__main__":
    main()
