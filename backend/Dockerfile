FROM python:3.12-slim-bookworm AS builder

WORKDIR /app

ENV PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

COPY requirements.txt .
RUN pip install --upgrade pip && pip install -r requirements.txt

FROM python:3.12-slim-bookworm

WORKDIR /app

RUN groupadd -r scdms --gid=1001 && \
    useradd -r -g scdms --uid=1001 --no-create-home scdms && \
    mkdir -p /var/log/scdms /var/backups/scdms /var/scdms/media /app/logs /home/scdms/.cache && \
    chown -R scdms:scdms /var/log/scdms /var/backups/scdms /var/scdms/media /app/logs /home/scdms

USER root
RUN apt-get update && apt-get install -y --no-install-recommends \
    wget ca-certificates \
    procps \
    tesseract-ocr \
    libmagic1 \
    fonts-crosextra-carlito \
    && QUARTO_VERSION=1.6.42 \
    && wget -q "https://github.com/quarto-dev/quarto-cli/releases/download/v${QUARTO_VERSION}/quarto-${QUARTO_VERSION}-linux-amd64.tar.gz" -O /tmp/quarto.tar.gz \
    && mkdir -p /opt/quarto \
    && tar -xzf /tmp/quarto.tar.gz -C /opt/quarto --strip-components=1 \
    && ln -sf /opt/quarto/bin/quarto /usr/local/bin/quarto \
    && ln -sf /opt/quarto/bin/tools/x86_64/typst /usr/local/bin/typst \
    && rm -f /tmp/quarto.tar.gz \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

COPY --from=builder /usr/local /usr/local

# Verify Quarto can discover the Python (Jupyter) kernel used by Smart Reports.
# Non-fatal: a failure here only means Python-executed reports need attention.
RUN quarto check jupyter || echo "WARN: 'quarto check jupyter' failed — Smart Report rendering may need attention"

COPY . .
RUN sed -i 's/\r$//' docker-entrypoint.sh && chmod +x docker-entrypoint.sh && \
    chown -R scdms:scdms /app

EXPOSE 8000
# Quarto (Deno) writes its cache to $HOME/.cache/quarto — give the non-root user a writable home.
ENV HOME=/home/scdms
USER scdms
ENTRYPOINT ["sh", "./docker-entrypoint.sh"]
