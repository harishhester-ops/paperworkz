FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    libreoffice \
    ghostscript \
    tesseract-ocr \
    tesseract-ocr-eng \
    tesseract-ocr-osd \
    poppler-utils \
    qpdf \
    imagemagick \
    unpaper \
    curl \
    ca-certificates \
    fonts-liberation \
    fonts-noto \
  && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
  && apt-get install -y nodejs \
  && apt-get clean \
  && rm -rf /var/lib/apt/lists/*

# Allow ImageMagick to process PDFs
RUN sed -i 's/rights="none" pattern="PDF"/rights="read|write" pattern="PDF"/' \
    /etc/ImageMagick-6/policy.xml 2>/dev/null || true

# Raise ImageMagick memory/disk limits for large documents
RUN sed -i 's/<policy domain="resource" name="memory" value="[^"]*"\/>/<policy domain="resource" name="memory" value="2GiB"\/>/' \
    /etc/ImageMagick-6/policy.xml 2>/dev/null || true
RUN sed -i 's/<policy domain="resource" name="disk" value="[^"]*"\/>/<policy domain="resource" name="disk" value="8GiB"\/>/' \
    /etc/ImageMagick-6/policy.xml 2>/dev/null || true

# LibreOffice needs a home dir for its user profile
ENV HOME=/tmp/lo-home
RUN mkdir -p /tmp/lo-home /tmp/uploads /tmp/work

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

COPY src/ ./src/

ENV PORT=4000
ENV NODE_ENV=production

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=10s --start-period=15s \
  CMD curl -f http://localhost:4000/health || exit 1

CMD ["node", "src/index.js"]
