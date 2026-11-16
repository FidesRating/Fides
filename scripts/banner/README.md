# Banner

`banner.html` is the source of `public/fides-banner.png` (2172 x 724, used by the root README).

Render it with Microsoft Edge or Chrome in headless mode (needs network access for Google Fonts):

```bash
msedge --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=1.086 \
  --window-size=2000,667 --virtual-time-budget=8000 \
  --screenshot=public/fides-banner.png "file:///<absolute path>/scripts/banner/banner.html"
```
