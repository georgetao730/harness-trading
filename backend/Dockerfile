FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# config/ and other data dirs are mounted at runtime via docker-compose
EXPOSE 18766

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "18766", "--reload"]
