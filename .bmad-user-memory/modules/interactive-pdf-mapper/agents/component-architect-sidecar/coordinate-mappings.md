# Coordinate Mappings & Transformations

## PDF-to-CSS Conversion Formulas

### Standard Transformation
```typescript
// PDF (bottom-left origin) to CSS (top-left origin)
const transformCoordinates = (pdfCoords, pageHeight) => ({
  left: `${pdfCoords.x}px`,
  top: `${pageHeight - pdfCoords.y - pdfCoords.height}px`,
  width: `${pdfCoords.width}px`,
  height: `${pdfCoords.height}px`,
  position: 'absolute'
});
```

### Scaling Factors
_Initially empty - will document DPI scaling and responsive transformation formulas_

### Edge Case Solutions
_Initially empty - will document coordinate transformation edge cases and solutions_

### Validation Results
_Initially empty - will track coordinate transformation accuracy and improvements_

---

*This file maintains coordinate transformation formulas and mapping strategies for pixel-perfect positioning.*