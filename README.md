# PaperWorkz — PDF Edit (first working tool)

This is the click to edit PDF editor, built to work like Sejda.

## Flow
1. `/` — pick a tool (Edit PDF is the only one wired up right now)
2. `/edit` — upload a PDF (drag and drop or click)
3. Editor screen — click any sentence to edit it in place, the app
   auto detects the closest font (Helvetica, Times, or Courier) and
   lets you override it from the small picker under the edit box
4. Download PDF — exports a new PDF with your edits baked in

## How the edit actually works
PDFs don't have real "text boxes" like Word. Each word is just placed at
an exact x,y position. So editing works like this:
- pdf.js reads the page and finds every text run with its position and size
- When you click one, an input box appears exactly on top of it
- On export, pdf-lib draws a white rectangle over the original text, then
  draws your new text in the matched font at the same position and size

This covers simple, single column documents well (invoices, letters,
agreements, forms). Complex multi column layouts, tables, and scanned
documents are not handled yet, that's the natural next milestone, or
where a paid SDK like Apryse/PSPDFKit would take over for a "pro" tier.

## Run it
```
npm install
npm run dev
```
Then open http://localhost:3000

## Next up (not built yet)
- Add text tool (place new text anywhere on the page)
- Add image / shape / signature
- Auto detect and match the original text color and background
  instead of assuming white background
- Multi page thumbnail rail
