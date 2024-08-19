FROM python:3.12.5 AS builder

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1
WORKDIR /app


RUN python -m venv .venv
COPY requirements.txt ./
RUN .venv/bin/pip install -r requirements.txt
FROM python:3.12.5-slim
WORKDIR /app
COPY --from=builder /app/.venv .venv/
COPY . .
EXPOSE 5000
CMD ["/app/.venv/bin/flask", "run", "--host=0.0.0.0", "--port=5000"]
