import Link from "next/link";
import "./paperworkz-home.css";

function Card({
  icon,
  title,
  desc,
  href,
}: {
  icon: string;
  title: string;
  desc: string;
  href?: string;
}) {
  if (href) {
    return (
      <Link href={href} className="card">
        <div className="icon">{icon}</div>
        <h3>{title}</h3>
        <p>{desc}</p>
      </Link>
    );
  }
  return (
    <div className="card">
      <div className="icon">{icon}</div>
      <h3>{title}</h3>
      <p>{desc}</p>
    </div>
  );
}

export default function Home() {
  return (
    <>
      <nav className="nav">
        <div className="logo">
          Paper<span>Workz</span>
        </div>
        <div className="sub">by WorkzApp AI</div>
        <div className="links">
          <a href="#editor">PDF Editor</a>
          <a href="#tools">Convert</a>
          <a href="#tools">AI Tools</a>
          <a href="#tools">Templates</a>
          <a href="#pricing">Pricing</a>
        </div>
        <a className="sign" href="#">
          Sign in
        </a>
        <a className="btn" href="#">
          Get started
        </a>
      </nav>

      <section className="hero">
        <div>
          <div className="badge">
            <span className="dot"></span> AI-powered document workspace
          </div>
          <h1>
            Your documents.<br />
            <span style={{ color: "var(--red)" }}>Smarter.</span>
          </h1>
          <p>
            Edit PDFs, convert files, transform documents and create
            presentations all in one powerful workspace built by WorkzApp AI.
          </p>
          <div className="actions">
            <a className="btn" href="#tools">
              Start for free
            </a>
            <a className="ghost" href="#tools">
              Explore tools
            </a>
          </div>
          <div className="trust">
            <span>&#x2713; Private by design</span>
            <span>&#x2713; Secure processing</span>
            <span>&#x2713; Works in browser</span>
          </div>
        </div>
        <div className="workspace" id="editor">
          <div className="wtop">
            <span className="circle"></span>
            <span className="circle"></span>
            <span className="circle"></span>
            <span className="filename">Proposal_Final.pdf</span>
            <span className="save">Saved</span>
          </div>
          <div className="wbody">
            <div className="rail">
              <div className="tool active">&#x270E;</div>
              <div className="tool">T</div>
              <div className="tool">&#x25A3;</div>
              <div className="tool">&#x2197;</div>
              <div className="tool">&#x2301;</div>
              <div className="tool">&#x25C9;</div>
              <div className="tool">&#x22EF;</div>
            </div>
            <div className="canvas">
              <div className="page">
                <div className="line big"></div>
                <div className="line short"></div>
                <div style={{ height: 16 }}></div>
                <div className="line mid"></div>
                <div className="para"></div>
                <div className="para"></div>
                <div className="para"></div>
                <div style={{ height: 16 }}></div>
                <div className="line mid"></div>
                <div className="para"></div>
                <div className="para"></div>
                <div className="signature">Authorized signature</div>
              </div>
            </div>
            <div className="panel">
              <div className="ptitle">Document</div>
              <div className="field">Page 1 of 8</div>
              <div className="field">Font · Inter</div>
              <div className="field">Size · 14 px</div>
              <div className="field">Alignment · Left</div>
              <div className="redmini">Apply changes</div>
            </div>
          </div>
        </div>
      </section>

      <section className="tools" id="tools">
        <div className="sectionhead">
          <div className="eyebrow">The PaperWorkz toolkit</div>
          <h2>One place for every document task.</h2>
          <p>
            Edit, organize, secure, compress, convert and transform documents
            without jumping between different apps.
          </p>
        </div>

        <div className="category">
          <div className="cathead">
            <h3>Most popular</h3>
            <span>Start with the tools people use most</span>
          </div>
          <div className="grid">
            <Card icon="PDF" title="PDF Editor" desc="Edit text, add links, images and shapes, annotate, fill and sign PDFs." href="/edit" />
            <Card icon="&#x2193;" title="Compress PDF" desc="Reduce PDF file size while keeping documents readable and professional." />
            <Card icon="&#xD7;" title="Delete Pages" desc="Remove unwanted pages from a PDF document." href="/delete-pages" />
            <Card icon="&#xFF0B;" title="Merge PDF" desc="Combine multiple PDFs and images into one document." href="/merge" />
            <Card icon="&#x2197;" title="Split PDF" desc="Split page ranges or extract every page into separate files." href="/split" />
            <Card icon="&#x2317;" title="Crop PDF" desc="Trim PDF margins and change page size." href="/crop" />
            <Card icon="&#x2713;" title="Fill & Sign" desc="Add signatures and fill out PDF forms digitally." href="/edit/annotate" />
            <Card icon="DOC" title="PDF to Word" desc="Convert PDF files into editable Word documents." />
            <Card icon="&#x25A3;" title="Extract Pages" desc="Create a new document containing only the pages you need." href="/extract-pages" />
          </div>
        </div>

        <div className="category">
          <div className="cathead">
            <h3>Merge</h3>
            <span>Bring documents together</span>
          </div>
          <div className="grid">
            <Card icon="&#x21C4;" title="Alternate & Mix" desc="Mix pages from two or more documents by alternating them." />
            <Card icon="&#xFF0B;" title="Merge" desc="Combine PDFs and images into one file." href="/merge" />
            <Card icon="&#x2637;" title="Organize" desc="Arrange, reorder and manage PDF pages visually." />
          </div>
        </div>

        <div className="category">
          <div className="cathead">
            <h3>Split</h3>
            <span>Break documents into exactly what you need</span>
          </div>
          <div className="grid">
            <Card icon="&#x25A3;" title="Extract Pages" desc="Extract selected pages into a new document." href="/extract-pages" />
            <Card icon="&#x2197;" title="Split by Pages" desc="Split specific page ranges or every page into separate files." href="/split" />
            <Card icon="&#x2311;" title="Split by Bookmarks" desc="Turn bookmarked chapters into separate documents." />
            <Card icon="&#xBD;" title="Split in Half" desc="Split two-page scans and large page layouts down the middle." />
            <Card icon="MB" title="Split by Size" desc="Create smaller documents based on a target file size." />
            <Card icon="T" title="Split by Text" desc="Create separate documents when selected text changes." />
          </div>
        </div>

        <div className="category">
          <div className="cathead">
            <h3>Edit & Sign</h3>
            <span>Make documents usable and ready to send</span>
          </div>
          <div className="grid">
            <Card icon="PDF" title="PDF Editor" desc="Edit existing PDF text and add text, links, images, shapes and annotations." href="/edit" />
            <Card icon="&#x2713;" title="Fill & Sign" desc="Fill forms and add your electronic signature." href="/edit/annotate" />
            <Card icon="FORM" title="Create Forms" desc="Turn existing PDF documents into fillable forms." />
            <Card icon="&#xD7;" title="Delete Pages" desc="Remove pages from any PDF document." href="/delete-pages" />
          </div>
        </div>

        <div className="category">
          <div className="cathead">
            <h3>Compress & Scans</h3>
            <span>Make scanned documents smaller and smarter</span>
          </div>
          <div className="grid">
            <Card icon="&#x2193;" title="Compress" desc="Reduce document size for easier sharing and storage." />
            <Card icon="&#x2194;" title="Deskew" desc="Automatically straighten tilted scanned PDF pages." />
            <Card icon="OCR" title="OCR" desc="Convert scans into searchable PDFs and extract their text." />
          </div>
        </div>

        <div className="category">
          <div className="cathead">
            <h3>Security</h3>
            <span>Protect sensitive documents</span>
          </div>
          <div className="grid">
            <Card icon="&#x2311;" title="Protect PDF" desc="Add passwords and control document permissions." />
            <Card icon="&#x232B;" title="Unlock PDF" desc="Remove supported restrictions and passwords." />
            <Card icon="W" title="Watermark" desc="Add text or image watermarks to documents." />
            <Card icon="&#x25A3;" title="Flatten" desc="Make fillable PDFs read-only for final distribution." />
          </div>
        </div>

        <div className="category">
          <div className="cathead">
            <h3>Convert from PDF</h3>
            <span>Turn PDFs into editable formats</span>
          </div>
          <div className="grid">
            <Card icon="XLS" title="PDF to Excel" desc="Extract tables from PDFs into Excel or CSV." />
            <Card icon="IMG" title="PDF to JPG" desc="Convert PDF pages into JPG, PNG or TIFF images." href="/pdf-to-jpg" />
            <Card icon="PPT" title="PDF to PPT" desc="Convert PDFs into editable PowerPoint presentations." />
            <Card icon="TXT" title="PDF to Text" desc="Extract all text into a separate text file." />
            <Card icon="DOC" title="PDF to Word" desc="Convert PDF files into editable DOCX documents." />
          </div>
        </div>

        <div className="category">
          <div className="cathead">
            <h3>Convert to PDF</h3>
            <span>Create PDFs from almost anything</span>
          </div>
          <div className="grid">
            <Card icon="WEB" title="HTML to PDF" desc="Convert web pages and HTML files into PDFs." />
            <Card icon="IMG" title="JPG to PDF" desc="Turn images into clean PDF documents." href="/jpg-to-pdf" />
            <Card icon="DOC" title="Word to PDF" desc="Create PDFs from Microsoft Word documents." />
            <Card icon="XLS" title="Excel to PDF" desc="Export spreadsheets into polished PDFs." />
            <Card icon="PPT" title="Presentation to PDF" desc="Turn PowerPoint presentations into PDF files." />
          </div>
        </div>

        <div className="category">
          <div className="cathead">
            <h3>PaperWorkz AI & advanced tools</h3>
            <span>Go beyond basic PDF utilities</span>
          </div>
          <div className="grid">
            <Card icon="&#x2726;" title="AI Summarize" desc="Summarize long documents and instantly surface key points." />
            <Card icon="&#x2726;" title="AI Rewrite" desc="Rewrite document content in a clearer, more professional style." />
            <Card icon="&#x21C4;" title="AI Translate" desc="Translate documents while preserving their structure." />
            <Card icon="&#x2295;" title="Document Compare" desc="Compare two versions and spot important changes." />
            <Card icon="&#x25A4;" title="Excel to Presentation" desc="Turn spreadsheet data into presentation-ready slides." />
            <Card icon="&#x2726;" title="Document Generator" desc="Create polished documents from prompts, templates or source files." />
          </div>
        </div>

        <div className="category">
          <div className="cathead">
            <h3>Others</h3>
            <span>Power tools for serious document workflows</span>
          </div>
          <div className="grid">
            <Card icon="123" title="Bates Numbering" desc="Apply sequential identifiers across multiple files." href="/bates-numbering" />
            <Card icon="&#x1F516;" title="Create Bookmarks" desc="Add and manage PDF bookmarks for easier navigation." />
            <Card icon="&#x2317;" title="Crop" desc="Trim margins and change PDF page size." href="/crop" />
            <Card icon="META" title="Edit Metadata" desc="Change author, title, keywords, subject and metadata fields." href="/edit-metadata" />
            <Card icon="IMG" title="Extract Images" desc="Pull images out of PDF documents." />
            <Card icon="&#x2194;" title="Flip" desc="Mirror pages horizontally or vertically." href="/flip" />
            <Card icon="G" title="Grayscale" desc="Convert PDF text and images to grayscale." />
            <Card icon="H" title="Header & Footer" desc="Apply page numbers and text labels to PDF pages." href="/header-footer" />
            <Card icon="N" title="N-up" desc="Place multiple PDF pages on a single sheet." href="/n-up" />
            <Card icon="#" title="Page Numbers" desc="Add page numbers to your PDF." href="/page-numbers" />
            <Card icon="&#x21BB;" title="Rename" desc="Rename documents based on content from their pages." href="/rename" />
            <Card icon="&#x2699;" title="Repair PDF" desc="Recover data from corrupted or damaged PDF files." />
            <Card icon="&#x2195;" title="Resize" desc="Add margins, padding or change PDF page size." href="/resize" />
            <Card icon="&#x27F3;" title="Rotate" desc="Rotate PDF pages and save the changes permanently." href="/rotate" />
            <Card icon="&#x232B;" title="Remove Annotations" desc="Batch remove highlights, strikeouts and other annotations." href="/remove-annotations" />
          </div>
        </div>
      </section>

      <section className="ai" id="pricing">
        <div>
          <h2>From file to finished document.</h2>
          <p>
            Upload once. Edit, convert, summarize, transform and export without
            jumping between five different tools.
          </p>
        </div>
        <a className="btn" href="#">
          Try PaperWorkz free
        </a>
      </section>

      <footer>
        <span>&#169; 2026 PaperWorkz by WorkzApp AI</span>
        <span>Documents, simplified.</span>
      </footer>
    </>
  );
}
