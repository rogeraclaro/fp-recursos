# Extension Icons

## Temporary Placeholder Icons

For now, create simple placeholder icons using any image editor or online tool:

### Sizes needed:
- `icon-16.png` (16x16px)
- `icon-48.png` (48x48px)
- `icon-128.png` (128x128px)

### Design:
- Background: Black (#000000)
- Border: Yellow (#FACC15), 2px
- Text: "AI" in yellow, bold, centered

### Quick generation options:

1. **Using Figma/Canva**: Create 3 squares with text "AI"
2. **Using favicon.io**: https://favicon.io/favicon-generator/
3. **Using ImageMagick** (if installed):
   ```bash
   convert -size 16x16 xc:black -fill "#FACC15" -draw "rectangle 0,0 16,16" -fill black -draw "rectangle 2,2 14,14" -fill "#FACC15" -gravity center -pointsize 8 -annotate +0+0 "AI" icon-16.png
   convert -size 48x48 xc:black -fill "#FACC15" -draw "rectangle 0,0 48,48" -fill black -draw "rectangle 2,2 46,46" -fill "#FACC15" -gravity center -pointsize 24 -annotate +0+0 "AI" icon-48.png
   convert -size 128x128 xc:black -fill "#FACC15" -draw "rectangle 0,0 128,128" -fill black -draw "rectangle 2,2 126,126" -fill "#FACC15" -gravity center -pointsize 64 -annotate +0+0 "AI" icon-128.png
   ```

## For production:

Create professional icons with:
- Bookmark icon + AI element
- Neobrutalist style (black borders, yellow accent)
- Match webapp's design aesthetic
