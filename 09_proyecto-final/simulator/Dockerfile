FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt && useradd --create-home simulator
COPY --chown=simulator:simulator . .
USER simulator
EXPOSE 5020 8100
HEALTHCHECK --interval=15s --timeout=3s --start-period=10s CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8100/health', timeout=2)"
CMD ["python", "-m", "oee_simulator"]
