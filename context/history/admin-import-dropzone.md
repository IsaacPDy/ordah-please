# Admin CSV and Excel drag-and-drop imports

Completed locally on 2026-10-05.

- Admin Imports supports dropping one file onto the existing upload field, with drag feedback and a browse button.
- Only CSV, XLS, and XLSX files up to 5MB are accepted. Selection and the authenticated endpoint share file type/size validation. Excel signatures are checked before parsing; file contents still pass the existing catalog header and row validation.
- Excel uses its first worksheet and the existing 17 catalog columns. SheetJS CE 0.20.3 is pinned to its official distribution tarball, loaded dynamically for Excel files.
- Selecting a file does not import it. The existing restaurant preview and explicit confirmation remain. Unsupported selections clear the prior file, and stale asynchronous previews cannot replace a newer selection.
- Platform Admin authorization, catalog repository transactions, and cache invalidation remain in the existing handler.

Validation:

- `npx vitest run apps/web/app/admin/imports/upload-form.test.tsx apps/web/src/features/catalog/csv-upload-handler.test.ts` — 18 passed, including existing import outcome tests and real XLS/XLSX workbook imports through the injected repository boundary.
- Scoped ESLint on Admin Imports and the changed catalog handler/helper files — passed.
- `npm run typecheck --workspace @ordah-please/web` — passed.
- Isolated Chrome pass using the actual UploadForm and application CSS/tokens: CSV drop, drag highlight, XLSX picker/preview, unsupported PDF rejection, 393px layout, and no page errors. No catalog writes or authenticated production import were performed.

Production deployment and signed-in database import acceptance were not verified in this task.
