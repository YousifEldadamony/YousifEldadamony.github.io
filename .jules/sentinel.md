## 2024-10-22 - [Reverse Tabnabbing]
**Vulnerability:** External links with `target="_blank"` missing `rel="noopener noreferrer"`.
**Learning:** When a page links to another page using `target="_blank"`, the new page gets access to the original window object via `window.opener`. This can be exploited to navigate the original tab to a malicious site.
**Prevention:** Always use `rel="noopener noreferrer"` for external links with `target="_blank"`.
