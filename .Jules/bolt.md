## 2024-10-22 - Lazy Loading Custom Element Conflict
**Learning:** When using regex to add `loading="lazy"` to `<img>` tags, it can inadvertently modify custom web components that start with `<img-` (like `<img-comparison-slider>`).
**Action:** Use a more precise regex like `r'<img\s'` instead of `r'<img'` to avoid matching custom elements, or parse the HTML properly with a DOM parser.
