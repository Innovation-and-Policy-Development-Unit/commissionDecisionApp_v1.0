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
    mkdir -p /var/log/scdms /var/backups/scdms /var/scdms/media && \
    chown -R scdms:scdms /var/log/scdms /var/backups/scdms /var/scdms/media

COPY --from=builder /usr/local /usr/local

COPY . .
RUN sed -i 's/\r$//' docker-entrypoint.sh && chmod +x docker-entrypoint.sh && \
    chown -R scdms:scdms /app

EXPOSE 8000
USER scdms
ENTRYPOINT ["sh", "./docker-entrypoint.sh"]
