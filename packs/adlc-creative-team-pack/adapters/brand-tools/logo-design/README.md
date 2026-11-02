# Licensed logo production helpers

These six unmodified Python 3 scripts are from `kaankiziltug/logo-design-skill`, commit `734090317a2155c5bf1ae8bd4cc85c6848a0128f`, under the MIT license in this folder. They are production helpers, not an independent authority or a complete brand approval workflow. The upstream trademark reference library is not included.

Run `svg_audit.py <master.svg> --json`, parse the reported findings (including `FAIL`), and inspect a real render. `render_png.py --which` lists available renderers. `concept_sheet.py` and `preview_sheet.py` make comparison sheets; omit library-based reference options because the reference library is not bundled. `export_variants.py` creates SVG variants and optional PNG/web icons when a renderer is installed. The host must bound input and output paths to its trusted artifact storage before invoking these scripts.
