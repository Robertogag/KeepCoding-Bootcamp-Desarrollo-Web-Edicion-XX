FROM python:3.12-slim AS builder
WORKDIR /build
COPY pyproject.toml uv.lock ./
COPY app ./app
RUN pip install --no-cache-dir uv==0.10.11 \
    && uv export --frozen --no-dev --no-emit-project --output-file requirements.txt \
    && pip wheel --no-cache-dir --wheel-dir /wheels -r requirements.txt \
    && pip wheel --no-cache-dir --no-deps --wheel-dir /wheels .

FROM python:3.12-slim
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    UPLOAD_DIR=/data/uploads
WORKDIR /app
COPY --from=builder /wheels /wheels
RUN pip install --no-cache-dir /wheels/* \
    && rm -rf /wheels \
    && groupadd --system oee \
    && useradd --system --gid oee oee \
    && mkdir -p /data/uploads \
    && chown -R oee:oee /data/uploads
COPY app ./app
COPY alembic ./alembic
COPY alembic.ini ./
USER oee
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
